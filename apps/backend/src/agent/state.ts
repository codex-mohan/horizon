import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

/**
 * Tool Call Definition
 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, any>;
  result?: string;
  error?: string;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "executing"
    | "completed"
    | "failed";
  retry_count: number;
  started_at?: number;
  completed_at?: number;
}

/**
 * Interrupt Status
 */
export type InterruptStatus =
  | "idle"
  | "waiting_approval"
  | "approved"
  | "rejected"
  | "error";

/**
 * Interrupt Data
 */
export interface InterruptData {
  type: "tool_approval" | "user_input" | "error";
  tool_call_id?: string;
  tool_name?: string;
  tool_args?: Record<string, any>;
  message: string;
  requested_at: string;
}

/**
 * Reasoning Step (ReAct Pattern)
 */
export interface ReasoningStep {
  step: number;
  thought: string;
  timestamp: number;
}

/**
 * Action Step (ReAct Pattern)
 */
export interface ActionStep {
  step: number;
  action: "tool_call" | "response" | "error";
  tool_calls?: ToolCall[];
  timestamp: number;
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
 * Agent State Definition
 * Enhanced version supporting:
 * - Human-in-the-Loop with interrupts
 * - Tool tracking and approval
 * - Middleware metrics
 * - ReAct pattern (reasoning + action)
 * - Execution metadata
 */
export const AgentStateAnnotation = Annotation.Root({
  // Core messages - MUST be visible in LangSmith
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Model tracking
  model_calls: Annotation<number>({
    reducer: (x, y) => (x ?? 0) + (y ?? 0),
    default: () => 0,
  }),

  // Token usage
  token_usage: Annotation<{ input: number; output: number; total: number }>({
    reducer: (x, y) => ({
      input: (x?.input ?? 0) + (y?.input ?? 0),
      output: (x?.output ?? 0) + (y?.output ?? 0),
      total: (x?.total ?? 0) + (y?.total ?? 0),
    }),
    default: () => ({ input: 0, output: 0, total: 0 }),
  }),

  // Metadata
  metadata: Annotation<Record<string, any>>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

  // Interrupt handling
  interrupt_status: Annotation<InterruptStatus>({
    reducer: (x, y) => y ?? x ?? "idle",
    default: () => "idle",
  }),

  interrupt_data: Annotation<InterruptData | null>({
    reducer: (x, y) => y ?? x ?? null,
    default: () => null,
  }),

  // Tool tracking
  pending_tool_calls: Annotation<ToolCall[]>({
    reducer: (x, y) => y ?? x ?? [],
    default: () => [],
  }),

  executed_tool_calls: Annotation<ToolCall[]>({
    reducer: (x, y) => [...(x ?? []), ...(y ?? [])],
    default: () => [],
  }),

  rejected_tool_calls: Annotation<ToolCall[]>({
    reducer: (x, y) => [...(x ?? []), ...(y ?? [])],
    default: () => [],
  }),

  // ReAct tracking
  reasoning_steps: Annotation<ReasoningStep[]>({
    reducer: (x, y) => [...(x ?? []), ...(y ?? [])],
    default: () => [],
  }),

  action_steps: Annotation<ActionStep[]>({
    reducer: (x, y) => [...(x ?? []), ...(y ?? [])],
    default: () => [],
  }),

  // Execution metadata
  start_time: Annotation<number>({
    reducer: (x, y) => y ?? x ?? 0,
    default: () => 0,
  }),

  end_time: Annotation<number>({
    reducer: (x, y) => y ?? x ?? 0,
    default: () => 0,
  }),

  middleware_metrics: Annotation<MiddlewareMetrics>({
    reducer: (x, y) => ({
      token_usage: {
        input: (x?.token_usage?.input ?? 0) + (y?.token_usage?.input ?? 0),
        output: (x?.token_usage?.output ?? 0) + (y?.token_usage?.output ?? 0),
        total: (x?.token_usage?.total ?? 0) + (y?.token_usage?.total ?? 0),
      },
      rate_limit_hits: (x?.rate_limit_hits ?? 0) + (y?.rate_limit_hits ?? 0),
      retries: (x?.retries ?? 0) + (y?.retries ?? 0),
      pii_detected: y?.pii_detected ?? x?.pii_detected ?? false,
      pii_types: [...(x?.pii_types ?? []), ...(y?.pii_types ?? [])],
      processing_time_ms: y?.processing_time_ms ?? x?.processing_time_ms ?? 0,
    }),
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
    reducer: (x, y) => [...(x ?? []), ...(y ?? [])],
    default: () => [],
  }),
});

export type AgentState = typeof AgentStateAnnotation.State;

/**
 * Configuration passed via RunnableConfig.configurable
 */
export interface AgentConfigurable {
  thread_id: string;
  checkpoint_id?: string;
  user_id?: string;
  requires_approval?: string[];
  enable_reasoning?: boolean;
  max_model_calls?: number;
  max_tool_calls?: number;
  enable_interrupt?: boolean;
}
