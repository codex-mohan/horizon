"""Tool execution middleware."""

from langgraph.prebuilt import ToolNode
from agent.middleware.base import console


class ToolNodeWithMiddleware(ToolNode):
    """Enhanced tool node with logging."""
    
    async def ainvoke(self, state, config=None):
        last_message = state["messages"][-1]
        
        if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
            return state
        
        tools = [tc['name'] for tc in last_message.tool_calls]
        console.log(f"[blue]🔧 [Tools] Executing: {', '.join(tools)}[/blue]")
        
        result = await super().ainvoke(state, config)
        
        console.log(f"[green]✅ [Tools] Completed[/green]")
        result["tool_calls"] = state.get("tool_calls", 0) + len(last_message.tool_calls)
        
        return result