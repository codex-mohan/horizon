"""Tracking and logging middleware."""

from agent.middleware.base import BaseMiddleware, console
from agent.state import AgentState
from typing import Optional, Any
import time
import re


class StartMiddleware(BaseMiddleware):
    """Initialize tracking at agent start."""
    
    def __init__(self):
        super().__init__("Start")
    
    async def __call__(self, state: AgentState) -> dict[str, Any]:
        console.log(f"[bold green]🚀 [{self.name}] Agent starting[/bold green]")
        return {
            "start_time": time.time(),
            "model_calls": 0,
            "tool_calls": 0,
            "total_tokens": 0
        }


class TokenCountMiddleware(BaseMiddleware):
    """Track token usage."""
    
    def __init__(self):
        super().__init__("TokenCount")
    
    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        messages = state["messages"]
        total_chars = sum(len(str(m.content)) for m in messages if hasattr(m, "content"))
        estimated_tokens = int(total_chars / 3.5)
        
        console.log(f"[cyan]📊 [{self.name}] ~{estimated_tokens:,} tokens[/cyan]")
        
        return {"total_tokens": estimated_tokens}


class PIIDetectionMiddleware(BaseMiddleware):
    """Detect PII in responses."""
    
    PII_PATTERNS = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
    }
    
    def __init__(self):
        super().__init__("PIIDetection")
    
    async def after_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        last_message = state["messages"][-1]
        
        if not hasattr(last_message, "content"):
            return None
        
        content = str(last_message.content)
        detected = []
        
        for pii_type, pattern in self.PII_PATTERNS.items():
            if re.search(pattern, content):
                detected.append(pii_type)
        
        if detected:
            console.log(f"[yellow]⚠️  [{self.name}] PII detected: {', '.join(detected)}[/yellow]")
        
        return None


class EndMiddleware(BaseMiddleware):
    """Finalize and log completion."""
    
    def __init__(self):
        super().__init__("End")
    
    async def __call__(self, state: AgentState) -> dict[str, Any]:
        elapsed = time.time() - state.get("start_time", time.time())
        
        console.log(f"[bold green]🏁 [{self.name}] Completed in {elapsed:.2f}s[/bold green]")
        console.log(f"   Model calls: {state.get('model_calls', 0)}")
        console.log(f"   Tool calls: {state.get('tool_calls', 0)}")
        
        return {}