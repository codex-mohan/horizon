"""Lightweight file operations tools for the agent."""

from langchain_core.tools import tool
from pathlib import Path
import os
import json
import shutil
import hashlib
from typing import Optional, Dict, Any, Union, Tuple
from datetime import datetime

def _validate_path(path: Union[str, Path]) -> Tuple[bool, str]:
    try:
        p = Path(path).resolve()
        if str(p).startswith('..') or '..' in str(p):
            return False, "Path traversal not allowed"
        return True, str(p)
    except (OSError, PermissionError):
        return False, "Invalid path"

def _get_info(path: Union[str, Path]) -> Dict[str, Any]:
    p = Path(path)
    try:
        stat = p.stat()
        return {
            "path": str(p), "name": p.name, "size": stat.st_size,
            "exists": p.exists(), "is_file": p.is_file(), "is_dir": p.is_dir(),
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat() if stat.st_mtime else None,
        }
    except (OSError, PermissionError):
        return {"path": str(p), "exists": False}

def _checksum(path: Union[str, Path], algo: str = "md5") -> str:
    try:
        h = hashlib.new(algo)
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                h.update(chunk)
        return h.hexdigest()
    except (OSError, PermissionError):
        return ""

def _to_bool(value) -> bool:
    """Convert string to bool, handling common string representations."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ("true", "1", "yes", "on")
    return bool(value)

@tool("read_file")
def read_file(path: str, encoding: str = "utf-8") -> str:
    """Read file contents.
    
    Args: path (required), encoding (default="utf-8").
    Returns: File contents or "Error: ...".
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    try:
        with open(result, 'r', encoding=encoding, errors='ignore') as f:
            return f.read()
    except FileNotFoundError:
        return f"Error: File not found"
    except PermissionError:
        return f"Error: Permission denied"

@tool("write_file")
def write_file(path: str, content: str, encoding: str = "utf-8") -> str:
    """Write content to file (creates if missing, overwrites if exists).
    
    Args: path (required), content (required), encoding (default="utf-8").
    Returns: "Wrote to {path}" or "Error: ...".
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    try:
        Path(result).parent.mkdir(parents=True, exist_ok=True)
        with open(result, 'w', encoding=encoding) as f:
            f.write(content)
        return f"Wrote to {result}"
    except PermissionError:
        return f"Error: Permission denied"

@tool("append_file")
def append_file(path: str, content: str) -> str:
    """Append text to file end (creates if missing).
    
    Args: path (required), content (required).
    Returns: "Appended to {path}" or "Error: ...".
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    try:
        with open(result, 'a', encoding='utf-8') as f:
            f.write(content)
        return f"Appended to {result}"
    except PermissionError:
        return f"Error: Permission denied"

@tool("copy_file")
def copy_file(source: str, destination: str) -> str:
    """Copy file from source to destination.
    
    Args: source (required), destination (required).
    Returns: "Copied {source} -> {dest}" or "Error: ...".
    """
    s_valid, s_path = _validate_path(source)
    d_valid, d_path = _validate_path(destination)
    if not s_valid:
        return f"Error: {s_path}"
    if not d_valid:
        return f"Error: {d_path}"
    try:
        shutil.copy2(s_path, d_path)
        return f"Copied {s_path} -> {d_path}"
    except FileNotFoundError:
        return f"Error: Source not found"
    except PermissionError:
        return f"Error: Permission denied"

@tool("move_file")
def move_file(source: str, destination: str) -> str:
    """Move/rename file from source to destination.
    
    Args: source (required), destination (required).
    Returns: "Moved {source} -> {dest}" or "Error: ...".
    """
    s_valid, s_path = _validate_path(source)
    d_valid, d_path = _validate_path(destination)
    if not s_valid:
        return f"Error: {s_path}"
    if not d_valid:
        return f"Error: {d_path}"
    try:
        Path(s_path).rename(d_path)
        return f"Moved {s_path} -> {d_path}"
    except FileNotFoundError:
        return f"Error: Source not found"
    except FileExistsError:
        return f"Error: Destination exists"

@tool("delete_file")
def delete_file(path: str) -> str:
    """Delete a file.
    
    Args: path (required).
    Returns: "Deleted {path}" or "Error: ...".
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    try:
        Path(result).unlink()
        return f"Deleted {result}"
    except FileNotFoundError:
        return f"Error: File not found"
    except IsADirectoryError:
        return f"Error: Is a directory (use remove_dir)"

@tool("list_dir")
def list_dir(path: str, include_hidden: Union[bool, str] = False) -> str:
    """List directory contents.
    
    Args: path (required), include_hidden (default=False).
    Returns: JSON {path, items: [...], count}.
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    hidden = _to_bool(include_hidden)
    p = Path(result)
    if not p.exists():
        return f"Error: Directory not found"
    if not p.is_dir():
        return f"Error: Not a directory"
    try:
        items = []
        for item in p.iterdir():
            if not hidden and item.name.startswith('.'):
                continue
            items.append(f"{'[DIR] ' if item.is_dir() else ''}{item.name}")
        return json.dumps({"path": result, "items": items, "count": len(items)})
    except PermissionError:
        return f"Error: Permission denied"

