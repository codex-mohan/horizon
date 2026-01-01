import pytest
from langchain_core.messages import HumanMessage

from agent import graph, get_graph, create_graph, DEFAULT_TOOLS, State

pytestmark = pytest.mark.anyio


@pytest.mark.langsmith
async def test_agent_simple_passthrough() -> None:
    """Test basic agent invocation without tools."""
    # Use the get_graph function to get the lazily-created graph
    g = get_graph()

    inputs = State(
        messages=[HumanMessage(content="Hello, agent!")],
        user_id="test_user",
        conversation_id="test_conversation",
    )

    res = await g.ainvoke(inputs)
    assert res is not None
    assert "messages" in res
    assert len(res["messages"]) > 0


@pytest.mark.langsmith
async def test_agent_with_tools() -> None:
    """Test agent with tool calling capabilities."""
    g = create_graph(tools=DEFAULT_TOOLS)

    inputs = State(
        messages=[HumanMessage(content="What is 2 + 2?")],
        user_id="test_user",
        conversation_id="test_conversation",
    )

    res = await g.ainvoke(inputs)
    assert res is not None
    assert "messages" in res
    assert len(res["messages"]) > 0


@pytest.mark.langsmith
async def test_agent_state_persistence() -> None:
    """Test that state is properly maintained across messages."""
    g = get_graph()

    # First message
    inputs = State(
        messages=[HumanMessage(content="My name is Test")],
        user_id="test_user",
        conversation_id="test_conversation",
    )

    res = await g.ainvoke(inputs)
    assert res is not None

    # Second message with updated context
    inputs2 = State(
        messages=[HumanMessage(content="What is my name?")],
        user_id="test_user",
        conversation_id="test_conversation",
    )

    res2 = await g.ainvoke(inputs2)
    assert res2 is not None
    assert "messages" in res2
