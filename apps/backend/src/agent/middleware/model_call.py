# middleware/model_call.py
# ============================================================================
"""Model call wrapper with retry, fallback, and todo integration."""

from agent.middleware.base import BaseMiddleware, console
from agent.state import AgentState
from agent.prompts.prompts import PromptBuilder
from langchain_core.messages import AIMessage, SystemMessage
from typing import Optional, Any
import asyncio


class ModelCallMiddleware(BaseMiddleware):
    """Wrap model calls with retry, fallback, and todo integration logic.
    
    This middleware:
    - Injects todo state into the system prompt
    - Retries on failure with exponential backoff
    - Tracks model calls
    """
    
    def __init__(self, llm, tools, config):
        super().__init__("ModelCall")
        self.llm = llm.bind_tools(tools)
        self.config = config
        self.prompt_builder = PromptBuilder(config)
    
    async def __call__(self, state: AgentState) -> dict[str, Any]:
        """Execute model call with retry and todo injection."""
        messages = state["messages"]
        
        # Inject todo state into system prompt
        messages = self._inject_todo_context(state, messages)
        
        for attempt in range(self.config.max_retries):
            try:
                console.log(f"[green]🤖 [{self.name}] Attempt {attempt + 1}[/green]")
                response = await self.llm.ainvoke(messages)
                
                return {
                    "messages": [response],
                    "model_calls": state.get("model_calls", 0) + 1
                }
            except Exception as e:
                console.log(f"[red]❌ [{self.name}] Error: {e}[/red]")
                if attempt == self.config.max_retries - 1:
                    return {
                        "messages": [AIMessage(content="Technical difficulties. Please try again.")],
                        "model_calls": state.get("model_calls", 0) + 1
                    }
                await asyncio.sleep(self.config.initial_delay * (self.config.backoff_factor ** attempt))
    
    def _inject_todo_context(self, state: AgentState, messages: list) -> list:
        """Inject todo context into the system prompt.
        
        This ensures the model knows:
        1. What tasks need to be completed
        2. Which task is currently active
        3. Progress towards completion
        """
        # Build the system prompt with todo context
        system_prompt = self.prompt_builder.build_system_prompt(state)
        
        # Check if first message is already a system message
        if messages and hasattr(messages[0], 'type') and messages[0].type == 'system':
            # Replace the existing system message
            messages[0] = SystemMessage(content=system_prompt)
        else:
            # Prepend a new system message
            messages = [SystemMessage(content=system_prompt)] + list(messages)
        
        return messages
