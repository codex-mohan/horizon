"""Web-related tools for the agent.

This module provides tools for web scraping, content extraction, and URL handling.
Uses trafilatura and markdownify for LLM-optimized content extraction.
"""

from langchain_core.tools import tool
from trafilatura import fetch_url, extract, extract_metadata
from markdownify import markdownify as html_to_markdown
import requests
from PIL import Image
from io import BytesIO
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse, urljoin
from rich.console import Console

console = Console()


@tool("search_web", description="Search the web for information using DuckDuckGo.")
def search_web(query: str) -> str:
    """Search the web for information on a given query using DuckDuckGo.

    Args:
        query: The search query to look up.

    Returns:
        Search results with relevant information.
    """
    try:
        response = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_html": "1"},
            timeout=5
        )
        results = response.json()

        # Format results
        abstract = results.get("AbstractText", "")
        related_topics = results.get("RelatedTopics", [])

        output_parts = [f"Search results for '{query}':\n"]

        if abstract:
            output_parts.append(f"\n## Summary\n{abstract}")

        if related_topics:
            output_parts.append("\n## Related Topics")
            for topic in related_topics[:5]:
                if isinstance(topic, dict):
                    title = topic.get("Text", "")
                    url = topic.get("FirstURL", "")
                    if title and url:
                        output_parts.append(f"- [{title}]({url})")

        return "\n".join(output_parts)

    except Exception as e:
        console.log(f"[red]Search error: {e}[/red]")
        return f"Search failed: {str(e)}"


@tool("fetch_url_content", description="Fetch and extract clean content from a URL in markdown format.")
def fetch_url_content(url: str, include_images: bool = True, include_metadata: bool = True) -> str:
    """Fetch content from a URL and convert it to LLM-optimized markdown.

    Uses trafilatura for high-quality content extraction and markdownify for HTML conversion.

    Args:
        url: The URL to fetch content from.
        include_images: Whether to include image URLs in the output.
        include_metadata: Whether to include page metadata (title, author, date).

    Returns:
        Extracted content in markdown format with optional metadata.
    """
    try:
        # Validate URL
        parsed = urlparse(url)
        if not parsed.scheme:
            url = "https://" + url

        # Fetch the page using trafilatura
        downloaded = fetch_url(url)

        if not downloaded:
            return f"Failed to fetch content from: {url}"

        # Extract content with metadata
        result = extract(
            downloaded,
            url=url,
            output_format='json',
            with_metadata=True,
            include_images=include_images,
        )

        if not result:
            # Fallback to basic extraction
            downloaded_basic = fetch_url(url)
            if downloaded_basic:
                markdown_content = extract(
                    downloaded_basic,
                    url=url,
                    output_format='markdown',
                )
                return f"# Content from {url}\n\n{markdown_content[:10000]}"
            return f"Failed to extract content from: {url}"

        # Parse the JSON result
        try:
            data = json.loads(result)
        except json.JSONDecodeError:
            # Result might already be a dict
            data = result

        # Handle both dict and list responses
        if isinstance(data, list) and len(data) > 0:
            data = data[0]

        if not isinstance(data, dict):
            return f"Unexpected result format from: {url}"

        # Build markdown output
        output_parts = []

        # Add metadata if requested
        if include_metadata:
            metadata = data.get("metadata", {})
            output_parts.append("---")
            output_parts.append(f"title: {metadata.get('title', 'Unknown')}")
            if metadata.get("author"):
                output_parts.append(f"author: {metadata.get('author')}")
            if metadata.get("date"):
                output_parts.append(f"date: {metadata.get('date')}")
            output_parts.append(f"url: {url}")
            output_parts.append("---")
            output_parts.append("")

        # Add main content
        main_content = data.get("text", data.get("maincontent", ""))
        if main_content:
            output_parts.append(main_content)
        else:
            output_parts.append("*No main content extracted*")

        # Add image URLs if requested
        if include_images:
            images = data.get("images", [])
            if images:
                output_parts.append("\n## Images Found")
                for img in images[:10]:  # Limit to 10 images
                    if isinstance(img, dict):
                        src = img.get("src", "")
                        alt = img.get("alt", "")
                        output_parts.append(f"- [{alt}]({src})")
                    elif isinstance(img, str):
                        output_parts.append(f"- []({img})")

        return "\n".join(output_parts)

    except Exception as e:
        console.log(f"[red]Fetch error: {e}[/red]")
        return f"Error fetching {url}: {str(e)}"


