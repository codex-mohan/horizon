# ============================================================================
# graph.py
# ============================================================================
"""Main graph construction with multi-provider LLM support and todo feedback loops."""

from langgraph.graph import StateGraph, START, END
from typing import Literal, Optional

from agent.state import AgentState
from agent.config import AgentConfig
from agent.llm_loader import create_llm, LLMConfig
from agent.tools import get_all_tools
from agent.middleware.memory import MemoryLoaderMiddleware
from agent.middleware.summarization import SummarizationMiddleware
from agent.middleware.model_call import ModelCallMiddleware
from agent.middleware.todo import (
    TodoMiddleware, 
    TodoPlannerMiddleware, 
    TodoProgressMiddleware,
    TodoCheckerMiddleware,
    ComplexityApproach
)
from agent.middleware.tracking import (
    StartMiddleware,
    TokenCountMiddleware,
    PIIDetectionMiddleware,
    EndMiddleware
)
from agent.middleware.tools import ToolNodeWithMiddleware


# ============================================================================
# Conditional Edge Functions
# ============================================================================

def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """Determine if the graph should continue to tools or end.
    
    This is the primary routing decision after model invocation.
    """
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"
    return "end"


def should_end_after_todo(state: AgentState) -> Literal["end", "continue"]:
    """Determine if we should end after todo check or continue with model.
    
    This routes the final response through todo checking before ending.
    """
    todo_list = state.get("todo_list")
    if not todo_list or not todo_list.get("tasks"):
        return "end"
    
    # Check if all tasks are completed
    from agent.todo import get_todo_list_summary
    summary = get_todo_list_summary(todo_list)
    if summary["pending"] == 0 and summary["in_progress"] == 0:
        return "end"
    
    return "continue"


def should_check_todo_completion(state: AgentState) -> Literal["todo_check", "continue"]:
    """Check if we need to evaluate todo completion status.
    
    After tools execution, check if:
    1. A task was completed
    2. Re-planning is needed
    3. All tasks are done
    """
    todo_list = state.get("todo_list")
    if not todo_list or not todo_list.get("tasks"):
        return "continue"
    
    # Check if re-planning was triggered
    if state.get("_needs_todo_replan"):
        return "todo_check"
    
    # Check if all tasks are completed
    from agent.todo import get_todo_list_summary
    summary = get_todo_list_summary(todo_list)
    if summary["pending"] == 0 and summary["in_progress"] == 0:
        # All done, continue to end
        return "continue"
    
    # Check if we need to set active task
    if not todo_list.get("active_task_id"):
        return "todo_check"
    
    return "continue"


def should_replan_or_continue(state: AgentState) -> Literal["todo_planner", "model"]:
    """Determine if re-planning is needed or if we should continue with model.
    
    After todo check, decide whether to:
    1. Re-plan the todo list (go to todo_planner)
    2. Continue with the current plan (go to model)
    
    Uses the _todo_route field set by TodoCheckerMiddleware.
    """
    route = state.get("_todo_route", "model")
    return route if route in ("todo_planner", "model") else "model"


# ============================================================================
# Graph Builder
# ============================================================================

def create_llm_from_config(config: AgentConfig):
    """Create an LLM instance from AgentConfig."""
    return create_llm(
        provider=config.provider if hasattr(config.provider, 'value') else None,
        model_name=config.model_name,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        api_key=config.api_key,
        base_url=config.base_url,
    )


