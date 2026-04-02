import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, type GraphNode, messagesStateReducer } from "@langchain/langgraph";
import type { RuntimeModelConfig } from "../lib/llm.js";

/**
 * UI Message Definition for Generative UI
 * Used to stream UI updates to the frontend
 */
export interface UIMessage {
  id: string;
  name: string;
  props: Record<string, any>;
  metadata?: {
    message_id?: string;
    tool_call_id?: string;
    tool_name?: string;
    [key: string]: any;
  };
}

/**
 * Tool Call Definition
 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: string;
  error?: string;
  status: "pending" | "approved" | "rejected" | "executing" | "completed" | "failed";
  retry_count: number;
  started_at?: number;
  completed_at?: number;
}

/**
 * Sub-Agent Task Definition
 * Represents a task assigned to a sub-agent worker
 */
export interface SubAgentTask {
  id: string;
  name: string;
  description: string;
  status: "pending" | "spawning" | "running" | "completed" | "failed";
  result?: string;
  error?: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  assigned_agent_id?: string;
}

/**
 * Sub-Agent Result
 * Result returned by a completed sub-agent worker
 */
export interface SubAgentResult {
  task_id: string;
  agent_id: string;
  status: "success" | "failure";
  output: string;
  artifacts_created?: string[];
  errors?: string[];
  metrics?: {
    tokens_used?: number;
    execution_time_ms?: number;
  };
}

/**
 * Sub-Agent Configuration
 * Configuration passed to a worker subgraph
 */
export interface SubAgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  tools: string[];
  modelConfig?: RuntimeModelConfig;
  timeout?: number;
  context?: Record<string, any>;
}

/**
 * Middleware Metrics
 */
export interface MiddlewareMetrics {
  token_usage: { input: number; output: number; total: number };
  rate_limit_hits: number;
  retries: number;
  pii_detected: boolean;
  pii_types: string[];
  processing_time_ms: number;
}

/**
 * Custom reducer for executed_tool_calls: append to array
 */
function toolCallsReducer(current: ToolCall[], update: ToolCall | ToolCall[]): ToolCall[] {
  const updates = Array.isArray(update) ? update : [update];
  return [...current, ...updates];
}

/**
 * Custom reducer for middleware_metrics: merge/accumulate
 */
function metricsReducer(
  current: MiddlewareMetrics,
  update: Partial<MiddlewareMetrics>
): MiddlewareMetrics {
  return {
    token_usage: {
      input: (current.token_usage?.input ?? 0) + (update.token_usage?.input ?? 0),
      output: (current.token_usage?.output ?? 0) + (update.token_usage?.output ?? 0),
      total: (current.token_usage?.total ?? 0) + (update.token_usage?.total ?? 0),
    },
    rate_limit_hits: (current.rate_limit_hits ?? 0) + (update.rate_limit_hits ?? 0),
    retries: (current.retries ?? 0) + (update.retries ?? 0),
    pii_detected: update.pii_detected ?? current.pii_detected ?? false,
    pii_types: [...(current.pii_types ?? []), ...(update.pii_types ?? [])],
    processing_time_ms: update.processing_time_ms ?? current.processing_time_ms ?? 0,
  };
}

/**
 * Custom reducer for errors: append to array
 */
function errorsReducer(current: string[], update: string | string[]): string[] {
  const updates = Array.isArray(update) ? update : [update];
  return [...current, ...updates];
}

/**
 * Custom reducer for UI messages: upsert by id
 */
function uiReducer(current: UIMessage[], update: UIMessage | UIMessage[]): UIMessage[] {
  const updates = Array.isArray(update) ? update : [update];
  const existingMap = new Map(current.map((msg) => [msg.id, msg]));
  for (const msg of updates) {
    const existing = existingMap.get(msg.id);
    if (existing) {
      existingMap.set(msg.id, {
        ...existing,
        props: { ...existing.props, ...msg.props },
        metadata: { ...existing.metadata, ...msg.metadata },
      });
    } else {
      existingMap.set(msg.id, msg);
    }
  }
  return Array.from(existingMap.values());
}