@tool("fetch_url_markdown", description="Fetch URL content and convert directly to markdown using markdownify.")
def fetch_url_markdown(url: str, max_length: int = 10000) -> str:
    """Fetch a URL and convert its HTML content to markdown.

    A simpler alternative to fetch_url_content that uses markdownify directly.

    Args:
        url: The URL to fetch.
        max_length: Maximum length of the returned content.

    Returns:
        Content converted to markdown format.
    """
    try:
        response = requests.get(url, timeout=10, headers={
            "User-Agent": "Mozilla/5.0 (compatible; Agent/1.0)"
        })
        response.raise_for_status()

        # Convert to markdown
        markdown_content = html_to_markdown(response.text, heading_style="atx")

        # Truncate if needed
        if len(markdown_content) > max_length:
            markdown_content = markdown_content[:max_length] + "\n\n... (truncated)"

        return f"# Page Content\n\n{markdown_content}"

    except requests.exceptions.RequestException as e:
        return f"Error fetching {url}: {str(e)}"


@tool("extract_page_metadata", description="Extract metadata from a URL without full content.")
def extract_page_metadata(url: str) -> str:
    """Extract metadata (title, description, images, links) from a URL.

    Args:
        url: The URL to analyze.

    Returns:
        JSON-formatted metadata about the page.
    """
    try:
        downloaded = fetch_url(url)

        if not downloaded:
            return json.dumps({"error": "Failed to fetch URL"}, indent=2)

        # Extract metadata
        result = extract(
            downloaded,
            url=url,
            output_format='json',
            with_metadata=True,
            only_with_metadata=True,
        )

        if result:
            try:
                data = json.loads(result)
                if isinstance(data, list) and len(data) > 0:
                    data = data[0]
                return json.dumps(data, indent=2)
            except json.JSONDecodeError:
                pass

        # Fallback: extract metadata using extract_metadata
        metadata = extract_metadata(downloaded, url=url)
        if metadata:
            return json.dumps(dict(metadata), indent=2)

        return json.dumps({"error": "No metadata found"}, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)}, indent=2)


