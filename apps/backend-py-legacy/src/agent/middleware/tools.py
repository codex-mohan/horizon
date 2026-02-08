"""Tool execution middleware."""

from langgraph.prebuilt import ToolNode
from agent.middleware.base import console, log_middleware_error, logger
from langchain_core.messages import ToolMessage
import traceback


class ToolNodeWithMiddleware(ToolNode):
    """Enhanced tool node with logging and graceful error handling."""
    
    async def ainvoke(self, state, config=None):
        """Execute tools with proper error handling and logging."""
        last_message = state["messages"][-1]
        
        if not hasattr(last_message, "tool_calls") or not last_message.tool_calls:
            return state
        
        tools = [tc['name'] for tc in last_message.tool_calls]
        console.print(f"[blue]🔧 [Tools] Executing: {', '.join(tools)}[/blue]")
        
        try:
            result = await super().ainvoke(state, config)
            console.print(f"[green]✅ [Tools] Completed successfully[/green]")
            result["tool_calls"] = state.get("tool_calls", 0) + len(last_message.tool_calls)
            return result
            
        except Exception as e:
            # Log the error with rich formatting
            log_middleware_error("ToolNode", e, context=f"Executing tools: {', '.join(tools)}")
            
            # Create error tool messages for each failed tool call
            error_messages = []
            for tool_call in last_message.tool_calls:
                error_msg = ToolMessage(
                    content=f"Error executing tool '{tool_call['name']}': {str(e)}",
                    tool_call_id=tool_call['id'],
                    name=tool_call['name'],
                )
                error_messages.append(error_msg)
            
            console.print(f"[red]❌ [Tools] Failed with error: {type(e).__name__}[/red]")
            logger.error(f"Tool execution failed: {traceback.format_exc()}")
            
            # Return the state with error messages instead of crashing
            return {
                "messages": error_messages,
                "tool_calls": state.get("tool_calls", 0) + len(last_message.tool_calls),
                "_tool_errors": [{
                    "tool": tc['name'],
                    "error": str(e),
                    "error_type": type(e).__name__,
                } for tc in last_message.tool_calls]
            }