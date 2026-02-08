# ============================================================================
# graph.py - SIMPLIFIED
# ============================================================================
"""Main graph construction without todo integration."""

from langgraph.graph import StateGraph, START, END
from typing import Literal

from agent.state import AgentState
from agent.config import AgentConfig
from agent.llm_loader import create_llm, LLMConfig
from agent.tools import get_all_tools
from agent.middleware.base import console
from agent.middleware.memory import MemoryLoaderMiddleware
from agent.middleware.summarization import SummarizationMiddleware
from agent.middleware.model_call import ModelCallMiddleware
from agent.middleware.tracking import (
    StartMiddleware,
    TokenTrackerMiddleware,
    PIIDetectionMiddleware,
    EndMiddleware,
)
from agent.middleware.tools import ToolNodeWithMiddleware

# Note: LangGraph API handles persistence automatically.
# For custom postgres connection, set POSTGRES_URI environment variable.
# See: https://langchain-ai.github.io/langgraph/cloud/reference/env_var/#postgres_uri_custom


# ============================================================================
# Conditional Edge Functions
# ============================================================================


def should_continue(state: AgentState) -> Literal["tools", "check_completion"]:
    """Determine routing after model call."""
    last_message = state["messages"][-1]
    model_calls = state.get("model_calls", 0)

    try:
        config = AgentConfig.from_env()
        max_calls = config.max_model_calls
    except:
        max_calls = 20

    if model_calls >= max_calls:
        console.log(f"[should_continue] Max model calls ({max_calls}) reached")
        return "check_completion"

    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        console.log(
            f"[should_continue] Model called {len(last_message.tool_calls)} tool(s)"
        )
        return "tools"

    console.log(f"[should_continue] No tools called, checking completion")
    return "check_completion"


def check_completion_routing(state: AgentState) -> Literal["model", "EndMiddleware"]:
    """Check if agent should continue or end."""
    model_calls = state.get("model_calls", 0)

    try:
        config = AgentConfig.from_env()
        max_calls = config.max_model_calls
    except:
        max_calls = 20

    # 1. HARD STOP: Check limits first
    if model_calls >= max_calls:
        console.log(f"[check_completion] Max calls reached, ending")
        return "EndMiddleware"

    # 2. STANDARD CHAT LOGIC
    # If no tools were called (why we are here), the LLM has finished its thought.
    console.log(f"[check_completion] Standard chat response complete. Ending.")
    return "EndMiddleware"


# ============================================================================
# Graph Builder
# ============================================================================


def create_llm_from_config(config: AgentConfig):
    """Create an LLM instance from AgentConfig."""
    # Get model settings from model_config if available
    if config.model_config is not None:
        model_cfg = config.model_config
        return create_llm(
            provider=model_cfg.provider.value if model_cfg.provider else None,
            model_name=model_cfg.model_name,
            temperature=model_cfg.temperature,
            max_tokens=model_cfg.max_tokens,
            base_url=model_cfg.base_url,
        )

    # Fallback for backward compatibility - provider is already a string from enum
    return create_llm(
        provider=config.provider.value if config.provider else None,
        model_name=config.model_name,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        base_url=config.base_url,
    )