@tool("download_image", description="Download and analyze an image from a URL.")
def download_image(url: str, analyze: bool = False) -> str:
    """Download an image from a URL and optionally analyze it.

    Args:
        url: The image URL to download.
        analyze: Whether to analyze the image (get dimensions, format, size).

    Returns:
        Image information and optionally base64-encoded preview.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        image = Image.open(BytesIO(response.content))

        info = {
            "url": url,
            "format": image.format,
            "mode": image.mode,
            "size_mb": len(response.content) / (1024 * 1024),
        }

        if analyze:
            info["dimensions"] = {"width": image.width, "height": image.height}
            info["aspect_ratio"] = round(image.width / image.height, 2) if image.height > 0 else 0

        return json.dumps(info, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)}, indent=2)


@tool("get_media_info", description="Get information about media files (images, videos, audio) from a URL.")
def get_media_info(url: str) -> str:
    """Get information about media files at a URL.

    Args:
        url: The media URL to analyze.

    Returns:
        JSON-formatted media information.
    """
    try:
        parsed = urlparse(url)
        extension = parsed.path.split(".")[-1].lower() if "." in parsed.path else ""

        # Common media extensions
        image_exts = {"jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"}
        video_exts = {"mp4", "webm", "mov", "avi", "mkv", "flv"}
        audio_exts = {"mp3", "wav", "ogg", "flac", "m4a"}

        media_type = "unknown"
        if extension in image_exts:
            media_type = "image"
        elif extension in video_exts:
            media_type = "video"
        elif extension in audio_exts:
            media_type = "audio"

        # Get file info
        response = requests.head(url, timeout=5)
        content_length = response.headers.get("content-length", "0")
        content_type = response.headers.get("content-type", "unknown")

        info = {
            "url": url,
            "media_type": media_type,
            "extension": extension,
            "content_type": content_type,
            "estimated_size_mb": int(content_length) / (1024 * 1024) if content_length.isdigit() else "unknown",
        }

        return json.dumps(info, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)}, indent=2)


@tool("find_urls", description="Find all URLs on a webpage matching specific criteria.")
def find_urls(url: str, pattern: Optional[str] = None, limit: int = 20) -> str:
    """Find URLs on a webpage.

    Args:
        url: The page to scan for URLs.
        pattern: Optional regex pattern to filter URLs.
        limit: Maximum number of URLs to return.

    Returns:
        List of found URLs.
    """
    try:
        downloaded = fetch_url(url)

        if not downloaded:
            return json.dumps({"error": "Failed to fetch URL"}, indent=2)

        # Extract content with links
        result = extract(
            downloaded,
            url=url,
            output_format='json',
            include_links=True,
        )

        links = []
        if result:
            try:
                data = json.loads(result)
                if isinstance(data, list) and len(data) > 0:
                    data = data[0]
                links = data.get("links", [])
            except json.JSONDecodeError:
                pass

        if pattern:
            import re
            links = [link for link in links if re.search(pattern, str(link))]

        return json.dumps({
            "page": url,
            "total_found": len(links),
            "urls": links[:limit]
        }, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)}, indent=2)


@tool("extract_structured_data", description="Extract structured data (JSON-LD, microdata) from a webpage.")
def extract_structured_data(url: str) -> str:
    """Extract structured data (JSON-LD, schema.org data) from a webpage.

    Args:
        url: The URL to extract structured data from.

    Returns:
        Extracted structured data in JSON format.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, "html.parser")

        # Find JSON-LD scripts
        structured_data = []

        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
                structured_data.append(data)
            except (json.JSONDecodeError, TypeError):
                continue

        if not structured_data:
            return json.dumps({"message": "No structured data found"}, indent=2)

        return json.dumps(structured_data, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)}, indent=2)


@tool("scrape_sitemap", description="Extract all URLs from a sitemap.xml file.")
def scrape_sitemap(url: str) -> str:
    """Extract all URLs from a sitemap.xml file.

    Args:
        url: The sitemap URL to scrape.

    Returns:
        List of URLs found in the sitemap.
    """
    try:
        from trafilatura import sitemaps

        # Ensure it's a sitemap URL
        if not url.endswith(".xml"):
            url = url.rstrip("/") + "/sitemap.xml"

        downloaded = fetch_url(url)

        if not downloaded:
            return json.dumps({"error": "Failed to fetch sitemap"}, indent=2)

        # Use sitemap_search to find URLs
        urls = list(sitemaps.sitemap_search(downloaded, url))

        return json.dumps({
            "sitemap_url": url,
            "url_count": len(urls),
            "urls": [str(u) for u in urls[:50]]  # Limit to 50
        }, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)}, indent=2)


def get_all_web_tools() -> list:
    """Get all web-related tools."""
    return [
        search_web,
        fetch_url_content,
        fetch_url_markdown,
        extract_page_metadata,
        download_image,
        get_media_info,
        find_urls,
        extract_structured_data,
        scrape_sitemap,
    ]


__all__ = [
    "search_web",
    "fetch_url_content",
    "fetch_url_markdown",
    "extract_page_metadata",
    "download_image",
    "get_media_info",
    "find_urls",
    "extract_structured_data",
    "scrape_sitemap",
    "get_all_web_tools",
]