/**
 * Agent State Definition using Annotation.Root for LangSmith compatibility.
 *
 * Annotation.Root() is the modern LangGraph v1.x+ pattern for defining state.
 * The `messages` field uses `messagesStateReducer` which is what LangSmith
 * recognizes for chat-based agents to display conversation history.
 *
 * Core state for the agent graph:
 * - Message history (using messagesStateReducer for LangSmith chat support)
 * - Model/tool tracking
 * - Execution metrics
 * - UI streaming
 * - Routing flags
 */
export const AgentStateAnnotation = Annotation.Root({
  // Core messages - MUST use messagesStateReducer for LangSmith chat visualization
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Model tracking
  model_calls: Annotation<number>({
    reducer: (x: number, y: number) => x + y,
    default: () => 0,
  }),

  // Token usage
  token_usage: Annotation<{ input: number; output: number; total: number }>({
    reducer: (
      current: { input: number; output: number; total: number },
      update: { input: number; output: number; total: number }
    ) => ({
      input: current.input + update.input,
      output: current.output + update.output,
      total: current.total + update.total,
    }),
    default: () => ({ input: 0, output: 0, total: 0 }),
  }),

  // Metadata (for memory context, etc.)
  metadata: Annotation<Record<string, any>>({
    reducer: (current: Record<string, any>, update: Record<string, any>) => ({
      ...current,
      ...update,
    }),
    default: () => ({}),
  }),

  // Tool tracking (for logging/debugging)
  executed_tool_calls: Annotation<ToolCall[]>({
    reducer: toolCallsReducer,
    default: () => [],
  }),

  // Execution timestamps
  start_time: Annotation<number>({
    reducer: (_current: number, update: number) => update,
    default: () => 0,
  }),
  end_time: Annotation<number>({
    reducer: (_current: number, update: number) => update,
    default: () => 0,
  }),

  // Middleware metrics
  middleware_metrics: Annotation<MiddlewareMetrics>({
    reducer: metricsReducer,
    default: () => ({
      token_usage: { input: 0, output: 0, total: 0 },
      rate_limit_hits: 0,
      retries: 0,
      pii_detected: false,
      pii_types: [],
      processing_time_ms: 0,
    }),
  }),

  // Error tracking
  errors: Annotation<string[]>({
    reducer: errorsReducer,
    default: () => [],
  }),

  // UI state for generative UI
  ui: Annotation<UIMessage[]>({
    reducer: uiReducer,
    default: () => [],
  }),

  // Tool rejection flag for routing decisions
  tools_rejected: Annotation<boolean>({
    reducer: (_current: boolean, update: boolean) => update,
    default: () => false,
  }),

  // Sub-agent tasks for parallel execution
  subagent_tasks: Annotation<any[]>({
    reducer: (current: any[], update: any[] | any) => {
      const updates = Array.isArray(update) ? update : [update];
      return [...current, ...updates];
    },
    default: () => [],
  }),

  // Active sub-agent results
  subagent_results: Annotation<any[]>({
    reducer: (current: any[], update: any[] | any) => {
      const updates = Array.isArray(update) ? update : [update];
      return [...current, ...updates];
    },
    default: () => [],
  }),

  // Number of active sub-agents
  active_subagents: Annotation<number>({
    reducer: (x: number, y: number) => x + y,
    default: () => 0,
  }),
});

/**
 * AgentState type derived from the annotation.
 */
export type AgentState = typeof AgentStateAnnotation.State;

/**
 * GraphNode utility typed to this state schema.
 */
export type AgentGraphNode = GraphNode<typeof AgentStateAnnotation>;

export type ToolApprovalMode = "always_ask" | "dangerous_only" | "never_ask";

export interface ToolApprovalConfig {
  mode: ToolApprovalMode;
  auto_approve_tools: string[];
  never_approve_tools: string[];
}

/**
 * Configuration passed via RunnableConfig.configurable
 */
export interface AgentConfigurable {
  thread_id: string;
  checkpoint_id?: string;
  user_id?: string;
  tool_approval?: ToolApprovalConfig;
  enable_reasoning?: boolean;
  max_model_calls?: number;
  max_tool_calls?: number;
  model_settings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    systemPrompt?: string;
  };
}