def build_graph(config: AgentConfig = None):
    """Build the agent graph."""
    config = config or AgentConfig.from_env()
    tools = get_all_tools()

    llm = create_llm_from_config(config)
    workflow = StateGraph(AgentState)

    # ========================================================================
    # NODE DEFINITIONS
    # ========================================================================
    workflow.add_node("StartMiddleware", StartMiddleware())

    if config.enable_memory_loader:
        workflow.add_node("memory", MemoryLoaderMiddleware())

    if config.enable_summarization:
        workflow.add_node(
            "summarize", SummarizationMiddleware(config.summarization_threshold, config)
        )

    workflow.add_node("model", ModelCallMiddleware(llm, tools, config))

    if config.enable_token_tracking:
        workflow.add_node("token_tracker", TokenTrackerMiddleware())

    workflow.add_node("tools", ToolNodeWithMiddleware(tools))
    workflow.add_node("check_completion", lambda state: {})

    if config.enable_pii_detection:
        workflow.add_node("pii_detect", PIIDetectionMiddleware())

    workflow.add_node("EndMiddleware", EndMiddleware())

    # ========================================================================
    # LINEAR EDGES - Initial setup flow
    # ========================================================================
    workflow.add_edge(START, "StartMiddleware")

    current = "StartMiddleware"
    if config.enable_memory_loader:
        workflow.add_edge(current, "memory")
        current = "memory"

    if config.enable_summarization:
        workflow.add_edge(current, "summarize")
        current = "summarize"

    workflow.add_edge(current, "model")

    # ========================================================================
    # MAIN LOOP - Model -> Token Tracker -> Routing
    # ========================================================================

    # After model, decide what to do
    if config.enable_token_tracking:
        # Model -> Token Tracker (always)
        workflow.add_edge("model", "token_tracker")

        # Token Tracker -> Conditional routing
        workflow.add_conditional_edges(
            "token_tracker",
            should_continue,
            {"tools": "tools", "check_completion": "check_completion"},
        )
    else:
        # No token tracking - direct conditional from model
        workflow.add_conditional_edges(
            "model",
            should_continue,
            {"tools": "tools", "check_completion": "check_completion"},
        )

    # Tools always goes back to model to process results
    workflow.add_edge("tools", "model")

    # ========================================================================
    # COMPLETION ROUTING
    # ========================================================================
    workflow.add_conditional_edges(
        "check_completion",
        check_completion_routing,
        {"model": "model", "EndMiddleware": "EndMiddleware"},
    )

    # ========================================================================
    # FINAL EXIT
    # ========================================================================
    if config.enable_pii_detection:
        workflow.add_edge("EndMiddleware", "pii_detect")
        workflow.add_edge("pii_detect", END)
    else:
        workflow.add_edge("EndMiddleware", END)

    return workflow.compile()


# Default graph instance - lazy loaded to avoid building at import time
_graph_instance = None

# Default tools - loaded once
_default_tools = None


def get_graph():
    """Get the default graph instance (lazy loaded)."""
    global _graph_instance
    if _graph_instance is None:
        _graph_instance = build_graph()
    return _graph_instance


def create_graph(tools=None):
    """Create a new graph instance with optional custom tools.

    Args:
        tools: Optional list of tools to use. If None, uses default tools.

    Returns:
        Compiled StateGraph instance.
    """
    from agent.config import AgentConfig
    from agent.tools import get_all_tools

    config = AgentConfig.from_env()
    all_tools = tools if tools is not None else get_all_tools()

    # Build graph with the specified tools
    workflow = StateGraph(AgentState)

    # Add nodes (simplified version)
    from agent.middleware.tracking import StartMiddleware, EndMiddleware
    from agent.middleware.memory import MemoryLoaderMiddleware
    from agent.middleware.summarization import SummarizationMiddleware
    from agent.middleware.model_call import ModelCallMiddleware
    from agent.middleware.tools import ToolNodeWithMiddleware

    workflow.add_node("StartMiddleware", StartMiddleware())

    if config.enable_memory_loader:
        workflow.add_node("memory", MemoryLoaderMiddleware())

    if config.enable_summarization:
        workflow.add_node(
            "summarize", SummarizationMiddleware(config.summarization_threshold, config)
        )

    workflow.add_node(
        "model", ModelCallMiddleware(create_llm_from_config(config), all_tools, config)
    )
    workflow.add_node("tools", ToolNodeWithMiddleware(all_tools))
    workflow.add_node("check_completion", lambda state: {})
    workflow.add_node("EndMiddleware", EndMiddleware())

    # Add edges
    workflow.add_edge(START, "StartMiddleware")
    workflow.add_edge("StartMiddleware", "model")
    workflow.add_edge("tools", "model")
    workflow.add_edge("EndMiddleware", END)

    return workflow.compile()


def __getattr__(name):
    """Lazy loading for graph to avoid building at import time."""
    global _graph_instance
    if name == "graph":
        if _graph_instance is None:
            _graph_instance = build_graph()
        return _graph_instance
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def get_default_llm():
    """Get the default LLM using environment variables."""
    return create_llm()


create_llm_module = create_llm_from_config

# Default graph instance - eagerly loaded for LangGraph compatibility
graph = build_graph()
