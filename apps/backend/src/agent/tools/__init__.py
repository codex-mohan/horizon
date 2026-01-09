"""Tool definitions for the agent."""

from langchain_core.tools import tool
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
from rich.console import Console

console = Console()

@tool("SearchWeb", description="Search the web for information on a given query.")
def search_web(query: str) -> str:
    """Search the web for information using duckduckgo."""
    try:
        response = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json"},
            timeout=5
        )
        results = response.json()
        return f"Search results for '{query}': {results.get('AbstractText', 'No results')}"
    except Exception as e:
        console.log(f"[red]Search error: {e}[/red]")
        return f"Search failed: {str(e)}"


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
def fetch_url(url: str) -> str:
    """Fetch content from a URL."""
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.content, 'html.parser')
        text = soup.get_text()[:500]
        return f"Content: {text}"
    except Exception as e:
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
def get_current_time() -> str:
    """Get the current date and time."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@tool
def json_parser(json_string: str) -> str:
    """Parse and validate JSON."""
    try:
        parsed = json.loads(json_string)
        return f"Valid JSON: {json.dumps(parsed, indent=2)[:200]}"
    except json.JSONDecodeError as e:
        return f"Invalid JSON: {str(e)}"


def get_all_tools():
    return [search_web, calculate, fetch_url, get_weather, get_current_time, json_parser]

__all__ = ["search_web", "calculate", "fetch_url", "get_weather", "get_current_time", "json_parser", "get_all_tools"]