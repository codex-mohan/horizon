from typing import Any, Optional
from abc import ABC, abstractmethod
from agent.state import AgentState
from rich.console import Console

console = Console()


class BaseMiddleware(ABC):
    """Base class for all middleware.
    
    Middleware lifecycle hooks (in order):
    1. before_agent: Run once before agent starts
    2. before_model: Run before each model call
    3. after_model: Run after each model call (before tools)
    4. after_tools: Run after tool execution (if tools were called)
    5. after_agent: Run once after agent completes
    """
    
    def __init__(self, name: str):
        self.name = name
    
    async def before_agent(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run once before agent starts."""
        return None
    
    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run before each model call."""
        return None
    
    async def after_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run after each model call."""
        return None
    
    async def after_tools(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run after tool execution (if tools were called)."""
        return None
    
    async def after_agent(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run once after agent completes."""
        return None
    
    async def __call__(self, state: AgentState) -> dict[str, Any]:
        """Default execution delegates to before_model."""
        result = await self.before_model(state)
        return result or {}