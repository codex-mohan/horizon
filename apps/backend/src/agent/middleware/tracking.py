"""Tracking and logging middleware."""

from agent.middleware.base import BaseMiddleware, console
from agent.state import AgentState
from typing import Optional, Any
import time


# Token threshold for warnings (adjust based on model context window)
TOKEN_WARNING_THRESHOLD = 6000
TOKEN_CRITICAL_THRESHOLD = 7000


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
            "total_tokens": 0,
            "input_tokens": 0,
            "output_tokens": 0,
            "token_warning_shown": False,
            "token_warning_message": "",
        }


class TokenTrackerMiddleware(BaseMiddleware):
    """Track actual tokens from model response.
    
    This middleware should be called AFTER the model node to capture
    actual token usage from the response metadata.
    """
    
    def __init__(self, warning_threshold: int = TOKEN_WARNING_THRESHOLD, 
                 critical_threshold: int = TOKEN_CRITICAL_THRESHOLD):
        super().__init__("TokenTracker")
        self.warning_threshold = warning_threshold
        self.critical_threshold = critical_threshold
    
    async def __call__(self, state: AgentState) -> dict[str, Any]:
        """Extract and accumulate token counts from model response."""
        # Get tokens from model response (set by ModelCallMiddleware)
        input_tokens = state.get("input_tokens", 0)
        output_tokens = state.get("output_tokens", 0)
        
        # Get previous accumulated totals
        prev_total = state.get("total_tokens", 0)
        
        # Accumulate total tokens
        new_total = prev_total + input_tokens + output_tokens
        
        console.log(f"[cyan]📊 [{self.name}] Model Input: {input_tokens:,}[/cyan]")
        console.log(f"[cyan]📊 [{self.name}] Model Output: {output_tokens:,}[/cyan]")
        console.log(f"[cyan]📊 [{self.name}] Previous Total: {prev_total:,}[/cyan]")
        console.log(f"[cyan]📊 [{self.name}] New Total: {new_total:,}[/cyan]")
        
        # Check for threshold warnings
        warning_message = ""
        if new_total >= self.critical_threshold:
            warning_message = """
<token_warning>
## ⚠️ CRITICAL: Token Limit Approaching
Your conversation is approaching the context limit. Please:
1. Summarize the conversation so far using the summarize tool if available
2. Consider what information can be discarded or abbreviated
3. Focus on completing the current task efficiently
4. Ask the user if they want to continue or start fresh
</token_warning>
"""
            console.log(f"[red]🚨 [{self.name}] CRITICAL threshold: {new_total:,}[/red]")
        elif new_total >= self.warning_threshold:
            warning_message = """
<token_warning>
## ⚠️ Token Usage Warning
Your conversation is getting longer. Consider:
- Summarizing completed parts of the conversation
- Removing redundant information from context
- Focusing on the current task
</token_warning>
"""
            console.log(f"[yellow]⚠️  [{self.name}] Warning threshold: {new_total:,}[/yellow]")
        
        return {
            "total_tokens": new_total,
            "token_warning_message": warning_message,
        }


class TokenWarningInjectorMiddleware(BaseMiddleware):
    """Inject token warning messages into the system prompt."""
    
    def __init__(self):
        super().__init__("TokenWarningInjector")
    
    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Inject token warning if threshold was reached."""
        warning_message = state.get("token_warning_message", "")
        
        if warning_message and not state.get("token_warning_shown", False):
            console.log(f"[yellow]⚠️  [{self.name}] Injecting token warning into system prompt[/yellow]")
            return {"token_warning_shown": True}
        
        return None


class PIIDetectionMiddleware(BaseMiddleware):
    """Detect PII in responses."""
    
    PII_PATTERNS = {
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone": r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'
    }
    
    def __init__(self):
        super().__init__("PIIDetection")
    
    async def after_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        if not state.get("messages"):
            return None
        
        last_message = state["messages"][-1]
        
        if not hasattr(last_message, "content"):
            return None
        
        import re
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
        
        # Recalculate all token values from messages to get accurate totals
        # (input_tokens/output_tokens in state only contain last call's values)
        input_tok = 0
        output_tok = 0
        
        # get the usage statistics from the last message if available
        if state.get("messages"):
            last_message = state["messages"][-1]
            usage_metadata = getattr(last_message, 'usage_metadata', None) or {}
            input_tok = usage_metadata.get('input_tokens', 0)
            output_tok = usage_metadata.get('output_tokens', 0)
        
        total_tok = input_tok + output_tok
        
        console.log(f"[cyan]📊 [{self.name}] Input Tokens: {input_tok:,}[/cyan]")
        console.log(f"[cyan]📊 [{self.name}] Output Tokens: {output_tok:,}[/cyan]")
        console.log(f"[cyan]📊 [{self.name}] Total Tokens: {total_tok:,}[/cyan]")
        
        return {}
