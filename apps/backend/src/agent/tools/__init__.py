"""Tool definitions for the agent."""

from langchain_core.tools import tool
import requests
from bs4 import BeautifulSoup
import json
from datetime import datetime
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

# Import lightweight file operations tools from file_ops_lite
from .file_ops_lite import (
    read_file,
    write_file,
    append_file,
    copy_file,
    move_file,
    delete_file,
    list_dir,
    create_dir,
    remove_dir,
    glob,
    search_text,
    get_file_info,
    file_checksum,
    compare_files,
    replace_text,
    get_all_file_ops_tools as get_all_file_ops_tools_from_module,
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
    """Get all tools including web and file operations tools."""
    non_web_tools = [calculate, get_weather, get_current_time, json_parser]
    web_tools = get_all_web_tools_from_module()
    file_ops_tools = get_all_file_ops_tools_from_module()
    return web_tools + file_ops_tools + non_web_tools


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
    
    # File operations tools (lite version)
    "read_file",
    "write_file",
    "append_file",
    "copy_file",
    "move_file",
    "delete_file",
    "list_dir",
    "create_dir",
    "remove_dir",
    "glob",
    "search_text",
    "get_file_info",
    "file_checksum",
    "compare_files",
    "replace_text",
    
    # Utility tools
    "calculate",
    "get_weather",
    "get_current_time",
    "json_parser",
    
    # Functions
    "get_all_tools",
]
