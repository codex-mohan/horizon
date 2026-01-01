"""LangGraph agent with LLM integration and tool calling capabilities.

This module provides a basic conversational agent built on LangGraph,
supporting message history, tool calls, and configurable LLM backends.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union

from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import BaseTool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph
from langgraph.prebuilt import ToolNode
from langgraph.runtime import Runtime
from typing_extensions import TypedDict


class Context(TypedDict):
    """Context parameters for the agent.

    Set these when creating assistants OR when invoking the graph.
    See: https://langchain-ai.github.io/langgraph/cloud/how-tos/configuration_cloud/
    """

    llm_model: str
    llm_temperature: float
    system_prompt: str


@dataclass
class State:
    """Input state for the agent.

    Defines the initial structure of incoming data.
    See: https://langchain-ai.github.io/langgraph/concepts/low_level/#state
    """

    messages: List[BaseMessage] = field(default_factory=list)
    user_id: str = ""
    conversation_id: str = ""
    context: Dict[str, Any] = field(default_factory=dict)


def create_llm(
    model: str = "gemini-1.5-flash",
    temperature: float = 0.7,
    api_key: Optional[str] = None,
    provider: str = "gemini",
) -> Union[ChatGoogleGenerativeAI, ChatOpenAI]:
    """Create an LLM instance for the agent.

    Args:
        model: The model name to use (e.g., "gemini-1.5-flash", "gpt-4o")
        temperature: The temperature for generation (0.0-1.0)
        api_key: Optional API key, will use env var if not provided
        provider: LLM provider ("gemini" or "openai")

    Returns:
        Configured LLM instance
    """
    if provider == "gemini":
        gemini_api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not gemini_api_key:
            raise ValueError("GEMINI_API_KEY environment variable is not set")
        return ChatGoogleGenerativeAI(
            model=model,
            temperature=temperature,
            api_key=gemini_api_key,
        )
    else:
        return ChatOpenAI(
            model=model,
            temperature=temperature,
            api_key=api_key,
        )


def create_agent_node(
    llm: Union[ChatGoogleGenerativeAI, ChatOpenAI],
    tools: Optional[List[BaseTool]] = None,
) -> callable:
    """Create an agent node that can use tools.

    Args:
        llm: The language model to use
        tools: Optional list of tools available to the agent

    Returns:
        An async function that processes state and returns updates
    """
    if tools:
        llm_with_tools = llm.bind_tools(tools)

        async def agent_node(state: State, runtime: Runtime[Context]) -> Dict[str, Any]:
            """Process input and returns output with optional tool calls."""
            system_prompt = runtime.context.get("system_prompt", "") if runtime.context else ""
            messages = list(state.messages)

            if system_prompt and not any(isinstance(m, SystemMessage) for m in messages):
                messages.insert(0, SystemMessage(content=system_prompt))

            response = await llm_with_tools.ainvoke(messages)

            return {
                "messages": [response],
            }
    else:
        async def agent_node(state: State, runtime: Runtime[Context]) -> Dict[str, Any]:
            """Process input and returns output without tools."""
            system_prompt = runtime.context.get("system_prompt", "") if runtime.context else ""
            messages = list(state.messages)

            if system_prompt and not any(isinstance(m, SystemMessage) for m in messages):
                messages.insert(0, SystemMessage(content=system_prompt))

            response = await llm.ainvoke(messages)

            return {
                "messages": [response],
            }

    return agent_node


def should_continue_tools(state: State) -> str:
    """Determine if we should continue to tool node or end.

    Args:
        state: The current graph state

    Returns:
        "tools" if the last message contains tool calls, "__end__" otherwise
    """
    last_message = state.messages[-1] if state.messages else None

    if last_message and hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    return "__end__"


def create_graph(
    llm: Optional[Union[ChatGoogleGenerativeAI, ChatOpenAI]] = None,
    tools: Optional[List[BaseTool]] = None,
    name: str = "Gemini Agent",
) -> StateGraph:
    """Create a LangGraph agent.

    Args:
        llm: Optional pre-configured LLM, will create default if not provided
        tools: Optional list of tools for the agent to use
        name: Name for the compiled graph

    Returns:
        Compiled StateGraph ready for execution
    """
    if llm is None:
        llm = create_llm()

    agent_node = create_agent_node(llm, tools)

    # Build the graph
    builder = StateGraph(State, context_schema=Context)

    # Add agent node
    builder.add_node("agent", agent_node)

    # Add tool node if tools are provided
    if tools:
        tool_node = ToolNode(tools)
        builder.add_node("tools", tool_node)

        # Set up edges
        builder.add_edge("__start__", "agent")
        builder.add_conditional_edges(
            "agent",
            should_continue_tools,
            {
                "tools": "tools",
                "__end__": "__end__",
            },
        )
        builder.add_edge("tools", "agent")
    else:
        # Simple graph without tools
        builder.add_edge("__start__", "agent")
        builder.add_edge("agent", "__end__")

    return builder.compile(name=name)


# Default graph instance (None until explicitly created)
graph = None


def get_graph() -> StateGraph:
    """Get or create the default graph instance.
    
    Returns:
        Compiled StateGraph ready for execution
    """
    global graph
    if graph is None:
        graph = create_graph()
    return graph


async def run_agent(
    input_message: str,
    user_id: str = "default",
    conversation_id: str = "default",
    context: Optional[Dict[str, Any]] = None,
) -> List[BaseMessage]:
    """Convenience function to run the agent with a single message.

    Args:
        input_message: The user's input message
        user_id: Optional user identifier
        conversation_id: Optional conversation identifier
        context: Optional runtime context

    Returns:
        List of messages from the conversation
    """
    initial_state = State(
        messages=[HumanMessage(content=input_message)],
        user_id=user_id,
        conversation_id=conversation_id,
        context=context or {},
    )

    config = {
        "configurable": {
            "llm_model": "gemini-1.5-flash",
            "llm_temperature": 0.7,
            "system_prompt": "You are a helpful AI assistant.",
        }
    }

    final_state = await get_graph().ainvoke(initial_state, config=config)

    return final_state.get("messages", [])
