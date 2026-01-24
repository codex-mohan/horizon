"""
Agent Middleware System
Export the compiled graph for integration with existing LangGraph apps.
"""

import sys
from typing import TYPE_CHECKING

# Import types for type checking only
if TYPE_CHECKING:
    from agent.graph import graph, build_graph, get_graph, create_graph
    from agent.config import AgentConfig
    from agent.state import AgentState

from agent.config import AgentConfig
from agent.state import AgentState

# Alias for backwards compatibility
State = AgentState


def __getattr__(name):
    """Lazy loading for graph to avoid building at import time."""
    if name in ("graph", "build_graph", "get_graph", "create_graph"):
        # Use importlib to avoid circular imports
        from importlib import import_module

        graph_module = import_module("agent.graph", package="agent")
        result = getattr(graph_module, name)
        # Cache the result in the module's namespace
        globals()[name] = result
        return result
    if name == "DEFAULT_TOOLS":
        from agent.tools import get_all_tools

        result = get_all_tools()
        globals()[name] = result
        return result
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "graph",
    "build_graph",
    "get_graph",
    "create_graph",
    "DEFAULT_TOOLS",
    "AgentConfig",
    "AgentState",
    "State",
]
