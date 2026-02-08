"""Tool definitions for the agent."""

from langchain_core.tools import tool
import requests
from bs4 import BeautifulSoup
import json
from rich.console import Console

console = Console()

# Import web tools from the web module
from .web import (
    search_web,
    fetch_url_content,
    fetch_url_markdown,
    extract_page_metadata,
    download_image,
    get_media_info,
    find_urls,
    extract_structured_data,
    scrape_sitemap,
    get_all_web_tools as get_all_web_tools_from_module,
)

# Import shell tools for system command execution
from .shell import (
    run_shell_command,
    run_interactive_command,
    get_session_info,
    list_sessions,
    close_session,
    get_all_shell_tools as get_all_shell_tools_from_module,
)


@tool
def calculate(expression: str) -> str:
    """Calculate a mathematical expression."""
    try:
        result = eval(expression, {"__builtins__": {}})
        return f"Result: {result}"
    except Exception as e:
        console.log(f"[red]Calculation error: {e}[/red]")
        return f"Error: {str(e)}"


@tool
def get_weather(city: str) -> str:
    """Get current weather for a city."""
    weather_data = {
        "Tokyo": "Sunny, 22°C",
        "London": "Cloudy, 15°C",
        "New York": "Rainy, 18°C"
    }
    return weather_data.get(city, f"No data for {city}")


@tool
def json_parser(json_string: str) -> str:
    """Parse and validate JSON."""
    try:
        parsed = json.loads(json_string)
        return f"Valid JSON: {json.dumps(parsed, indent=2)[:200]}"
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {str(e)}"


def get_all_tools():
    """Get all tools including web and shell tools."""
    utility_tools = [calculate, get_weather, json_parser]
    web_tools = get_all_web_tools_from_module()
    shell_tools = get_all_shell_tools_from_module()
    return web_tools + shell_tools + utility_tools


# Re-export tools for backwards compatibility
__all__ = [
    # Web tools
    "search_web",
    "fetch_url_content",
    "fetch_url_markdown",
    "extract_page_metadata",
    "download_image",
    "get_media_info",
    "find_urls",
    "extract_structured_data",
    "scrape_sitemap",
    
    # Shell execution tools
    "run_shell_command",
    "run_interactive_command",
    "get_session_info",
    "list_sessions",
    "close_session",
    
    # Utility tools
    "calculate",
    "get_weather",
    "json_parser",
    
    # Functions
    "get_all_tools",
]