def build_graph(config: AgentConfig = None):
    """Build the agent graph with middleware and todo feedback loops.
    
    Graph Structure with Feedback Loops:
    ```
    START → start → memory → token_count → summarize → todo → todo_planner
           → model → [tools|end] 
           tools → todo_progress → [todo_check]
           todo_check → [todo_planner|model]
           end → END
    ```
    
    Key Improvements:
    1. TodoProgressMiddleware runs after tools execution
    2. Conditional edge checks todo completion status
    3. Feedback loop triggers re-planning when needed
    4. Active task is automatically set after task completion
    """
    config = config or AgentConfig.from_env()
    tools = get_all_tools()
    
    # Use multi-provider LLM loader
    llm = create_llm_from_config(config)
    
    workflow = StateGraph(AgentState)
    
    # -------------------------------------------------------------------------
    # Node Creation
    # -------------------------------------------------------------------------
    
    workflow.add_node("start", StartMiddleware())
    
    if config.enable_memory_loader:
        workflow.add_node("memory", MemoryLoaderMiddleware())
    
    if config.enable_token_tracking:
        workflow.add_node("token_count", TokenCountMiddleware())
    
    if config.enable_summarization:
        workflow.add_node("summarize", SummarizationMiddleware(config.summarization_threshold, config))
    
    if config.enable_todo_list or config.enable_todo_planner:
        workflow.add_node("todo", TodoMiddleware(enabled=config.enable_todo_list))
        if config.enable_todo_planner:
            workflow.add_node(
                "todo_planner",
                TodoPlannerMiddleware(
                    enabled=config.enable_todo_planner,
                    approach=ComplexityApproach(config.todo_complexity_approach),
                ),
            )
            # Add TodoProgressMiddleware for post-tools feedback loop
            workflow.add_node(
                "todo_progress",
                TodoProgressMiddleware(enabled=config.enable_todo_planner),
            )
            # Add TodoCheckerMiddleware for conditional routing
            workflow.add_node(
                "todo_check",
                TodoCheckerMiddleware(enabled=config.enable_todo_planner),
            )
    
    workflow.add_node("model", ModelCallMiddleware(llm, tools, config))
    
    if config.enable_pii_detection:
        workflow.add_node("pii_detect", PIIDetectionMiddleware())
    
    workflow.add_node("tools", ToolNodeWithMiddleware(tools))
    workflow.add_node("end", EndMiddleware())
    
    # -------------------------------------------------------------------------
    # Edge Creation (Linear Flow)
    # -------------------------------------------------------------------------
    
    workflow.add_edge(START, "start")
    
    current = "start"
    if config.enable_memory_loader:
        workflow.add_edge(current, "memory")
        current = "memory"
    
    if config.enable_token_tracking:
        workflow.add_edge(current, "token_count")
        current = "token_count"
    
    if config.enable_summarization:
        workflow.add_edge(current, "summarize")
        current = "summarize"
    
    if config.enable_todo_list or config.enable_todo_planner:
        workflow.add_edge(current, "todo")
        current = "todo"
        if config.enable_todo_planner:
            workflow.add_edge(current, "todo_planner")
            current = "todo_planner"
    
    workflow.add_edge(current, "model")
    
    # -------------------------------------------------------------------------
    # Conditional Edges (Primary Routing)
    # -------------------------------------------------------------------------
    
    # Model decides: tools or end_flow
    workflow.add_conditional_edges(
        "model",
        should_continue,
        {"tools": "tools", "end": "end_flow"}
    )
    
    # Create end_flow node for final routing
    workflow.add_node("end_flow", EndMiddleware())
    
    # Tools to Todo Feedback Loop
    if config.enable_todo_planner:
        # After tools, run todo_progress to analyze results
        workflow.add_edge("tools", "todo_progress")
        
        # After todo_progress, check if we need to evaluate completion
        workflow.add_conditional_edges(
            "todo_progress",
            should_check_todo_completion,
            {"todo_check": "todo_check", "continue": "end_flow"}
        )
        
        # Todo check decides: re-plan or continue with model
        workflow.add_conditional_edges(
            "todo_check",
            should_replan_or_continue,
            {"todo_planner": "todo_planner", "model": "model"}
        )
    else:
        workflow.add_edge("tools", "end_flow")
    
    # End flow: check if we should end or continue (handles PII via pii_detect if enabled)
    if config.enable_pii_detection:
        # Route end_flow to pii_detect first
        workflow.add_edge("end_flow", "pii_detect")
        # After PII detection, check if we should end or continue
        workflow.add_conditional_edges(
            "pii_detect",
            should_end_after_todo,
            {"end": "end", "continue": "model"}
        )
    else:
        # Direct end flow with todo checking
        workflow.add_conditional_edges(
            "end_flow",
            should_end_after_todo,
            {"end": "end", "continue": "model"}
        )
    
    # -------------------------------------------------------------------------
    # Final Edges
    # -------------------------------------------------------------------------
    
    workflow.add_edge("end", END)
    
    return workflow.compile()


# Default graph instance
graph = build_graph()


# =============================================================================
# Convenience Functions (for backward compatibility)
# =============================================================================

def get_default_llm():
    """Get the default LLM using environment variables."""
    return create_llm()


# Alias for backward compatibility
create_llm_module = create_llm
