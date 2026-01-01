"""Basic tools for the LangGraph agent.

This module provides a collection of common tools that can be
used by the agent to perform various tasks.
"""

from langchain_core.tools import tool
from datetime import datetime
from typing import Optional


@tool
def get_current_time(timezone: Optional[str] = None) -> str:
    """Get the current time.

    Args:
        timezone: Optional timezone string (e.g., 'America/New_York', 'UTC', 'Asia/Calcutta')

    Returns:
        Formatted current time string
    """
    now = datetime.now()

    if timezone:
        import pytz
        try:
            tz = pytz.timezone(timezone)
            now = now.astimezone(tz)
        except pytz.UnknownTimeZoneError:
            pass

    return now.strftime("%Y-%m-%d %H:%M:%S %Z")


@tool
def calculate(expression: str) -> str:
    """Evaluate a mathematical expression.

    Args:
        expression: A mathematical expression to evaluate (e.g., "2 + 2", "10 * 5 - 3")

    Returns:
        The result of the calculation as a string
    """
    try:
        # Safe evaluation for basic math - only allow digits and operators
        allowed_chars = set("0123456789+-*/(). ")
        if not all(c in allowed_chars for c in expression):
            return "Error: Invalid characters in expression"

        result = eval(expression)
        return str(result)
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def get_length(text: str) -> str:
    """Get the length of a text string.

    Args:
        text: The text to measure

    Returns:
        The character count of the text
    """
    return str(len(text))


@tool
def echo(message: str, uppercase: bool = False) -> str:
    """Echo back a message with optional transformation.

    Args:
        message: The message to echo back
        uppercase: If True, convert to uppercase

    Returns:
        The echoed message
    """
    if uppercase:
        return message.upper()
    return message


# Default list of available tools
DEFAULT_TOOLS = [
    get_current_time,
    calculate,
    get_length,
    echo,
]
