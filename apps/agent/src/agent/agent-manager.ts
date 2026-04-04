import type { ToolApprovalConfig } from "../lib/approval.js";
import type { RuntimeModelConfig } from "../lib/model.js";
import { HorizonAgent } from "./horizon-agent.js";

interface AgentEntry {
  agent: HorizonAgent;
  lastUsed: number;
}

class AgentManager {
  private agents = new Map<string, AgentEntry>();
  private readonly maxIdleTime = 30 * 60 * 1000; // 30 minutes

  getOrCreate(options: {
    threadId: string;
    modelConfig: RuntimeModelConfig;
    toolApproval: ToolApprovalConfig;
    userId?: string;
    onEvent: (event: { type: string; data: unknown }) => void;
  }): HorizonAgent {
    const existing = this.agents.get(options.threadId);
    if (existing) {
      existing.lastUsed = Date.now();
      existing.agent.updateModelConfig(options.modelConfig);
      existing.agent.updateToolApproval(options.toolApproval);
      return existing.agent;
    }

    const agent = new HorizonAgent(options);
    this.agents.set(options.threadId, { agent, lastUsed: Date.now() });
    return agent;
  }

  get(threadId: string): HorizonAgent | undefined {
    return this.agents.get(threadId)?.agent;
  }

  async destroy(threadId: string) {
    const entry = this.agents.get(threadId);
    if (entry) {
      await entry.agent.saveState();
      entry.agent.abort();
      this.agents.delete(threadId);
    }
  }

  cleanupIdle() {
    const now = Date.now();
    for (const [threadId, entry] of this.agents.entries()) {
      if (now - entry.lastUsed > this.maxIdleTime && !entry.agent.isStreaming) {
        entry.agent.saveState().catch(() => {});
        this.agents.delete(threadId);
      }
    }
  }
}

export const agentManager = new AgentManager();
