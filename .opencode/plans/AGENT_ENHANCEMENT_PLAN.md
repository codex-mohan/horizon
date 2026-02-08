# Enhanced Agent Implementation Plan

## Current State Analysis

### Existing Architecture

The current agent (`apps/backend/src/agent/graph.ts`) implements a basic ReAct pattern with:

- **Simple Model Node**: Calls LLM with tool binding
- **Tool Node**: Executes tools via `ToolNode` from LangGraph prebuilt
- **Conditional Edge**: Routes between model and tools based on tool calls
- **FileSystem Checkpointer**: Persists state to JSON file
- **Basic State**: Messages, model_calls, token_usage, metadata

### Current Limitations

1. **No Middleware Chain**: Missing start/end processing hooks
2. **No Human-in-the-Loop**: Tools execute automatically without approval
3. **Basic ReAct**: Missing explicit reasoning and acting phases
4. **Limited Observability**: No token tracking, rate limiting, or retry logic
5. **No Interrupt Support**: Cannot pause execution for human input

## Proposed Architecture

### Enhanced State Schema

```typescript
// New fields to add to AgentStateAnnotation
{
  // Interrupt handling
  interrupt_status: 'idle' | 'waiting_approval' | 'approved' | 'rejected'
  interrupt_data: {
    tool_call_id: string
    tool_name: string
    tool_args: Record<string, any>
    requested_at: string
  }

  // Tool tracking
  pending_tool_calls: ToolCall[]
  executed_tool_calls: ToolCall[]

  // Middleware metrics
  start_time: number
  end_time: number
  middleware_metrics: {
    token_usage: { input: number; output: number }
    rate_limit_hits: number
    retries: number
    processing_time_ms: number
  }

  // ReAct tracking
  reasoning_steps: ReasoningStep[]
  action_steps: ActionStep[]

  // Configuration (passed via config.configurable)
  requires_approval: string[]  // List of tool names requiring approval
}
```

### Graph Structure

```
START
  ↓
[Start Middleware Node]
  - PII Detection
  - Rate Limiting
  - Token Tracking Init
  - Input Validation
  ↓
[Reasoning Node] (Enhanced ReAct)
  - Explicit reasoning before action
  - Generate thoughts about approach
  ↓
[Action Node / Model Node]
  - LLM call with tools
  - Returns tool calls or final answer
  ↓
[Conditional: has tool calls?]
  ├─ No → [End Middleware Node] → END
  └─ Yes → [Interrupt/Approval Gate]
            ├─ Tool requires approval?
            │   ├─ Yes → [Interrupt Node] → WAIT FOR HUMAN
            │   └─ No → [Tool Execution Node]
            └─ Execute tool with retry logic
              ↓
            [Observation Node] → Back to Reasoning
```

### Middleware Architecture

LangGraph doesn't have traditional middleware like Express.js. Instead, we implement "middleware nodes" that wrap the core logic:

#### 1. Start Middleware Node

Executes before main agent logic:

- **PII Detection** (already exists, needs enhancement)
- **Rate Limiting**: Check API quota and rate limits
- **Token Tracking**: Initialize token counters
- **Input Validation**: Validate user input format
- **Context Enrichment**: Add system time, user context, etc.

#### 2. End Middleware Node

Executes after agent completes:

- **Token Aggregation**: Sum up total token usage
- **Metrics Logging**: Record execution time, success/failure
- **State Cleanup**: Remove temporary state
- **Post-processing**: Format final response

#### 3. Tool Approval Gate (Human-in-the-Loop)

New node for handling interrupts:

```typescript
const approvalGateNode = async (state: AgentState) => {
  const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  const toolCalls = lastMessage.tool_calls || [];

  // Filter tools requiring approval
  const requiresApproval = state.config?.requires_approval || [];
  const pendingApprovals = toolCalls.filter((tc) =>
    requiresApproval.includes(tc.name),
  );

  if (pendingApprovals.length > 0 && state.interrupt_status !== "approved") {
    // Trigger interrupt for first pending tool
    const toolCall = pendingApprovals[0];
    return interrupt({
      type: "tool_approval",
      tool_call_id: toolCall.id,
      tool_name: toolCall.name,
      tool_args: toolCall.args,
      message: `Approve execution of ${toolCall.name}?`,
    });
  }

  return {}; // Continue to tool execution
};
```

### Human-in-the-Loop Implementation

#### Backend: Using LangGraph `interrupt()`

```typescript
import { interrupt, Command } from "@langchain/langgraph";

// In the graph node where we need approval
const toolApprovalNode = async (state: AgentState) => {
  // This pauses execution and returns control to caller
  const userResponse = await interrupt({
    type: "tool_approval_required",
    tool_calls: state.pending_tool_calls,
    message: "The agent wants to execute the following tools. Approve?",
  });

  // Execution resumes here when user sends Command(resume=...)
  if (userResponse === "approved") {
    return {
      interrupt_status: "approved",
      approved_tool_calls: state.pending_tool_calls,
    };
  } else {
    return {
      interrupt_status: "rejected",
      rejection_reason: userResponse,
    };
  }
};
```

#### Frontend: Handling Interrupts

The frontend already uses `useStream` from `@langchain/langgraph-sdk/react`. This hook handles interrupts automatically by emitting events:

```typescript
// In useChat hook - already exists, needs enhancement
const stream = useStream<ChatState>({
  apiUrl,
  assistantId,
  onInterrupt: (interrupt) => {
    // Handle interrupt - show approval UI
    if (interrupt.value?.type === "tool_approval_required") {
      setPendingApproval(interrupt.value);
    }
  },
});

// Resume after approval
const approveTool = () => {
  stream.submit(undefined, {
    command: { resume: "approved" },
  });
};

const rejectTool = (reason: string) => {
  stream.submit(undefined, {
    command: { resume: `rejected: ${reason}` },
  });
};
```

### ReAct Pattern Enhancement

Current implementation mixes reasoning and acting. We should separate them:

```typescript
// 1. Reasoning Node - explicit thought generation
const reasoningNode = async (state: AgentState) => {
  const llm = await createLLM();

  // Add reasoning prompt
  const reasoningPrompt = new SystemMessage(
    "Think step by step about how to solve this task. " +
      "Describe your reasoning process before taking any action.",
  );

  const messages = [reasoningPrompt, ...state.messages];
  const response = await llm.invoke(messages);

  return {
    messages: [response],
    reasoning_steps: [
      ...(state.reasoning_steps || []),
      {
        step: state.reasoning_steps?.length || 0,
        thought: response.content,
        timestamp: Date.now(),
      },
    ],
  };
};

// 2. Action Node - execute based on reasoning
const actionNode = async (state: AgentState) => {
  const llm = await createLLM();
  const llmWithTools = llm.bindTools(tools);

  // Now act based on previous reasoning
  const response = await llmWithTools.invoke(state.messages);

  return {
    messages: [response],
    action_steps: [
      ...(state.action_steps || []),
      {
        step: state.action_steps?.length || 0,
        action: response.tool_calls ? "tool_call" : "response",
        timestamp: Date.now(),
      },
    ],
  };
};
```

## Implementation Files

### 1. `apps/backend/src/agent/middleware/start.ts`

Start middleware implementations

### 2. `apps/backend/src/agent/middleware/end.ts`

End middleware implementations

### 3. `apps/backend/src/agent/middleware/approval.ts`

Human-in-the-loop approval node

### 4. `apps/backend/src/agent/middleware/token-tracker.ts`

Token usage tracking

### 5. `apps/backend/src/agent/middleware/rate-limiter.ts`

Rate limiting logic

### 6. `apps/backend/src/agent/nodes/reasoning.ts`

ReAct reasoning node

### 7. `apps/backend/src/agent/nodes/action.ts`

ReAct action node

### 8. `apps/backend/src/agent/graph-enhanced.ts`

Enhanced graph with all middleware

### 9. `apps/backend/src/agent/state.ts` (Update)

Add new state fields

### 10. `apps/backend/src/index.ts` (Update)

Add interrupt handling endpoints

### 11. `apps/web/components/chat/tool-approval-dialog.tsx` (New)

Frontend approval UI component

### 12. `apps/web/lib/chat.ts` (Update)

Handle interrupt events in useChat hook

## Configuration

All middleware should be configurable via environment variables (already in config.ts):

```env
# Feature flags
ENABLE_PII_DETECTION=true
ENABLE_RATE_LIMITING=true
ENABLE_TOKEN_TRACKING=true
ENABLE_TOOL_RETRY=true
ENABLE_TOOL_APPROVAL=true

# Tool approval - comma-separated list
TOOLS_REQUIRE_APPROVAL=shell_execute,file_write,system_command

# Rate limiting
RATE_LIMIT_WINDOW=60
RATE_LIMIT_MAX_REQUESTS=100

# Retry settings
MAX_RETRIES=3
RETRY_DELAY_MS=1000
```

## Migration Strategy

1. **Phase 1**: Implement enhanced state schema (backward compatible)
2. **Phase 2**: Add middleware nodes without changing flow
3. **Phase 3**: Implement interrupt mechanism
4. **Phase 4**: Add frontend approval UI
5. **Phase 5**: Add ReAct reasoning/action separation
6. **Phase 6**: Testing and refinement

## Key Technical Decisions

1. **Use LangGraph's native `interrupt()`**: This is the recommended approach for HITL in LangGraph (not breakpoints)
2. **Middleware as Nodes**: Since LangGraph doesn't have Express-like middleware, we use wrapper nodes
3. **Configurable Pipeline**: All features can be toggled via config
4. **Graceful Degradation**: If middleware fails, agent continues with warnings
5. **State-Based Interrupts**: Store interrupt status in state for persistence across restarts

## Testing Checklist

- [ ] Start middleware executes before agent logic
- [ ] PII detection blocks/queries with sensitive data
- [ ] Rate limiting prevents excessive API calls
- [ ] Token tracking accurately counts input/output tokens
- [ ] Interrupt pauses execution and emits event
- [ ] Frontend displays approval dialog on interrupt
- [ ] Approval resumes execution with tool execution
- [ ] Rejection gracefully handles cancellation
- [ ] ReAct reasoning node generates thoughts
- [ ] Action node executes based on reasoning
- [ ] End middleware records metrics
- [ ] State persists across interruptions
- [ ] Multiple tool calls can be approved individually
- [ ] Configuration toggles disable features correctly
