import { MessagesValue, ReducedValue, StateSchema } from "@langchain/langgraph";
import { z } from "zod/v4";

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
 * Agent State Definition using StateSchema for LangSmith compatibility
 *
 * Core state for the agent graph:
 * - Message history (using MessagesValue for LangSmith chat support)
 * - Model/tool tracking
 * - Execution metrics
 * - UI streaming
 * - Routing flags
 */
export const AgentStateAnnotation = new StateSchema({
  // Core messages - MUST be visible in LangSmith, use MessagesValue for chat support
  messages: MessagesValue,

  // Model tracking
  model_calls: z.number().default(0),

  // Token usage
  token_usage: z
    .object({
      input: z.number().default(0),
      output: z.number().default(0),
      total: z.number().default(0),
    })
    .default(() => ({ input: 0, output: 0, total: 0 })),

  // Metadata (for memory context, etc.)
  metadata: z.record(z.string(), z.any()).default(() => ({})),

  // Tool tracking (for logging/debugging) - use ReducedValue for array accumulation
  executed_tool_calls: new ReducedValue(
    z.array(z.any()).default(() => []),
    {
      inputSchema: z.any(),
      reducer: (current, updates) => {
        const updatesArray = Array.isArray(updates)
          ? (updates as ToolCall[])
          : [updates as ToolCall];
        return [...(current as ToolCall[]), ...updatesArray];
      },
    }
  ),

  // Execution metadata
  start_time: z.number().default(0),
  end_time: z.number().default(0),

  // Middleware metrics
  middleware_metrics: new ReducedValue(
    z
      .object({
        token_usage: z.object({
          input: z.number(),
          output: z.number(),
          total: z.number(),
        }),
        rate_limit_hits: z.number(),
        retries: z.number(),
        pii_detected: z.boolean(),
        pii_types: z.array(z.string()),
        processing_time_ms: z.number(),
      })
      .default(() => ({
        token_usage: { input: 0, output: 0, total: 0 },
        rate_limit_hits: 0,
        retries: 0,
        pii_detected: false,
        pii_types: [],
        processing_time_ms: 0,
      })),
    {
      inputSchema: z.any(),
      reducer: (current, updates) => {
        const c = current as MiddlewareMetrics;
        const u = updates as Partial<MiddlewareMetrics>;
        return {
          token_usage: {
            input: (c.token_usage?.input ?? 0) + (u.token_usage?.input ?? 0),
            output: (c.token_usage?.output ?? 0) + (u.token_usage?.output ?? 0),
            total: (c.token_usage?.total ?? 0) + (u.token_usage?.total ?? 0),
          },
          rate_limit_hits: (c.rate_limit_hits ?? 0) + (u.rate_limit_hits ?? 0),
          retries: (c.retries ?? 0) + (u.retries ?? 0),
          pii_detected: u.pii_detected ?? c.pii_detected ?? false,
          pii_types: [...(c.pii_types ?? []), ...(u.pii_types ?? [])],
          processing_time_ms: u.processing_time_ms ?? c.processing_time_ms ?? 0,
        };
      },
    }
  ),

  // Error tracking
  errors: new ReducedValue(
    z.array(z.string()).default(() => []),
    {
      inputSchema: z.any(),
      reducer: (current, updates) => {
        const updatesArray = Array.isArray(updates) ? (updates as string[]) : [updates as string];
        return [...(current as string[]), ...updatesArray];
      },
    }
  ),

  // UI state for generative UI
  ui: new ReducedValue(
    z.array(z.any()).default(() => []),
    {
      inputSchema: z.any(),
      reducer: (current, updates) => {
        const updatesArray = Array.isArray(updates)
          ? (updates as UIMessage[])
          : [updates as UIMessage];
        const existingMap = new Map((current as UIMessage[]).map((msg) => [msg.id, msg]));
        for (const update of updatesArray) {
          const existing = existingMap.get(update.id);
          if (existing) {
            existingMap.set(update.id, {
              ...existing,
              props: { ...existing.props, ...update.props },
              metadata: { ...existing.metadata, ...update.metadata },
            });
          } else {
            existingMap.set(update.id, update);
          }
        }
        return Array.from(existingMap.values());
      },
    }
  ),

  // Tool rejection flag for routing decisions
  tools_rejected: z.boolean().default(false),
});

/**
 * AgentState type derived from the schema.
 * Manually defined because Zod v4 does not properly satisfy LangGraph's
 * SerializableSchema type constraints during TS inference, resulting in 'unknown'.
 */
export interface AgentState {
  messages: any[];
  model_calls: number;
  token_usage: { input: number; output: number; total: number };
  metadata: Record<string, any>;
  executed_tool_calls: ToolCall[];
  start_time: number;
  end_time: number;
  middleware_metrics: MiddlewareMetrics;
  errors: string[];
  ui: UIMessage[];
  tools_rejected: boolean;
}

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
