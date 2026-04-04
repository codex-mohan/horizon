import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Agent } from "@mariozechner/pi-agent-core";
import type { ToolApprovalConfig } from "../lib/approval.js";
import { needsApproval } from "../lib/approval.js";
import { conversationStore } from "../lib/conversation-db.js";
import { createModel, getThinkingLevel, type RuntimeModelConfig } from "../lib/model.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { tools } from "./tools/index.js";

export interface HorizonAgentOptions {
  threadId: string;
  modelConfig: RuntimeModelConfig;
  toolApproval: ToolApprovalConfig;
  systemPrompt?: string;
  onEvent: (event: { type: string; data: unknown }) => void;
}

export class HorizonAgent {
  private agent: Agent;
  private threadId: string;
  private modelConfig: RuntimeModelConfig;
  private toolApproval: ToolApprovalConfig;
  private onEvent: (event: { type: string; data: unknown }) => void;
  private pendingApproval: {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
    resolve: (approved: boolean) => void;
  } | null = null;

  constructor(options: HorizonAgentOptions) {
    this.threadId = options.threadId;
    this.modelConfig = options.modelConfig;
    this.toolApproval = options.toolApproval;
    this.onEvent = options.onEvent;

    const model = createModel(this.modelConfig);
    const thinkingLevel = getThinkingLevel(this.modelConfig);

    // Ensure conversation record exists
    conversationStore.createConversation(this.threadId);

    // Load persisted messages from SQLite
    const persistedMessages = conversationStore.getMessages(this.threadId) as any[];

    this.agent = new Agent({
      initialState: {
        systemPrompt: options.systemPrompt || SYSTEM_PROMPT,
        model,
        thinkingLevel,
        tools: tools as AgentTool<any>[],
        messages: persistedMessages,
      },
      getApiKey: async () => {
        return this.modelConfig.apiKey;
      },
    });

    this.agent.subscribe(async (event) => {
      this.onEvent({ type: event.type, data: event });

      // Intercept tool execution start for approval gating
      if (event.type === "tool_execution_start") {
        const toolName = event.toolName as string;
        const toolCallId = event.toolCallId as string;
        const args = event.args as Record<string, unknown>;

        if (needsApproval(toolName, this.toolApproval)) {
          this.onEvent({
            type: "interrupt",
            data: {
              action_requests: [
                {
                  name: toolName,
                  arguments: args,
                  description: `Tool: ${toolName}\nArgs: ${JSON.stringify(args)}`,
                },
              ],
              review_configs: [
                {
                  action_name: toolName,
                  allowed_decisions: ["approve", "reject"],
                },
              ],
            },
          });

          // Block: wait for user approval via resolve
          const approved = await new Promise<boolean>((resolve) => {
            this.pendingApproval = {
              toolCallId,
              toolName,
              args,
              resolve,
            };
          });

          this.pendingApproval = null;

          if (!approved) {
            // Inject rejection as a steering message
            this.agent.steer({
              role: "user",
              content: `The tool call "${toolName}" was rejected by the user. Do not attempt to call it again. Explain why it was rejected and suggest alternatives.`,
              timestamp: Date.now(),
            });
          }
        }
      }
    });
  }

  async prompt(content: string, images?: { data: string; mimeType: string }[]) {
    const currentModel = createModel(this.modelConfig);
    if (this.agent.state.model.id !== currentModel.id) {
      (this.agent.state as any).model = currentModel;
    }
    (this.agent.state as any).thinkingLevel = getThinkingLevel(this.modelConfig);

    const imageContents = images?.map((img) => ({
      type: "image" as const,
      data: img.data,
      mimeType: img.mimeType,
    }));

    return this.agent.prompt(content, imageContents);
  }

  updateModelConfig(config: RuntimeModelConfig) {
    this.modelConfig = config;
    (this.agent.state as any).model = createModel(config);
    (this.agent.state as any).thinkingLevel = getThinkingLevel(config);
  }

  updateToolApproval(config: ToolApprovalConfig) {
    this.toolApproval = config;
  }

  approvePendingToolCall() {
    if (this.pendingApproval) {
      this.pendingApproval.resolve(true);
    }
  }

  rejectPendingToolCall() {
    if (this.pendingApproval) {
      this.pendingApproval.resolve(false);
    }
  }

  get state() {
    return this.agent.state;
  }

  get isStreaming() {
    return this.agent.state.isStreaming;
  }

  abort() {
    this.agent.abort();
  }

  async waitForIdle() {
    await this.agent.waitForIdle();
  }

  async saveState() {
    const messages = this.agent.state.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    conversationStore.clearMessages(this.threadId);
    conversationStore.saveMessages(this.threadId, messages);
    conversationStore.updateConversation(this.threadId, {
      status: this.isStreaming ? "streaming" : "idle",
    });
  }

  getMessages() {
    return this.agent.state.messages;
  }

  subscribe(fn: (event: any) => void) {
    return this.agent.subscribe(fn);
  }
}
