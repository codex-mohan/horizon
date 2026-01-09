"""Agent state schema with memory and context fields."""

from typing import Annotated, TypedDict, Any
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    
    # Memory & Context
    user_preferences: dict[str, Any]
    long_term_memory: dict[str, Any]
    session_context: dict[str, Any]
    
    # Todo List
    todo_list: dict[str, Any]
    
    # Tracking
    model_calls: int
    tool_calls: int
    total_tokens: int
    start_time: float
    
    # Metadata
    session_id: str
    user_id: str
    metadata: dict[str, Any]
