"""Memory loading middleware."""

from agent.middleware.base import BaseMiddleware, console
from agent.state import AgentState
from typing import Optional, Any
from datetime import datetime


class MemoryLoaderMiddleware(BaseMiddleware):
    """Load long-term memory and user preferences into context."""
    
    def __init__(self):
        super().__init__("MemoryLoader")
    
    async def before_agent(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Load memory once at start."""
        console.log(f"[cyan]📚 [{self.name}] Loading long-term memory[/cyan]")
        
        # Simulate loading from database
        user_id = state.get("user_id", "default")
        
        long_term_memory = await self._load_memory(user_id)
        user_preferences = await self._load_preferences(user_id)
        
        return {
            "long_term_memory": long_term_memory,
            "user_preferences": user_preferences,
            "session_context": {
                "loaded_at": datetime.now().isoformat(),
                "memory_items": len(long_term_memory)
            }
        }
    
    async def _load_memory(self, user_id: str) -> dict:
        """Simulate loading user's long-term memory."""
        return {
            "facts": ["User prefers concise responses", "User is a developer"],
            "preferences": {"language": "en", "timezone": "UTC"}
        }
    
    async def _load_preferences(self, user_id: str) -> dict:
        """Simulate loading user preferences."""
        return {
            "tone": "professional",
            "detail_level": "medium",
            "format": "markdown"
        }