@tool("create_dir")
def create_dir(path: str) -> str:
    """Create directory (and parents if needed).
    
    Args: path (required).
    Returns: "Created {path}" or "Error: ...".
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    try:
        Path(result).mkdir(parents=True, exist_ok=True)
        return f"Created {result}"
    except PermissionError:
        return f"Error: Permission denied"

@tool("remove_dir")
def remove_dir(path: str, recursive: Union[bool, str] = False) -> str:
    """Remove directory (empty only unless recursive=True).
    
    Args: path (required), recursive (default=False).
    Returns: Success message or "Error: ...".
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    rec = _to_bool(recursive)
    p = Path(result)
    if not p.exists():
        return f"Error: Directory not found"
    try:
        if rec:
            shutil.rmtree(result)
            return f"Removed {result} (recursive)"
        else:
            p.rmdir()
            return f"Removed {result} (empty)"
    except OSError:
        return f"Error: Directory not empty (use recursive=True)"

@tool("glob")
def glob(pattern: str, path: Optional[str] = None) -> str:
    """Find files matching glob pattern (e.g., "*.py", "**/*.txt").
    
    Args: pattern (required), path (optional).
    Returns: JSON {pattern, count, matches: [{path, name, is_dir}, ...]}.
    """
    base = Path(path) if path else Path.cwd()
    try:
        matches = list(base.glob(pattern))
        results = [{"path": str(m), "name": m.name, "is_dir": m.is_dir()} for m in matches]
        return json.dumps({"pattern": pattern, "count": len(results), "matches": results})
    except OSError:
        return f"Error: Invalid pattern or path"

@tool("search_text")
def search_text(pattern: str, path: Optional[str] = None, file_pattern: str = "*") -> str:
    """Search for text in files.
    
    Args: pattern (required), path (optional), file_pattern (default="*").
    Returns: JSON {pattern, matches: [{file, line, text}, ...], truncated}.
    """
    base = Path(path) if path else Path.cwd()
    results = []
    try:
        for fpath in base.rglob(file_pattern):
            if fpath.is_file():
                try:
                    with open(fpath, 'r', errors='ignore') as f:
                        lines = f.readlines()
                    for i, line in enumerate(lines, 1):
                        if pattern in line:
                            results.append({"file": str(fpath), "line": i, "text": line.strip()[:100]})
                except (UnicodeDecodeError, PermissionError):
                    continue
        return json.dumps({"pattern": pattern, "matches": results[:20], "truncated": len(results) > 20})
    except OSError:
        return f"Error: Search failed"

@tool("get_file_info")
def get_file_info(path: str) -> str:
    """Get file/directory metadata.
    
    Args: path (required).
    Returns: JSON {path, name, size, exists, is_file, is_dir, modified}.
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    info = _get_info(result)
    return json.dumps(info)

@tool("file_checksum")
def file_checksum(path: str, algo: str = "md5") -> str:
    """Calculate file hash (algo: md5, sha1, sha256, sha512).
    
    Args: path (required), algo (default="md5").
    Returns: JSON {path, algorithm, checksum}.
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    checksum = _checksum(result, algo)
    if not checksum:
        return f"Error: Could not read file"
    return json.dumps({"path": result, "algorithm": algo, "checksum": checksum})

@tool("compare_files")
def compare_files(path1: str, path2: str) -> str:
    """Compare two files for equality.
    
    Args: path1 (required), path2 (required).
    Returns: JSON {file1: {path, checksum}, file2: {path, checksum}, identical}.
    """
    s1, p1 = _validate_path(path1)
    s2, p2 = _validate_path(path2)
    if not s1:
        return f"Error: {p1}"
    if not s2:
        return f"Error: {p2}"
    h1 = _checksum(p1)
    h2 = _checksum(p2)
    return json.dumps({"file1": {"path": p1, "checksum": h1}, "file2": {"path": p2, "checksum": h2}, "identical": h1 == h2})

@tool("replace_text")
def replace_text(path: str, search: str, replace: str) -> str:
    """Search and replace all occurrences in file.
    
    Args: path (required), search (required), replace (required).
    Returns: "Replaced in {path}" or "Error: ...".
    """
    valid, result = _validate_path(path)
    if not valid:
        return f"Error: {result}"
    try:
        with open(result, 'r', encoding='utf-8') as f:
            content = f.read()
        if search not in content:
            return f"Error: Text not found"
        new_content = content.replace(search, replace)
        with open(result, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return f"Replaced in {result}"
    except FileNotFoundError:
        return f"Error: File not found"
    except PermissionError:
        return f"Error: Permission denied"

def get_all_file_ops_tools() -> list:
    """Get all lightweight file operations tools."""
    return [
        read_file, write_file, append_file, copy_file, move_file, delete_file,
        list_dir, create_dir, remove_dir, glob, search_text, get_file_info,
        file_checksum, compare_files, replace_text,
    ]

__all__ = [
    "read_file", "write_file", "append_file", "copy_file", "move_file", "delete_file",
    "list_dir", "create_dir", "remove_dir", "glob", "search_text", "get_file_info",
    "file_checksum", "compare_files", "replace_text",
    "get_all_file_ops_tools",
]
