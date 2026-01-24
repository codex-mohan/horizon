"""Comprehensive file operations tools for the agent.

This module provides an extensive suite of tools for file reading, writing, editing,
management, search, metadata, comparison, compression, and more.

All tools follow a consistent pattern with:
- Rich error messages with context
- Safe defaults with optional overrides
- Support for encoding, permissions, and advanced options
- Consistent return formats (JSON for structured data, strings for content)
"""

from langchain_core.tools import tool
from pathlib import Path
import os
import shutil
import json
import hashlib
import tarfile
import zipfile
import gzip
import re
import stat
import fnmatch
import time
import tempfile
import csv
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Optional, Dict, Any, List, Union, Tuple, Callable
from io import BytesIO, StringIO
from dataclasses import dataclass, asdict
from enum import Enum
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import print as rprint

console = Console()


# =============================================================================
# DATA CLASSES
# =============================================================================

class FileType(Enum):
    """Enumeration of file types."""
    FILE = "file"
    DIRECTORY = "directory"
    SYMBOLIC_LINK = "symlink"
    BLOCK_DEVICE = "block_device"
    CHAR_DEVICE = "char_device"
    FIFO = "fifo"
    SOCKET = "socket"
    UNKNOWN = "unknown"


class PermissionLevel(Enum):
    """File permission levels."""
    READ_ONLY = "read-only"
    WRITE_ONLY = "write-only"
    READ_WRITE = "read-write"
    EXECUTABLE = "executable"
    NO_ACCESS = "no-access"


@dataclass
class FileInfo:
    """Comprehensive file information."""
    path: str
    name: str
    extension: str
    file_type: str
    size_bytes: int
    size_human: str
    is_readable: bool
    is_writable: bool
    is_executable: bool
    permissions: str
    owner: str
    group: str
    created_at: Optional[str]
    modified_at: Optional[str]
    accessed_at: Optional[str]
    is_symlink: bool
    symlink_target: Optional[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class SearchResult:
    """File search result."""
    file_path: str
    line_number: Optional[int]
    line_content: Optional[str]
    match_position: Optional[Tuple[int, int]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "line_number": self.line_number,
            "line_content": self.line_content,
            "match_position": self.match_position,
        }


@dataclass
class DiffResult:
    """File difference result."""
    file1: str
    file2: str
    files_are_identical: bool
    size_difference: int
    checksum1: str
    checksum2: str
    differences: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _get_file_type(path: Path) -> FileType:
    """Determine the type of a filesystem entry."""
    try:
        if path.is_symlink():
            return FileType.SYMBOLIC_LINK
        elif path.is_dir():
            return FileType.DIRECTORY
        elif path.is_file():
            return FileType.FILE
        elif stat.S_ISBLK(path.stat().st_mode):
            return FileType.BLOCK_DEVICE
        elif stat.S_ISCHR(path.stat().st_mode):
            return FileType.CHAR_DEVICE
        elif stat.S_ISFIFO(path.stat().st_mode):
            return FileType.FIFO
        elif stat.S_ISSOCK(path.stat().st_mode):
            return FileType.SOCKET
    except (OSError, PermissionError):
        pass
    return FileType.UNKNOWN


def _format_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size_bytes < 1024:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.2f} PB"


def _get_permissions_string(mode: int) -> str:
    """Convert numeric permission mode to string representation."""
    perms = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx']
    owner = perms[(mode >> 6) & 7]
    group = perms[(mode >> 3) & 7]
    other = perms[mode & 7]
    
    special = ''
    if mode & stat.S_ISUID:
        special += 's' if owner[2] == 'x' else 'S'
    if mode & stat.S_ISGID:
        special += 's' if group[2] == 'x' else 'S'
    if mode & stat.S_ISVTX:
        special += 't' if other[2] == 'x' else 'T'
    
    return f"{owner}{group}{other}{special}"


def _get_file_info(path: Union[str, Path]) -> FileInfo:
    """Get comprehensive information about a file or directory."""
    p = Path(path)
    
    try:
        stat_result = p.stat()
        mode = stat_result.st_mode
        
        # Handle symlinks
        if p.is_symlink():
            try:
                target = os.readlink(str(p))
            except OSError:
                target = None
            is_symlink = True
            try:
                stat_result = p.resolve().stat()
                mode = stat_result.st_mode
            except (OSError, PermissionError):
                pass
        else:
            target = None
            is_symlink = False
        
        # Get owner/group
        try:
            import pwd
            owner = pwd.getpwuid(stat_result.st_uid).pw_name
        except (ImportError, KeyError):
            try:
                owner = str(stat_result.st_uid)
            except (OSError, PermissionError):
                owner = "unknown"
        
        try:
            import grp
            group = grp.getgrgid(stat_result.st_gid).gr_name
        except (ImportError, KeyError):
            try:
                group = str(stat_result.st_gid)
            except (OSError, PermissionError):
                group = "unknown"
        
        file_type = _get_file_type(p)
        
        return FileInfo(
            path=str(p.absolute()),
            name=p.name,
            extension=p.suffix.lower() if p.suffix else "",
            file_type=file_type.value,
            size_bytes=stat_result.st_size if file_type == FileType.FILE else 0,
            size_human=_format_size(stat_result.st_size) if file_type == FileType.FILE else "N/A",
            is_readable=os.access(str(p), os.R_OK),
            is_writable=os.access(str(p), os.W_OK),
            is_executable=os.access(str(p), os.X_OK),
            permissions=_get_permissions_string(mode),
            owner=owner,
            group=group,
            created_at=datetime.fromtimestamp(stat_result.st_ctime).isoformat() if stat_result.st_ctime else None,
            modified_at=datetime.fromtimestamp(stat_result.st_mtime).isoformat() if stat_result.st_mtime else None,
            accessed_at=datetime.fromtimestamp(stat_result.st_atime).isoformat() if stat_result.st_atime else None,
            is_symlink=is_symlink,
            symlink_target=target,
        )
    except (OSError, PermissionError) as e:
        return FileInfo(
            path=str(p.absolute()),
            name=p.name,
            extension="",
            file_type="error",
            size_bytes=0,
            size_human="N/A",
            is_readable=False,
            is_writable=False,
            is_executable=False,
            permissions="?????????",
            owner="unknown",
            group="unknown",
            created_at=None,
            modified_at=None,
            accessed_at=None,
            is_symlink=False,
            symlink_target=None,
        )


def _calculate_checksum(path: Union[str, Path], algorithm: str = "md5") -> str:
    """Calculate file checksum using specified algorithm."""
    algorithms = ['md5', 'sha1', 'sha256', 'sha512']
    if algorithm not in algorithms:
        algorithm = 'md5'
    
    hash_func = hashlib.new(algorithm)
    
    try:
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                hash_func.update(chunk)
        return hash_func.hexdigest()
    except (OSError, PermissionError):
        return ""


def _safe_create_directories(path: Union[str, Path]) -> bool:
    """Safely create directories, returning True if successful."""
    try:
        Path(path).mkdir(parents=True, exist_ok=True)
        return True
    except (OSError, PermissionError) as e:
        console.log(f"[red]Failed to create directories: {e}[/red]")
        return False


def _validate_path(path: Union[str, Path], allow_outside_root: bool = False) -> Tuple[bool, str]:
    """Validate that a path is safe to operate on."""
    try:
        p = Path(path).resolve()
        
        if not p.exists():
            return True, str(p)
        
        if p.is_symlink():
            p = p.resolve()
        
        if str(p).startswith('..') or '..' in str(p):
            return False, f"Path traversal attempt detected: {path}"
        
        return True, str(p)
    except (OSError, PermissionError) as e:
        return False, f"Invalid path: {e}"


# =============================================================================
# FILE READING TOOLS
# =============================================================================

@tool("read_file")
def read_file(path: str, encoding: str = "utf-8", errors: str = "strict") -> str:
    """Read the entire contents of a file.
    
    Args:
        path: Path to the file to read.
        encoding: Text encoding to use (default: utf-8).
        errors: How to handle encoding errors: 'strict', 'ignore', 'replace'.
    
    Returns:
        File contents as a string, or error message.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    try:
        with open(result_path, 'r', encoding=encoding, errors=errors) as f:
            content = f.read()
        
        info = _get_file_info(result_path)
        return f"[File: {result_path}]\n[Size: {info.size_human}]\n\n{content}"
    
    except UnicodeDecodeError:
        return f"Error: File '{path}' appears to be binary. Use read_file_binary() instead."
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except PermissionError:
        return f"Error: Permission denied to read: {path}"
    except OSError as e:
        return f"Error reading file: {e}"


@tool("read_file_binary")
def read_file_binary(path: str, offset: int = 0, size: int = -1) -> str:
    """Read a portion of a binary file.
    
    Args:
        path: Path to the binary file.
        offset: Starting byte position (default: 0).
        size: Number of bytes to read, -1 for rest of file (default: -1).
    
    Returns:
        JSON with file info and hexdump of content.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    try:
        with open(result_path, 'rb') as f:
            if offset > 0:
                f.seek(offset)
            
            if size >= 0:
                content = f.read(size)
            else:
                content = f.read()
        
        # Create hexdump
        hexdump = []
        for i in range(0, len(content), 16):
            chunk = content[i:i+16]
            hex_parts = ' '.join(f'{b:02x}' for b in chunk)
            ascii_rep = ''.join(chr(b) if 32 <= b < 127 else '.' for b in chunk)
            hexdump.append(f'{i:08x}: {hex_parts:<48}  {ascii_rep}')
        
        info = _get_file_info(result_path)
        
        return json.dumps({
            "path": result_path,
            "offset": offset,
            "bytes_read": len(content),
            "hexdump": '\n'.join(hexdump[:100]),
            "total_file_size": info.size_bytes,
            "is_truncated": len(content) > 1600,
        }, indent=2)
    
    except FileNotFoundError:
        return json.dumps({"error": f"File not found: {path}"})
    except PermissionError:
        return json.dumps({"error": f"Permission denied: {path}"})
    except OSError as e:
        return json.dumps({"error": str(e)})


@tool("read_file_lines")
def read_file_lines(path: str, start_line: int = 1, end_line: Optional[int] = None, 
                    encoding: str = "utf-8") -> str:
    """Read specific lines from a file.
    
    Args:
        path: Path to the file.
        start_line: First line number (1-indexed, default: 1).
        end_line: Last line number (inclusive, default: end of file).
        encoding: Text encoding (default: utf-8).
    
    Returns:
        Requested lines as a string with line numbers.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    try:
        with open(result_path, 'r', encoding=encoding) as f:
            lines = f.readlines()
        
        start = max(0, start_line - 1)
        end = len(lines) if end_line is None else min(end_line, len(lines))
        
        if start >= len(lines):
            return f"Error: Start line {start_line} is beyond file length ({len(lines)} lines)"
        
        selected_lines = lines[start:end]
        numbered_lines = ''.join(
            f"{i + start_line:6d} | {line}" 
            for i, line in enumerate(selected_lines)
        )
        
        info = _get_file_info(result_path)
        return f"[File: {result_path}]\n[Lines: {start_line}-{end_line or len(lines)} of {len(lines)}]\n\n{numbered_lines}"
    
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error reading file: {e}"


@tool("read_file_lines_batch")
def read_file_lines_batch(paths: List[str], encoding: str = "utf-8") -> str:
    """Read multiple files and return their contents.
    
    Args:
        paths: List of file paths to read.
        encoding: Text encoding (default: utf-8).
    
    Returns:
        JSON with all file contents and metadata.
    """
    results = []
    errors = []
    
    for path in paths:
        valid, result_path = _validate_path(path)
        if not valid:
            errors.append({"path": path, "error": result_path})
            continue
        
        try:
            with open(result_path, 'r', encoding=encoding) as f:
                content = f.read()
            info = _get_file_info(result_path)
            results.append({
                "path": result_path,
                "content": content,
                "size_bytes": info.size_bytes,
                "line_count": content.count('\n') + 1,
            })
        except FileNotFoundError:
            errors.append({"path": path, "error": "File not found"})
        except PermissionError:
            errors.append({"path": path, "error": "Permission denied"})
        except Exception as e:
            errors.append({"path": path, "error": str(e)})
    
    return json.dumps({
        "success_count": len(results),
        "error_count": len(errors),
        "files": results,
        "errors": errors,
    }, indent=2)


@tool("read_file_stream")
def read_file_stream(path: str, chunk_size: int = 8192, encoding: str = "utf-8") -> str:
    """Stream-read a large file in chunks for memory efficiency.
    
    Args:
        path: Path to the file.
        chunk_size: Bytes per chunk (default: 8KB).
        encoding: Text encoding (default: utf-8).
    
    Returns:
        JSON with file info and first chunk of content.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    try:
        info = _get_file_info(result_path)
        
        with open(result_path, 'r', encoding=encoding) as f:
            first_chunk = f.read(chunk_size)
            has_more = len(first_chunk) == chunk_size
        
        return json.dumps({
            "path": result_path,
            "total_size": info.size_bytes,
            "chunk_size": chunk_size,
            "content": first_chunk,
            "has_more": has_more,
            "note": "This is the first chunk. Use read_file() for small files.",
        }, indent=2)
    
    except FileNotFoundError:
        return json.dumps({"error": f"File not found: {path}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


# =============================================================================
# FILE WRITING TOOLS
# =============================================================================

@tool("write_to_file")
def write_to_file(path: str, content: str, encoding: str = "utf-8", 
                  create_parents: bool = True, overwrite: bool = True) -> str:
    """Write content to a file, creating it if necessary.
    
    Args:
        path: Path to the file to write.
        content: Content to write to the file.
        encoding: Text encoding (default: utf-8).
        create_parents: Create parent directories if needed (default: True).
        overwrite: Overwrite existing file (default: True).
    
    Returns:
        Success message with file info.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    if not overwrite and Path(result_path).exists():
        return f"Error: File already exists and overwrite=False: {path}"
    
    if create_parents:
        if not _safe_create_directories(Path(result_path).parent):
            return f"Error: Failed to create parent directories"
    
    try:
        with open(result_path, 'w', encoding=encoding) as f:
            f.write(content)
        
        info = _get_file_info(result_path)
        line_count = content.count('\n') + (1 if content and not content.endswith('\n') else 0)
        
        return f"Successfully wrote to {result_path}\n" \
               f"Size: {info.size_human} ({info.size_bytes} bytes)\n" \
               f"Lines: {line_count}\n" \
               f"Encoding: {encoding}"
    
    except PermissionError:
        return f"Error: Permission denied to write: {path}"
    except OSError as e:
        return f"Error writing file: {e}"


@tool("append_to_file")
def append_to_file(path: str, content: str, encoding: str = "utf-8", 
                   create_if_missing: bool = True) -> str:
    """Append content to the end of a file.
    
    Args:
        path: Path to the file.
        content: Content to append.
        encoding: Text encoding (default: utf-8).
        create_if_missing: Create file if it doesn't exist (default: True).
    
    Returns:
        Success message with file info.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    if not Path(result_path).exists():
        if create_if_missing:
            try:
                Path(result_path).touch()
            except (OSError, PermissionError) as e:
                return f"Error: Failed to create file: {e}"
        else:
            return f"Error: File does not exist: {path}"
    
    try:
        with open(result_path, 'a', encoding=encoding) as f:
            f.write(content)
        
        info = _get_file_info(result_path)
        
        return f"Successfully appended to {result_path}\n" \
               f"Current size: {info.size_human} ({info.size_bytes} bytes)"
    
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error appending to file: {e}"


@tool("write_file_lines")
def write_file_lines(path: str, lines: List[str], encoding: str = "utf-8",
                     create_parents: bool = True) -> str:
    """Write a list of lines to a file.
    
    Args:
        path: Path to the file.
        lines: List of strings (lines) to write.
        encoding: Text encoding (default: utf-8).
        create_parents: Create parent directories if needed (default: True).
    
    Returns:
        Success message with line count.
    """
    content = ''.join(lines)
    return write_to_file(path, content, encoding, create_parents, overwrite=True)


@tool("write_file_binary")
def write_file_binary(path: str, content_base64: str, create_parents: bool = True) -> str:
    """Write binary content from base64-encoded string.
    
    Args:
        path: Path to the file.
        content_base64: Base64-encoded binary content.
        create_parents: Create parent directories if needed (default: True).
    
    Returns:
        Success message with file info.
    """
    import base64
    
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    if create_parents:
        if not _safe_create_directories(Path(result_path).parent):
            return f"Error: Failed to create parent directories"
    
    try:
        binary_content = base64.b64decode(content_base64)
        
        with open(result_path, 'wb') as f:
            f.write(binary_content)
        
        info = _get_file_info(result_path)
        
        return f"Successfully wrote binary file {result_path}\n" \
               f"Size: {info.size_human} ({info.size_bytes} bytes)"
    
    except base64.binascii.Error:
        return f"Error: Invalid base64 content"
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error writing file: {e}"


@tool("copy_file")
def copy_file(source: str, destination: str, create_parents: bool = True,
              preserve_metadata: bool = True) -> str:
    """Copy a file to a new location.
    
    Args:
        source: Source file path.
        destination: Destination file path.
        create_parents: Create parent directories if needed (default: True).
        preserve_metadata: Preserve file metadata (permissions, timestamps) (default: True).
    
    Returns:
        Success message with file info.
    """
    valid_src, src_path = _validate_path(source)
    if not valid_src:
        return f"Error: {src_path}"
    
    valid_dst, dst_path = _validate_path(destination)
    if not valid_dst:
        return f"Error: {dst_path}"
    
    src = Path(src_path)
    if not src.exists():
        return f"Error: Source file does not exist: {source}"
    if not src.is_file():
        return f"Error: Source is not a file: {source}"
    
    if create_parents:
        if not _safe_create_directories(Path(dst_path).parent):
            return f"Error: Failed to create parent directories"
    
    try:
        src_info = _get_file_info(src_path)
        
        if preserve_metadata:
            shutil.copy2(src_path, dst_path)
        else:
            shutil.copy(src_path, dst_path)
        
        dst_info = _get_file_info(dst_path)
        
        return f"Successfully copied {source} → {destination}\n" \
               f"Source size: {src_info.size_human}\n" \
               f"Destination size: {dst_info.size_human}"
    
    except PermissionError:
        return f"Error: Permission denied to copy: {source} → {destination}"
    except OSError as e:
        return f"Error copying file: {e}"


# =============================================================================
# FILE EDITING TOOLS
# =============================================================================

@tool("search_and_replace")
def search_and_replace(path: str, search_text: str, replace_text: str,
                       replacement_count: int = -1, encoding: str = "utf-8") -> str:
    """Search and replace text in a file.
    
    Args:
        path: Path to the file.
        search_text: Text to search for.
        replace_text: Text to replace with.
        replacement_count: Number of replacements (-1 for all, default: -1).
        encoding: Text encoding (default: utf-8).
    
    Returns:
        Success message with replacement count.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    try:
        with open(result_path, 'r', encoding=encoding) as f:
            content = f.read()
        
        if search_text not in content:
            return f"Text not found in {path}"
        
        if replacement_count == -1:
            new_content = content.replace(search_text, replace_text)
            count = content.count(search_text)
        else:
            parts = content.split(search_text)
            if len(parts) <= replacement_count + 1:
                new_content = content.replace(search_text, replace_text)
                count = content.count(search_text)
            else:
                new_content = search_text.join(parts[:replacement_count + 1]) + \
                              replace_text + search_text.join(parts[replacement_count + 1:])
                count = replacement_count
        
        with open(result_path, 'w', encoding=encoding) as f:
            f.write(new_content)
        
        return f"Successfully replaced {count} occurrence(s) in {path}"
    
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error editing file: {e}"


@tool("search_and_replace_regex")
def search_and_replace_regex(path: str, pattern: str, replace_text: str,
                              flags: str = "", encoding: str = "utf-8") -> str:
    """Search and replace using regular expressions.
    
    Args:
        path: Path to the file.
        pattern: Regex pattern to search for.
        replace_text: Replacement string (supports backreferences like \\1).
        flags: Regex flags (g=global, i=ignore case, m=multiline, s=dotall).
        encoding: Text encoding (default: utf-8).
    
    Returns:
        Success message with replacement count.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    try:
        with open(result_path, 'r', encoding=encoding) as f:
            content = f.read()
        
        regex_flags = 0
        if 'i' in flags:
            regex_flags |= re.IGNORECASE
        if 'm' in flags:
            regex_flags |= re.MULTILINE
        if 's' in flags:
            regex_flags |= re.DOTALL
        
        count = 0
        if 'g' in flags:
            new_content, count = re.subn(pattern, replace_text, content, flags=regex_flags)
        else:
            new_content = re.sub(pattern, replace_text, content, count=1, flags=regex_flags)
        
        with open(result_path, 'w', encoding=encoding) as f:
            f.write(new_content)
        
        return f"Successfully replaced in {path}\n" \
               f"Pattern: {pattern}\n" \
               f"Replacements: {'all' if 'g' in flags else '1'}"
    
    except re.error as e:
        return f"Error: Invalid regex pattern: {e}"
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error editing file: {e}"


@tool("insert_content_at_line")
def insert_content_at_line(path: str, content: str, line_number: int,
                           encoding: str = "utf-8") -> str:
    """Insert content at a specific line number.
    
    Args:
        path: Path to the file.
        content: Content to insert.
        line_number: Line number to insert after (1-indexed). Use 0 to insert at beginning.
        encoding: Text encoding (default: utf-8).
    
    Returns:
        Success message with line info.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    try:
        with open(result_path, 'r', encoding=encoding) as f:
            lines = f.readlines()
        
        insert_pos = max(0, min(line_number, len(lines)))
        lines.insert(insert_pos, content + ('\n' if not content.endswith('\n') else ''))
        
        with open(result_path, 'w', encoding=encoding) as f:
            f.writelines(lines)
        
        return f"Successfully inserted content at line {line_number} in {path}\n" \
               f"File now has {len(lines)} lines"
    
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error editing file: {e}"


@tool("delete_lines")
def delete_lines(path: str, start_line: int, end_line: Optional[int] = None,
                 encoding: str = "utf-8") -> str:
    """Delete lines from a file.
    
    Args:
        path: Path to the file.
        start_line: First line to delete (1-indexed).
        end_line: Last line to delete (inclusive, default: same as start_line).
        encoding: Text encoding (default: utf-8).
    
    Returns:
        Success message with deletion info.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    try:
        with open(result_path, 'r', encoding=encoding) as f:
            lines = f.readlines()
        
        if start_line < 1 or start_line > len(lines):
            return f"Error: Invalid start line {start_line} (file has {len(lines)} lines)"
        
        end = end_line if end_line else start_line
        end = min(end, len(lines))
        
        if start_line > end:
            return f"Error: start_line ({start_line}) > end_line ({end})"
        
        del lines[start_line - 1:end]
        
        with open(result_path, 'w', encoding=encoding) as f:
            f.writelines(lines)
        
        lines_deleted = end - start_line + 1
        
        return f"Successfully deleted line(s) {start_line}-{end} from {path}\n" \
               f"Lines deleted: {lines_deleted}\n" \
               f"Remaining lines: {len(lines)}"
    
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error editing file: {e}"


@tool("replace_line")
def replace_line(path: str, line_number: int, new_content: str,
                 encoding: str = "utf-8") -> str:
    """Replace a specific line with new content.
    
    Args:
        path: Path to the file.
        line_number: Line number to replace (1-indexed).
        new_content: New content for the line.
        encoding: Text encoding (default: utf-8).
    
    Returns:
        Success message with line info.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    try:
        with open(result_path, 'r', encoding=encoding) as f:
            lines = f.readlines()
        
        if line_number < 1 or line_number > len(lines):
            return f"Error: Invalid line number {line_number} (file has {len(lines)} lines)"
        
        original_line = lines[line_number - 1]
        if original_line.endswith('\n'):
            lines[line_number - 1] = new_content + '\n'
        else:
            lines[line_number - 1] = new_content
        
        with open(result_path, 'w', encoding=encoding) as f:
            f.writelines(lines)
        
        return f"Successfully replaced line {line_number} in {path}"
    
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error editing file: {e}"


# =============================================================================
# FILE MANAGEMENT TOOLS
# =============================================================================

@tool("delete_file")
def delete_file(path: str, force: bool = False) -> str:
    """Delete a file.
    
    Args:
        path: Path to the file to delete.
        force: Force delete read-only files (default: False).
    
    Returns:
        Success message.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    p = Path(result_path)
    
    if not p.exists():
        return f"Error: File does not exist: {path}"
    
    if p.is_dir():
        return f"Error: Path is a directory, not a file. Use remove_directory()."
    
    try:
        if force and not p.stat().st_mode & stat.S_IWUSR:
            p.chmod(stat.S_IWUSR | stat.S_IRUSR)
        
        p.unlink()
        return f"Successfully deleted: {result_path}"
    
    except PermissionError:
        return f"Error: Permission denied to delete: {path}"
    except OSError as e:
        return f"Error deleting file: {e}"


@tool("move_file")
def move_file(source: str, destination: str, create_parents: bool = True) -> str:
    """Move or rename a file.
    
    Args:
        source: Source file path.
        destination: Destination file path.
        create_parents: Create parent directories if needed (default: True).
    
    Returns:
        Success message with file info.
    """
    valid_src, src_path = _validate_path(source)
    if not valid_src:
        return f"Error: {src_path}"
    
    valid_dst, dst_path = _validate_path(destination)
    if not valid_dst:
        return f"Error: {dst_path}"
    
    src = Path(src_path)
    dst = Path(dst_path)
    
    if not src.exists():
        return f"Error: Source file does not exist: {source}"
    
    if create_parents:
        if not _safe_create_directories(dst.parent):
            return f"Error: Failed to create parent directories"
    
    try:
        if dst.exists():
            return f"Error: Destination already exists: {destination}"
        
        src.rename(dst)
        
        info = _get_file_info(dst_path)
        
        return f"Successfully moved {source} → {destination}\n" \
               f"New location: {dst_path}\n" \
               f"Size: {info.size_human}"
    
    except PermissionError:
        return f"Error: Permission denied to move: {source} → {destination}"
    except OSError as e:
        return f"Error moving file: {e}"


@tool("rename_file")
def rename_file(path: str, new_name: str) -> str:
    """Rename a file in place.
    
    Args:
        path: Current path to the file.
        new_name: New name for the file (not full path).
    
    Returns:
        Success message with new path.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    p = Path(result_path)
    
    if not p.exists():
        return f"Error: File does not exist: {path}"
    
    if '/' in new_name or '\\' in new_name:
        return f"Error: new_name should be a simple name, not a path: {new_name}"
    
    try:
        new_path = p.parent / new_name
        
        if new_path.exists():
            return f"Error: A file with that name already exists: {new_name}"
        
        p.rename(new_path)
        
        info = _get_file_info(new_path)
        
        return f"Successfully renamed {p.name} → {new_name}\n" \
               f"Full path: {new_path}\n" \
               f"Size: {info.size_human}"
    
    except PermissionError:
        return f"Error: Permission denied to rename: {path}"
    except OSError as e:
        return f"Error renaming file: {e}"


@tool("truncate_file")
def truncate_file(path: str, size: int = 0) -> str:
    """Truncate a file to a specific size.
    
    Args:
        path: Path to the file.
        size: New size in bytes (default: 0 = empty file).
    
    Returns:
        Success message with new size.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    p = Path(result_path)
    
    if not p.exists():
        return f"Error: File does not exist: {path}"
    
    if not p.is_file():
        return f"Error: Path is not a file: {path}"
    
    try:
        with open(result_path, 'r+') as f:
            f.truncate(size)
        
        info = _get_file_info(result_path)
        
        return f"Successfully truncated {path} to {size} bytes\n" \
               f"Current size: {info.size_human}"
    
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except OSError as e:
        return f"Error truncating file: {e}"


# =============================================================================
# DIRECTORY OPERATIONS
# =============================================================================

@tool("list_directory")
def list_directory(path: str, include_hidden: bool = False, 
                   sort_by: str = "name") -> str:
    """List contents of a directory.
    
    Args:
        path: Path to the directory.
        include_hidden: Include hidden files (starting with .) (default: False).
        sort_by: Sort by 'name', 'size', 'modified', 'type' (default: 'name').
    
    Returns:
        JSON with directory contents and file info.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"Directory does not exist: {path}"})
    
    if not p.is_dir():
        return json.dumps({"error": f"Path is not a directory: {path}"})
    
    try:
        entries = []
        for entry in p.iterdir():
            if not include_hidden and entry.name.startswith('.'):
                continue
            
            info = _get_file_info(entry)
            entries.append(info.to_dict())
        
        if sort_by == "name":
            entries.sort(key=lambda x: x['name'].lower())
        elif sort_by == "size":
            entries.sort(key=lambda x: x['size_bytes'], reverse=True)
        elif sort_by == "modified":
            entries.sort(key=lambda x: x['modified_at'] or "", reverse=True)
        elif sort_by == "type":
            entries.sort(key=lambda x: (x['file_type'], x['name'].lower()))
        
        dirs = [e for e in entries if e['file_type'] == 'directory']
        files = [e for e in entries if e['file_type'] == 'file']
        
        return json.dumps({
            "path": result_path,
            "total_entries": len(entries),
            "directories": len(dirs),
            "files": len(files),
            "contents": entries,
        }, indent=2)
    
    except PermissionError:
        return json.dumps({"error": f"Permission denied: {path}"})
    except OSError as e:
        return json.dumps({"error": str(e)})


@tool("list_directory_tree")
def list_directory_tree(path: str, max_depth: int = 3, include_hidden: bool = False) -> str:
    """List directory tree with specified depth.
    
    Args:
        path: Path to the directory.
        max_depth: Maximum depth to recurse (default: 3).
        include_hidden: Include hidden files (default: False).
    
    Returns:
        JSON with directory tree structure.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"Directory does not exist: {path}"})
    
    def build_tree(dir_path: Path, current_depth: int) -> Dict[str, Any]:
        if current_depth > max_depth:
            return {"name": dir_path.name, "truncated": True}
        
        entries = []
        try:
            for entry in sorted(dir_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                if not include_hidden and entry.name.startswith('.'):
                    continue
                
                if entry.is_dir():
                    entries.append(build_tree(entry, current_depth + 1))
                else:
                    info = _get_file_info(entry)
                    entries.append({
                        "name": entry.name,
                        "size": info.size_human,
                        "type": "file",
                        "modified": info.modified_at,
                    })
        except PermissionError:
            entries.append({"name": "[ Permission Denied ]", "type": "error"})
        
        return {
            "name": dir_path.name,
            "path": str(dir_path),
            "type": "directory",
            "entries": entries,
        }
    
    tree = build_tree(p, 0)
    
    return json.dumps({
        "path": result_path,
        "max_depth": max_depth,
        "tree": tree,
    }, indent=2)


@tool("create_directory")
def create_directory(path: str, exist_ok: bool = True) -> str:
    """Create a directory.
    
    Args:
        path: Path to the directory to create.
        exist_ok: Don't error if directory already exists (default: True).
    
    Returns:
        Success message.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    try:
        Path(result_path).mkdir(parents=True, exist_ok=exist_ok)
        return f"Successfully created directory: {result_path}"
    
    except PermissionError:
        return f"Error: Permission denied to create: {path}"
    except OSError as e:
        return f"Error creating directory: {e}"


@tool("remove_directory")
def remove_directory(path: str, recursive: bool = False, force: bool = False) -> str:
    """Remove a directory.
    
    Args:
        path: Path to the directory.
        recursive: Remove contents recursively (default: False).
        force: Force delete read-only contents (default: False).
    
    Returns:
        Success message with removal info.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    p = Path(result_path)
    
    if not p.exists():
        return f"Error: Directory does not exist: {path}"
    
    if not p.is_dir():
        return f"Error: Path is not a directory: {path}"
    
    try:
        if recursive:
            count = sum(1 for _ in p.rglob('*') if not _)
            
            if force:
                shutil.rmtree(result_path, onerror=lambda f, p, e: os.chmod(p, stat.S_IWUSR | stat.S_IRUSR))
            else:
                shutil.rmtree(result_path)
            
            return f"Successfully removed directory and {count} contents: {result_path}"
        else:
            if any(p.iterdir()):
                return f"Error: Directory is not empty. Use recursive=True to remove."
            
            p.rmdir()
            return f"Successfully removed empty directory: {result_path}"
    
    except PermissionError:
        return f"Error: Permission denied to remove: {path}"
    except OSError as e:
        return f"Error removing directory: {e}"


@tool("get_directory_size")
def get_directory_size(path: str) -> str:
    """Get the total size of a directory.
    
    Args:
        path: Path to the directory.
    
    Returns:
        JSON with size information.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"Directory does not exist: {path}"})
    
    if not p.is_dir():
        return json.dumps({"error": f"Path is not a directory: {path}"})
    
    try:
        total_size = 0
        file_count = 0
        dir_count = 0
        
        for entry in p.rglob('*'):
            if entry.is_file():
                total_size += entry.stat().st_size
                file_count += 1
            elif entry.is_dir():
                dir_count += 1
        
        return json.dumps({
            "path": result_path,
            "total_size_bytes": total_size,
            "total_size_human": _format_size(total_size),
            "file_count": file_count,
            "directory_count": dir_count,
        }, indent=2)
    
    except PermissionError:
        return json.dumps({"error": f"Permission denied: {path}"})
    except OSError as e:
        return json.dumps({"error": str(e)})


# =============================================================================
# FILE SEARCH TOOLS
# =============================================================================

@tool("glob_files")
def glob_files(pattern: str, path: Optional[str] = None, 
               max_results: int = 100) -> str:
    """Find files matching a glob pattern.
    
    Args:
        pattern: Glob pattern (e.g., "*.py", "**/*.txt").
        path: Base path (default: current directory).
        max_results: Maximum results to return (default: 100).
    
    Returns:
        JSON with matching files.
    """
    base_path = Path(path) if path else Path.cwd()
    
    try:
        matches = list(base_path.glob(pattern))
        results = [_get_file_info(m).to_dict() for m in matches[:max_results]]
        
        return json.dumps({
            "pattern": pattern,
            "base_path": str(base_path),
            "total_matches": len(matches),
            "returned": len(results),
            "truncated": len(matches) > max_results,
            "files": results,
        }, indent=2)
    
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


@tool("search_files_content")
def search_files_content(pattern: str, path: Optional[str] = None,
                         file_pattern: str = "*", encoding: str = "utf-8",
                         max_results: int = 50) -> str:
    """Search for text in files.
    
    Args:
        pattern: Text pattern to search for.
        path: Base path to search (default: current directory).
        file_pattern: File glob pattern to match (default: "*").
        encoding: File encoding (default: utf-8).
        max_results: Maximum matches to return (default: 50).
    
    Returns:
        JSON with search results.
    """
    base_path = Path(path) if path else Path.cwd()
    
    results = []
    count = 0
    
    try:
        for file_path in base_path.rglob(file_pattern):
            if file_path.is_file():
                try:
                    with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
                        lines = f.readlines()
                    
                    for i, line in enumerate(lines, 1):
                        if pattern in line:
                            results.append({
                                "file": str(file_path),
                                "line": i,
                                "content": line.strip()[:200],
                            })
                            count += 1
                            if count >= max_results:
                                break
                except (UnicodeDecodeError, PermissionError):
                    continue
                except OSError:
                    continue
            
            if count >= max_results:
                break
        
        return json.dumps({
            "pattern": pattern,
            "path": str(base_path),
            "file_pattern": file_pattern,
            "total_matches": len(results),
            "files_with_matches": len(set(r['file'] for r in results)),
            "results": results,
            "truncated": len(results) >= max_results,
        }, indent=2)
    
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


@tool("search_files_regex")
def search_files_regex(pattern: str, path: Optional[str] = None,
                       file_pattern: str = "*", encoding: str = "utf-8",
                       flags: str = "", max_results: int = 50) -> str:
    """Search for regex pattern in files.
    
    Args:
        pattern: Regex pattern to search for.
        path: Base path to search (default: current directory).
        file_pattern: File glob pattern to match (default: "*").
        encoding: File encoding (default: utf-8).
        flags: Regex flags (i=ignore case, m=multiline, s=dotall).
        max_results: Maximum matches to return (default: 50).
    
    Returns:
        JSON with search results.
    """
    base_path = Path(path) if path else Path.cwd()
    
    regex_flags = 0
    if 'i' in flags:
        regex_flags |= re.IGNORECASE
    if 'm' in flags:
        regex_flags |= re.MULTILINE
    if 's' in flags:
        regex_flags |= re.DOTALL
    
    try:
        compiled_pattern = re.compile(pattern, regex_flags)
    except re.error as e:
        return json.dumps({"error": f"Invalid regex pattern: {e}"})
    
    results = []
    count = 0
    
    try:
        for file_path in base_path.rglob(file_pattern):
            if file_path.is_file():
                try:
                    with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
                        content = f.read()
                    
                    for match in compiled_pattern.finditer(content):
                        line_no = content[:match.start()].count('\n') + 1
                        line = content.split('\n')[line_no - 1]
                        
                        results.append({
                            "file": str(file_path),
                            "line": line_no,
                            "match": match.group()[:100],
                            "position": [match.start(), match.end()],
                            "context": line.strip()[:200],
                        })
                        count += 1
                        if count >= max_results:
                            break
                except (UnicodeDecodeError, PermissionError):
                    continue
                except OSError:
                    continue
            
            if count >= max_results:
                break
        
        return json.dumps({
            "pattern": pattern,
            "path": str(base_path),
            "file_pattern": file_pattern,
            "total_matches": len(results),
            "files_with_matches": len(set(r['file'] for r in results)),
            "results": results,
            "truncated": len(results) >= max_results,
        }, indent=2)
    
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


@tool("find_files_by_size")
def find_files_by_size(path: str, min_size: str = "0B", max_size: str = "inf",
                       file_pattern: str = "*") -> str:
    """Find files by size range.
    
    Args:
        path: Base path to search.
        min_size: Minimum size (e.g., "1KB", "1MB", default: 0B).
        max_size: Maximum size (e.g., "10MB", "inf", default: inf).
        file_pattern: File glob pattern (default: "*").
    
    Returns:
        JSON with matching files.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    def parse_size(size_str: str) -> int:
        size_str = size_str.upper().strip()
        multipliers = {'B': 1, 'K': 1024, 'M': 1024**2, 'G': 1024**3, 'T': 1024**4}
        if size_str == 'INF':
            return float('inf')
        match = re.match(r'^(\d+(?:\.\d+)?)?([KMGT])?B?$', size_str)
        if not match:
            return 0
        value = float(match.group(1) or 1)
        unit = match.group(2) or 'B'
        return int(value * multipliers.get(unit, 1))
    
    min_bytes = parse_size(min_size)
    max_bytes = parse_size(max_size)
    
    results = []
    
    try:
        for file_path in Path(result_path).rglob(file_pattern):
            if file_path.is_file():
                size = file_path.stat().st_size
                if min_bytes <= size <= max_bytes:
                    info = _get_file_info(file_path)
                    results.append(info.to_dict())
        
        results.sort(key=lambda x: x['size_bytes'], reverse=True)
        
        return json.dumps({
            "path": result_path,
            "min_size": min_size,
            "max_size": max_size,
            "total_matches": len(results),
            "files": results[:100],
            "truncated": len(results) > 100,
        }, indent=2)
    
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


@tool("find_files_by_date")
def find_files_by_date(path: str, modified_after: Optional[str] = None,
                       modified_before: Optional[str] = None,
                       file_pattern: str = "*",
                       date_field: str = "modified") -> str:
    """Find files by date range.
    
    Args:
        path: Base path to search.
        modified_after: Modified after date (ISO format or "YYYY-MM-DD").
        modified_before: Modified before date.
        file_pattern: File glob pattern (default: "*").
        date_field: Which date to check: 'modified', 'accessed', 'created'.
    
    Returns:
        JSON with matching files.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    def parse_date(date_str: Optional[str]) -> Optional[float]:
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str).timestamp()
        except ValueError:
            try:
                return datetime.strptime(date_str, "%Y-%m-%d").timestamp()
            except ValueError:
                return None
    
    after_ts = parse_date(modified_after)
    before_ts = parse_date(modified_before)
    
    results = []
    
    try:
        for file_path in Path(result_path).rglob(file_pattern):
            if file_path.is_file():
                try:
                    stat_result = file_path.stat()
                    if date_field == "modified":
                        file_ts = stat_result.st_mtime
                    elif date_field == "accessed":
                        file_ts = stat_result.st_atime
                    elif date_field == "created":
                        file_ts = stat_result.st_ctime
                    else:
                        file_ts = stat_result.st_mtime
                    
                    if (after_ts is None or file_ts >= after_ts) and \
                       (before_ts is None or file_ts <= before_ts):
                        info = _get_file_info(file_path)
                        results.append(info.to_dict())
                except (OSError, PermissionError):
                    continue
        
        results.sort(key=lambda x: x['modified_at'] or "", reverse=True)
        
        return json.dumps({
            "path": result_path,
            "modified_after": modified_after,
            "modified_before": modified_before,
            "date_field": date_field,
            "total_matches": len(results),
            "files": results[:100],
            "truncated": len(results) > 100,
        }, indent=2)
    
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


# =============================================================================
# FILE METADATA TOOLS
# =============================================================================

@tool("get_file_info")
def get_file_info(path: str) -> str:
    """Get comprehensive information about a file or directory.
    
    Args:
        path: Path to the file or directory.
    
    Returns:
        JSON with file information.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    info = _get_file_info(result_path)
    return json.dumps(info.to_dict(), indent=2)


@tool("get_file_checksum")
def get_file_checksum(path: str, algorithm: str = "md5") -> str:
    """Calculate checksum for a file.
    
    Args:
        path: Path to the file.
        algorithm: Hash algorithm: md5, sha1, sha256, sha512 (default: md5).
    
    Returns:
        JSON with checksum information.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"File does not exist: {path}"})
    
    if not p.is_file():
        return json.dumps({"error": f"Path is not a file: {path}"})
    
    checksum = _calculate_checksum(result_path, algorithm)
    info = _get_file_info(result_path)
    
    return json.dumps({
        "path": result_path,
        "algorithm": algorithm,
        "checksum": checksum,
        "size_bytes": info.size_bytes,
    }, indent=2)


@tool("get_file_permissions")
def get_file_permissions(path: str) -> str:
    """Get detailed permission information for a file.
    
    Args:
        path: Path to the file.
    
    Returns:
        JSON with permission details.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"File does not exist: {path}"})
    
    try:
        mode = p.stat().st_mode
        
        perms = {
            "owner_read": bool(mode & stat.S_IRUSR),
            "owner_write": bool(mode & stat.S_IWUSR),
            "owner_exec": bool(mode & stat.S_IXUSR),
            "group_read": bool(mode & stat.S_IRGRP),
            "group_write": bool(mode & stat.S_IWGRP),
            "group_exec": bool(mode & stat.S_IXGRP),
            "other_read": bool(mode & stat.S_IROTH),
            "other_write": bool(mode & stat.S_IWOTH),
            "other_exec": bool(mode & stat.S_IXOTH),
            "setuid": bool(mode & stat.S_ISUID),
            "setgid": bool(mode & stat.S_ISGID),
            "sticky": bool(mode & stat.S_ISVTX),
        }
        
        numeric = oct(mode)[-3:]
        human_perms = _get_permissions_string(mode)
        
        access_checks = {
            "is_readable": os.access(result_path, os.R_OK),
            "is_writable": os.access(result_path, os.W_OK),
            "is_executable": os.access(result_path, os.X_OK),
        }
        
        return json.dumps({
            "path": result_path,
            "permissions": perms,
            "numeric": numeric,
            "string": human_perms,
            "access": access_checks,
        }, indent=2)
    
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


@tool("set_file_permissions")
def set_file_permissions(path: str, mode: str) -> str:
    """Set file permissions.
    
    Args:
        path: Path to the file.
        mode: Permission mode (e.g., "755", "rw-r--r--", or "+w").
    
    Returns:
        Success message with new permissions.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    p = Path(result_path)
    
    if not p.exists():
        return f"Error: File does not exist: {path}"
    
    try:
        if mode.startswith('+') or mode.startswith('-'):
            current_mode = p.stat().st_mode
            if mode[0] == '+':
                new_mode = current_mode
                for char in mode[1:]:
                    if char == 'r':
                        new_mode |= stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH
                    elif char == 'w':
                        new_mode |= stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH
                    elif char == 'x':
                        new_mode |= stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH
            else:
                new_mode = current_mode
                for char in mode[1:]:
                    if char == 'r':
                        new_mode &= ~(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
                    elif char == 'w':
                        new_mode &= ~(stat.S_IWUSR | stat.S_IWGRP | stat.S_IWOTH)
                    elif char == 'x':
                        new_mode &= ~(stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
        elif mode.isdigit():
            new_mode = int(mode, 8)
            file_type = p.stat().st_mode & stat.S_IFMT
            new_mode |= file_type
        else:
            return f"Error: Invalid mode format: {mode}"
        
        os.chmod(result_path, new_mode)
        
        new_info = _get_file_info(result_path)
        
        return f"Successfully set permissions on {path}\n" \
               f"New permissions: {new_info.permissions} ({new_info.size_bytes})"
    
    except PermissionError:
        return f"Error: Permission denied: {path}"
    except (OSError, ValueError) as e:
        return f"Error setting permissions: {e}"


@tool("compare_files")
def compare_files(path1: str, path2: str, algorithm: str = "md5") -> str:
    """Compare two files.
    
    Args:
        path1: First file path.
        path2: Second file path.
        algorithm: Hash algorithm for comparison (default: md5).
    
    Returns:
        JSON with comparison results.
    """
    valid1, result_path1 = _validate_path(path1)
    if not valid1:
        return json.dumps({"error": result_path1})
    
    valid2, result_path2 = _validate_path(path2)
    if not valid2:
        return json.dumps({"error": result_path2})
    
    p1 = Path(result_path1)
    p2 = Path(result_path2)
    
    for p, name in [(p1, path1), (p2, path2)]:
        if not p.exists():
            return json.dumps({"error": f"File does not exist: {name}"})
        if not p.is_file():
            return json.dumps({"error": f"Path is not a file: {name}"})
    
    try:
        info1 = _get_file_info(result_path1)
        info2 = _get_file_info(result_path2)
        
        checksum1 = _calculate_checksum(result_path1, algorithm)
        checksum2 = _calculate_checksum(result_path2, algorithm)
        
        are_identical = checksum1 == checksum2
        
        return json.dumps({
            "file1": {
                "path": result_path1,
                "size": info1.size_bytes,
                "checksum": checksum1,
            },
            "file2": {
                "path": result_path2,
                "size": info2.size_bytes,
                "checksum": checksum2,
            },
            "are_identical": are_identical,
            "size_difference": abs(info1.size_bytes - info2.size_bytes),
            "algorithm": algorithm,
        }, indent=2)
    
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


# =============================================================================
# COMPRESSION TOOLS
# =============================================================================

@tool("compress_file_gzip")
def compress_file_gzip(source: str, destination: Optional[str] = None,
                       compress_level: int = 9) -> str:
    """Compress a file using gzip.
    
    Args:
        source: Source file path.
        destination: Destination path (default: source + ".gz").
        compress_level: Compression level 1-9 (default: 9, best).
    
    Returns:
        Success message with compression info.
    """
    valid_src, src_path = _validate_path(source)
    if not valid_src:
        return f"Error: {src_path}"
    
    p = Path(src_path)
    
    if not p.exists():
        return f"Error: File does not exist: {source}"
    
    if not p.is_file():
        return f"Error: Source is not a file: {source}"
    
    dest = destination or str(p) + ".gz"
    valid_dst, dst_path = _validate_path(dest)
    if not valid_dst:
        return f"Error: {dst_path}"
    
    try:
        src_size = p.stat().st_size
        
        with open(src_path, 'rb') as f_in:
            with gzip.open(dst_path, 'wb', compresslevel=compress_level) as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        dst_info = _get_file_info(dst_path)
        ratio = (1 - dst_info.size_bytes / src_size) * 100 if src_size > 0 else 0
        
        return f"Successfully compressed {source} → {dest}\n" \
               f"Original size: {_format_size(src_size)}\n" \
               f"Compressed size: {dst_info.size_human}\n" \
               f"Compression ratio: {ratio:.1f}%"
    
    except (OSError, PermissionError) as e:
        return f"Error compressing file: {e}"


@tool("decompress_file_gzip")
def decompress_file_gzip(source: str, destination: Optional[str] = None) -> str:
    """Decompress a gzip file.
    
    Args:
        source: Source gzip file path.
        destination: Destination path (default: source without .gz).
    
    Returns:
        Success message with decompression info.
    """
    valid_src, src_path = _validate_path(source)
    if not valid_src:
        return f"Error: {src_path}"
    
    p = Path(src_path)
    
    if not p.exists():
        return f"Error: File does not exist: {source}"
    
    if not p.is_file():
        return f"Error: Source is not a file: {source}"
    
    dest = destination or re.sub(r'\.gz$', '', str(p), flags=re.IGNORECASE)
    valid_dst, dst_path = _validate_path(dest)
    if not valid_dst:
        return f"Error: {dst_path}"
    
    try:
        with gzip.open(src_path, 'rb') as f_in:
            with open(dst_path, 'wb') as f_out:
                shutil.copyfileobj(f_in, f_out)
        
        dst_info = _get_file_info(dst_path)
        
        return f"Successfully decompressed {source} → {dest}\n" \
               f"Decompressed size: {dst_info.size_human}"
    
    except (OSError, PermissionError) as e:
        return f"Error decompressing file: {e}"
    except gzip.BadGzipFile:
        return f"Error: Not a valid gzip file: {source}"


@tool("compress_file_zip")
def compress_file_zip(source: str, destination: str,
                      include_hidden: bool = False) -> str:
    """Create a ZIP archive.
    
    Args:
        source: Source file or directory.
        destination: Destination ZIP file path.
        include_hidden: Include hidden files (default: False).
    
    Returns:
        Success message with archive info.
    """
    valid_src, src_path = _validate_path(source)
    if not valid_src:
        return f"Error: {src_path}"
    
    valid_dst, dst_path = _validate_path(destination)
    if not valid_dst:
        return f"Error: {dst_path}"
    
    p = Path(src_path)
    
    if not p.exists():
        return f"Error: Source does not exist: {source}"
    
    try:
        file_count = 0
        dir_count = 0
        
        with zipfile.ZipFile(dst_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            if p.is_file():
                zf.write(src_path, arcname=p.name)
                file_count = 1
            else:
                for root, dirs, files in os.walk(src_path):
                    if not include_hidden:
                        dirs[:] = [d for d in dirs if not d.startswith('.')]
                    
                    for file in files:
                        if not include_hidden and file.startswith('.'):
                            continue
                        
                        file_path = Path(root) / file
                        arcname = str(file_path.relative_to(p.parent))
                        zf.write(file_path, arcname)
                        file_count += 1
                    
                    for dir in dirs:
                        dir_count += 1
        
        dst_info = _get_file_info(dst_path)
        
        return f"Successfully created ZIP archive: {destination}\n" \
               f"Files: {file_count}\n" \
               f"Directories: {dir_count}\n" \
               f"Archive size: {dst_info.size_human}"
    
    except (OSError, PermissionError) as e:
        return f"Error creating ZIP: {e}"


@tool("decompress_file_zip")
def decompress_file_zip(source: str, destination: Optional[str] = None) -> str:
    """Extract a ZIP archive.
    
    Args:
        source: Source ZIP file path.
        destination: Destination directory (default: same as ZIP without extension).
    
    Returns:
        Success message with extraction info.
    """
    valid_src, src_path = _validate_path(source)
    if not valid_src:
        return f"Error: {src_path}"
    
    p = Path(src_path)
    
    if not p.exists():
        return f"Error: File does not exist: {source}"
    
    if not p.is_file():
        return f"Error: Source is not a file: {source}"
    
    dest = destination or str(p).replace('.zip', '', 1).replace('.ZIP', '', 1)
    valid_dst, dst_path = _validate_path(dest)
    if not valid_dst:
        return f"Error: {dst_path}"
    
    try:
        with zipfile.ZipFile(src_path, 'r') as zf:
            members = zf.namelist()
            zf.extractall(dst_path)
        
        return f"Successfully extracted {source} → {dest}\n" \
               f"Files extracted: {len(members)}"
    
    except (OSError, PermissionError) as e:
        return f"Error extracting ZIP: {e}"
    except zipfile.BadZipFile:
        return f"Error: Not a valid ZIP file: {source}"


@tool("list_zip_contents")
def list_zip_contents(path: str) -> str:
    """List contents of a ZIP archive.
    
    Args:
        path: Path to the ZIP file.
    
    Returns:
        JSON with archive contents.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"File does not exist: {path}"})
    
    try:
        with zipfile.ZipFile(result_path, 'r') as zf:
            members = zf.infolist()
            
            contents = []
            for member in members:
                contents.append({
                    "name": member.filename,
                    "size": member.file_size,
                    "compressed_size": member.compress_size,
                    "is_directory": member.is_dir(),
                    "date_time": str(member.date_time) if member.date_time else None,
                })
            
            total_size = sum(m.file_size for m in members)
            compressed_size = sum(m.compress_size for m in members)
            
            return json.dumps({
                "path": result_path,
                "file_count": len([m for m in members if not m.is_dir()]),
                "directory_count": len([m for m in members if m.is_dir()]),
                "total_size": total_size,
                "compressed_size": compressed_size,
                "compression_ratio": (1 - compressed_size / total_size) * 100 if total_size > 0 else 0,
                "contents": contents,
            }, indent=2)
    
    except zipfile.BadZipFile:
        return json.dumps({"error": f"Not a valid ZIP file: {path}"})
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


@tool("compress_file_tar")
def compress_file_tar(source: str, destination: str,
                      include_hidden: bool = False, compress: bool = True) -> str:
    """Create a TAR archive (optionally with gzip compression).
    
    Args:
        source: Source file or directory.
        destination: Destination archive path.
        include_hidden: Include hidden files (default: False).
        compress: Apply gzip compression (default: True).
    
    Returns:
        Success message with archive info.
    """
    valid_src, src_path = _validate_path(source)
    if not valid_src:
        return f"Error: {src_path}"
    
    valid_dst, dst_path = _validate_path(destination)
    if not valid_dst:
        return f"Error: {dst_path}"
    
    p = Path(src_path)
    
    if not p.exists():
        return f"Error: Source does not exist: {source}"
    
    try:
        file_count = 0
        dir_count = 0
        
        mode = 'w:gz' if compress else 'w'
        with tarfile.open(dst_path, mode) as tf:
            if p.is_file():
                tf.add(src_path, arcname=p.name)
                file_count = 1
            else:
                for root, dirs, files in os.walk(src_path):
                    if not include_hidden:
                        dirs[:] = [d for d in dirs if not d.startswith('.')]
                    
                    for file in files:
                        if not include_hidden and file.startswith('.'):
                            continue
                        
                        file_path = Path(root) / file
                        arcname = str(file_path.relative_to(p.parent))
                        tf.add(file_path, arcname=arcname)
                        file_count += 1
                    
                    for dir in dirs:
                        dir_count += 1
        
        dst_info = _get_file_info(dst_path)
        
        return f"Successfully created TAR archive: {destination}\n" \
               f"Files: {file_count}\n" \
               f"Directories: {dir_count}\n" \
               f"Compressed: {'Yes' if compress else 'No'}\n" \
               f"Archive size: {dst_info.size_human}"
    
    except (OSError, PermissionError) as e:
        return f"Error creating TAR: {e}"


@tool("decompress_file_tar")
def decompress_file_tar(source: str, destination: Optional[str] = None) -> str:
    """Extract a TAR archive.
    
    Args:
        source: Source TAR file path.
        destination: Destination directory (default: same as TAR without extension).
    
    Returns:
        Success message with extraction info.
    """
    valid_src, src_path = _validate_path(source)
    if not valid_src:
        return f"Error: {src_path}"
    
    p = Path(src_path)
    
    if not p.exists():
        return f"Error: File does not exist: {source}"
    
    if not p.is_file():
        return f"Error: Source is not a file: {source}"
    
    dest = destination or str(p).replace('.tar.gz', '', 1).replace('.tar.bz2', '', 1).replace('.tar', '', 1)
    valid_dst, dst_path = _validate_path(dest)
    if not valid_dst:
        return f"Error: {dst_path}"
    
    try:
        with tarfile.open(src_path, 'r:*') as tf:
            members = tf.getmembers()
            tf.extractall(dst_path)
        
        return f"Successfully extracted {source} → {dest}\n" \
               f"Members extracted: {len(members)}"
    
    except (OSError, PermissionError) as e:
        return f"Error extracting TAR: {e}"
    except tarfile.TarError:
        return f"Error: Not a valid TAR file: {source}"


@tool("list_tar_contents")
def list_tar_contents(path: str) -> str:
    """List contents of a TAR archive.
    
    Args:
        path: Path to the TAR file.
    
    Returns:
        JSON with archive contents.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"File does not exist: {path}"})
    
    try:
        with tarfile.open(result_path, 'r:*') as tf:
            members = tf.getmembers()
            
            contents = []
            for member in members:
                contents.append({
                    "name": member.name,
                    "size": member.size,
                    "mtime": datetime.fromtimestamp(member.mtime).isoformat() if member.mtime else None,
                    "is_directory": member.isdir(),
                    "is_symlink": member.issym(),
                    "mode": oct(member.mode),
                })
            
            total_size = sum(m.size for m in members if not m.isdir())
            
            return json.dumps({
                "path": result_path,
                "member_count": len(members),
                "file_count": len([m for m in members if m.isfile()]),
                "directory_count": len([m for m in members if m.isdir()]),
                "total_size": total_size,
                "total_size_human": _format_size(total_size),
                "contents": contents,
            }, indent=2)
    
    except tarfile.TarError:
        return json.dumps({"error": f"Not a valid TAR file: {path}"})
    except (OSError, PermissionError) as e:
        return json.dumps({"error": str(e)})


# =============================================================================
# SYMLINK TOOLS
# =============================================================================

@tool("create_symlink")
def create_symlink(target: str, link_path: str) -> str:
    """Create a symbolic link.
    
    Args:
        target: The file or directory the link points to.
        link_path: Path for the new symbolic link.
    
    Returns:
        Success message.
    """
    valid_target, target_path = _validate_path(target)
    if not valid_target:
        return f"Error: {target_path}"
    
    valid_link, link_result = _validate_path(link_path)
    if not valid_link:
        return f"Error: {link_result}"
    
    try:
        if os.path.exists(link_result):
            return f"Error: Link already exists: {link_path}"
        
        os.symlink(target_path, link_result)
        
        return f"Successfully created symlink: {link_path} → {target}"
    
    except OSError as e:
        return f"Error creating symlink: {e}"


@tool("read_symlink")
def read_symlink(path: str) -> str:
    """Read the target of a symbolic link.
    
    Args:
        path: Path to the symbolic link.
    
    Returns:
        The target path or error.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    p = Path(result_path)
    
    if not p.exists():
        return f"Error: Path does not exist: {path}"
    
    if not p.is_symlink():
        return f"Error: Path is not a symbolic link: {path}"
    
    try:
        target = os.readlink(result_path)
        info = _get_file_info(result_path)
        
        return f"Symlink: {path}\n" \
               f"Target: {target}\n" \
               f"Points to existing target: {Path(target).exists() if not target.startswith('/') else os.path.exists(target)}"
    
    except OSError as e:
        return f"Error reading symlink: {e}"


@tool("remove_symlink")
def remove_symlink(path: str) -> str:
    """Remove a symbolic link.
    
    Args:
        path: Path to the symbolic link.
    
    Returns:
        Success message.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    p = Path(result_path)
    
    if not p.exists():
        return f"Error: Path does not exist: {path}"
    
    if not p.is_symlink():
        return f"Error: Path is not a symbolic link: {path}"
    
    try:
        p.unlink()
        return f"Successfully removed symlink: {path}"
    
    except OSError as e:
        return f"Error removing symlink: {e}"


# =============================================================================
# BATCH OPERATIONS
# =============================================================================

@tool("batch_copy")
def batch_copy(sources: List[str], destination: str) -> str:
    """Copy multiple files to a destination directory.
    
    Args:
        sources: List of source file paths.
        destination: Destination directory path.
    
    Returns:
        JSON with copy results.
    """
    valid_dst, dst_path = _validate_path(destination)
    if not valid_dst:
        return json.dumps({"error": dst_path})
    
    # Create destination if needed
    if not _safe_create_directories(dst_path):
        return json.dumps({"error": f"Failed to create directory: {destination}"})
    
    results = []
    errors = []
    
    for source in sources:
        valid_src, src_path = _validate_path(source)
        if not valid_src:
            errors.append({"source": source, "error": src_path})
            continue
        
        src = Path(src_path)
        dest_file = Path(dst_path) / src.name
        
        try:
            if src.is_file():
                shutil.copy2(src_path, dest_file)
                results.append({"source": src_path, "destination": str(dest_file), "success": True})
            else:
                errors.append({"source": source, "error": "Not a file"})
        except Exception as e:
            errors.append({"source": source, "error": str(e)})
    
    return json.dumps({
        "destination": dst_path,
        "successful": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }, indent=2)


@tool("batch_delete")
def batch_delete(paths: List[str], force: bool = False) -> str:
    """Delete multiple files.
    
    Args:
        paths: List of file paths to delete.
        force: Force delete read-only files (default: False).
    
    Returns:
        JSON with deletion results.
    """
    results = []
    errors = []
    
    for path in paths:
        valid, result_path = _validate_path(path)
        if not valid:
            errors.append({"path": path, "error": result_path})
            continue
        
        p = Path(result_path)
        
        if not p.exists():
            errors.append({"path": path, "error": "File does not exist"})
            continue
        
        if p.is_dir():
            errors.append({"path": path, "error": "Path is a directory"})
            continue
        
        try:
            if force and not p.stat().st_mode & stat.S_IWUSR:
                p.chmod(stat.S_IWUSR | stat.S_IRUSR)
            
            p.unlink()
            results.append({"path": result_path, "deleted": True})
        
        except Exception as e:
            errors.append({"path": path, "error": str(e)})
    
    return json.dumps({
        "successful": len(results),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }, indent=2)


@tool("batch_search_replace")
def batch_search_replace(paths: List[str], search_text: str, replace_text: str,
                         encoding: str = "utf-8") -> str:
    """Search and replace in multiple files.
    
    Args:
        paths: List of file paths to process.
        search_text: Text to search for.
        replace_text: Text to replace with.
        encoding: Text encoding (default: utf-8).
    
    Returns:
        JSON with operation results.
    """
    results = []
    errors = []
    
    for path in paths:
        valid, result_path = _validate_path(path)
        if not valid:
            errors.append({"path": path, "error": result_path})
            continue
        
        p = Path(result_path)
        
        if not p.is_file():
            errors.append({"path": path, "error": "Not a file"})
            continue
        
        try:
            with open(result_path, 'r', encoding=encoding) as f:
                content = f.read()
            
            if search_text not in content:
                results.append({"path": result_path, "replacements": 0, "skipped": True})
                continue
            
            count = content.count(search_text)
            new_content = content.replace(search_text, replace_text)
            
            with open(result_path, 'w', encoding=encoding) as f:
                f.write(new_content)
            
            results.append({"path": result_path, "replacements": count, "success": True})
        
        except Exception as e:
            errors.append({"path": path, "error": str(e)})
    
    return json.dumps({
        "processed": len(results),
        "successful": len([r for r in results if r.get('success')]),
        "skipped": len([r for r in results if r.get('skipped')]),
        "failed": len(errors),
        "results": results,
        "errors": errors,
    }, indent=2)


# =============================================================================
# TEMPORARY FILE TOOLS
# =============================================================================

@tool("create_temporary_file")
def create_temporary_file(suffix: str = "", content: Optional[str] = None,
                          encoding: str = "utf-8") -> str:
    """Create a temporary file.
    
    Args:
        suffix: File suffix (extension) for the temp file.
        content: Optional content to write to the file.
        encoding: Text encoding (default: utf-8).
    
    Returns:
        JSON with temporary file path and cleanup function.
    """
    try:
        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        
        if content:
            with os.fdopen(fd, 'w', encoding=encoding) as f:
                f.write(content)
        else:
            os.close(fd)
        
        info = _get_file_info(temp_path)
        
        return json.dumps({
            "path": temp_path,
            "size_bytes": info.size_bytes,
            "note": "Use delete_file() to remove when done",
        }, indent=2)
    
    except OSError as e:
        return json.dumps({"error": str(e)})


@tool("create_temporary_directory")
def create_temporary_directory(prefix: str = "") -> str:
    """Create a temporary directory.
    
    Args:
        prefix: Prefix for the directory name.
    
    Returns:
        JSON with temporary directory path.
    """
    try:
        temp_dir = tempfile.mkdtemp(prefix=prefix)
        
        return json.dumps({
            "path": temp_dir,
            "note": "Use remove_directory(recursive=True) to remove when done",
        }, indent=2)
    
    except OSError as e:
        return json.dumps({"error": str(e)})


# =============================================================================
# SPECIALIZED FILE FORMAT TOOLS
# =============================================================================

@tool("read_csv")
def read_csv(path: str, delimiter: str = ",", has_header: bool = True) -> str:
    """Read a CSV file and return as JSON.
    
    Args:
        path: Path to the CSV file.
        delimiter: CSV delimiter (default: ,).
        has_header: Whether the CSV has a header row (default: True).
    
    Returns:
        JSON with CSV data.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    try:
        rows = []
        with open(result_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.reader(f, delimiter=delimiter)
            
            if has_header:
                headers = next(reader)
            else:
                headers = [f"col_{i}" for i in range(len(next(reader)))]
            
            for row in reader:
                if has_header:
                    rows.append(dict(zip(headers, row)))
                else:
                    rows.append(row)
        
        return json.dumps({
            "path": result_path,
            "rows": len(rows),
            "columns": len(headers),
            "has_header": has_header,
            "headers": headers if has_header else None,
            "data": rows[:100],  # Limit output
            "truncated": len(rows) > 100,
        }, indent=2)
    
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("write_csv")
def write_csv(path: str, data: List[Dict[str, Any]], create_parents: bool = True) -> str:
    """Write data to a CSV file.
    
    Args:
        path: Path to the CSV file.
        data: List of dictionaries (rows) to write.
        create_parents: Create parent directories if needed (default: True).
    
    Returns:
        Success message.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    if create_parents:
        if not _safe_create_directories(Path(result_path).parent):
            return f"Error: Failed to create parent directories"
    
    try:
        if not data:
            return f"Error: No data provided"
        
        headers = list(data[0].keys()) if isinstance(data[0], dict) else list(range(len(data[0])))
        
        with open(result_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            writer.writerows(data)
        
        info = _get_file_info(result_path)
        
        return f"Successfully wrote CSV: {path}\n" \
               f"Rows: {len(data)}\n" \
               f"Columns: {len(headers)}\n" \
               f"Size: {info.size_human}"
    
    except Exception as e:
        return f"Error writing CSV: {e}"


@tool("read_json")
def read_json(path: str) -> str:
    """Read a JSON file.
    
    Args:
        path: Path to the JSON file.
    
    Returns:
        JSON content or error.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    try:
        with open(result_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return json.dumps({
            "path": result_path,
            "data": data,
            "type": type(data).__name__,
        }, indent=2, default=str)
    
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON: {e}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("write_json")
def write_json(path: str, data: Any, indent: int = 2, create_parents: bool = True) -> str:
    """Write data to a JSON file.
    
    Args:
        path: Path to the JSON file.
        data: Data to write (will be JSON serialized).
        indent: JSON indentation (default: 2).
        create_parents: Create parent directories if needed (default: True).
    
    Returns:
        Success message.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    if create_parents:
        if not _safe_create_directories(Path(result_path).parent):
            return f"Error: Failed to create parent directories"
    
    try:
        with open(result_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=indent, ensure_ascii=False)
        
        info = _get_file_info(result_path)
        
        return f"Successfully wrote JSON: {path}\n" \
               f"Size: {info.size_human}"
    
    except TypeError as e:
        return f"Error: Data is not JSON serializable: {e}"
    except Exception as e:
        return f"Error writing JSON: {e}"


@tool("read_xml")
def read_xml(path: str) -> str:
    """Read an XML file.
    
    Args:
        path: Path to the XML file.
    
    Returns:
        JSON representation of XML or error.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    try:
        tree = ET.parse(result_path)
        root = tree.getroot()
        
        def etree_to_dict(t):
            d = {t.tag: {} if t.attrib else None}
            children = list(t)
            if children:
                dd = {}
                for child in children:
                    child_data = etree_to_dict(child)
                    if child.tag in dd:
                        if not isinstance(dd[child.tag], list):
                            dd[child.tag] = [dd[child.tag]]
                        dd[child.tag].append(child_data[child.tag])
                    else:
                        dd[child.tag] = child_data[child.tag]
                    d = {t.tag: dd}
            if t.attrib:
                d[t.tag]['@attributes'] = t.attrib
            if t.text and t.text.strip():
                d[t.tag]['#text'] = t.text.strip()
            return d
        
        data = etree_to_dict(root)
        
        return json.dumps({
            "path": result_path,
            "root_tag": root.tag,
            "data": data,
        }, indent=2)
    
    except ET.ParseError as e:
        return json.dumps({"error": f"Invalid XML: {e}"})
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("write_xml")
def write_xml(path: str, root_tag: str, data: Dict[str, Any], 
              create_parents: bool = True) -> str:
    """Write data to an XML file.
    
    Args:
        path: Path to the XML file.
        root_tag: Name for the root element.
        data: Dictionary data to convert to XML.
        create_parents: Create parent directories if needed (default: True).
    
    Returns:
        Success message.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return f"Error: {result_path}"
    
    if create_parents:
        if not _safe_create_directories(Path(result_path).parent):
            return f"Error: Failed to create parent directories"
    
    try:
        def dict_to_etree(tag, d):
            elem = ET.Element(tag)
            if isinstance(d, dict):
                for key, value in d.items():
                    if key == '@attributes':
                        elem.attrib = value
                    elif isinstance(value, dict):
                        elem.append(dict_to_etree(key, value))
                    elif isinstance(value, list):
                        for item in value:
                            elem.append(dict_to_etree(key, item))
                    else:
                        child = ET.SubElement(elem, key)
                        if value is not None:
                            child.text = str(value)
            elif d is not None:
                elem.text = str(d)
            return elem
        
        root = dict_to_etree(root_tag, data)
        tree = ET.ElementTree(root)
        
        with open(result_path, 'wb') as f:
            tree.write(f, encoding='utf-8', xml_declaration=True)
        
        info = _get_file_info(result_path)
        
        return f"Successfully wrote XML: {path}\n" \
               f"Root tag: {root_tag}\n" \
               f"Size: {info.size_human}"
    
    except Exception as e:
        return f"Error writing XML: {e}"


# =============================================================================
# FILE CONTENT ANALYSIS TOOLS
# =============================================================================

@tool("count_lines")
def count_lines(path: str) -> str:
    """Count lines in a file.
    
    Args:
        path: Path to the file.
    
    Returns:
        JSON with line counts.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"File does not exist: {path}"})
    
    if p.is_dir():
        return json.dumps({"error": f"Path is a directory: {path}"})
    
    try:
        with open(result_path, 'rb') as f:
            lines = 0
            for line in f:
                lines += 1
        
        info = _get_file_info(result_path)
        
        return json.dumps({
            "path": result_path,
            "line_count": lines,
            "size_bytes": info.size_bytes,
            "bytes_per_line": round(info.size_bytes / lines, 2) if lines > 0 else 0,
        }, indent=2)
    
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("count_words")
def count_words(path: str, encoding: str = "utf-8") -> str:
    """Count words in a text file.
    
    Args:
        path: Path to the file.
        encoding: Text encoding (default: utf-8).
    
    Returns:
        JSON with word counts.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    try:
        with open(result_path, 'r', encoding=encoding, errors='ignore') as f:
            content = f.read()
        
        words = content.split()
        word_count = len(words)
        char_count = len(content)
        char_no_space = len(content.replace(' ', '').replace('\n', ''))
        
        info = _get_file_info(result_path)
        
        return json.dumps({
            "path": result_path,
            "word_count": word_count,
            "char_count": char_count,
            "char_count_no_spaces": char_no_space,
            "line_count": content.count('\n') + 1,
            "avg_word_length": round(char_no_space / word_count, 2) if word_count > 0 else 0,
        }, indent=2)
    
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("get_file_type")
def get_file_type(path: str) -> str:
    """Detect file type using magic numbers.
    
    Args:
        path: Path to the file.
    
    Returns:
        JSON with file type information.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    p = Path(result_path)
    
    if not p.exists():
        return json.dumps({"error": f"File does not exist: {path}"})
    
    if p.is_dir():
        return json.dumps({
            "path": result_path,
            "file_type": "directory",
            "mime_type": "inode/directory",
        })
    
    # Common magic numbers
    magic_numbers = {
        b'\x1f\x8b': 'gzip',
        b'PK\x03\x04': 'zip',
        b'PK\x05\x06': 'empty zip',
        b'%PDF': 'pdf',
        b'\x89PNG\r\n\x1a\n': 'png',
        b'\xff\xd8\xff': 'jpeg',
        b'GIF87a': 'gif87a',
        b'GIF89a': 'gif89a',
        b'\x00\x00\x01\x00': 'ico',
        b'\x1f\x9d': 'compress',
        b'BZh': 'bzip2',
        b'\x7fELF': 'elf',
        b'\xca\xfe\xba\xbe': 'java class',
        b'<!DOCTYPE html': 'html',
        b'<!DOCTYPE htm': 'html',
        b'<html': 'html',
        b'<?xml': 'xml',
        b'\xef\xbb\xbf<?xml': 'xml (with BOM)',
    }
    
    mime_types = {
        'gzip': 'application/gzip',
        'zip': 'application/zip',
        'pdf': 'application/pdf',
        'png': 'image/png',
        'jpeg': 'image/jpeg',
        'gif87a': 'image/gif',
        'gif89a': 'image/gif',
        'ico': 'image/x-icon',
        'compress': 'application/x-compress',
        'bzip2': 'application/x-bzip2',
        'elf': 'application/x-executable',
        'java class': 'application/java-vm',
        'html': 'text/html',
        'xml': 'application/xml',
    }
    
    try:
        with open(result_path, 'rb') as f:
            header = f.read(32)
        
        file_type = 'unknown'
        mime_type = 'application/octet-stream'
        
        for magic, ft in magic_numbers.items():
            if header.startswith(magic):
                file_type = ft
                mime_type = mime_types.get(ft, mime_type)
                break
        
        # Try extension-based detection
        if file_type == 'unknown':
            ext = p.suffix.lower()
            ext_mimes = {
                '.txt': 'text/plain',
                '.json': 'application/json',
                '.csv': 'text/csv',
                '.py': 'text/x-python',
                '.js': 'application/javascript',
                '.ts': 'application/typescript',
                '.html': 'text/html',
                '.css': 'text/css',
                '.md': 'text/markdown',
                '.yaml': 'application/yaml',
                '.yml': 'application/yaml',
            }
            mime_type = ext_mimes.get(ext, mime_type)
            if ext in ext_mimes:
                file_type = f'text ({ext.lstrip(".")})'
        
        info = _get_file_info(result_path)
        
        return json.dumps({
            "path": result_path,
            "file_type": file_type,
            "mime_type": mime_type,
            "size": info.size_human,
            "extension": info.extension,
        }, indent=2)
    
    except Exception as e:
        return json.dumps({"error": str(e)})


# =============================================================================
# FILE CHANGE MONITORING TOOLS
# =============================================================================

@tool("get_file_hash")
def get_file_hash(path: str, algorithm: str = "sha256") -> str:
    """Get a hash of file content for change detection.
    
    Args:
        path: Path to the file.
        algorithm: Hash algorithm (md5, sha1, sha256, sha512).
    
    Returns:
        JSON with hash and metadata.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    try:
        checksum = _calculate_checksum(result_path, algorithm)
        info = _get_file_info(result_path)
        
        return json.dumps({
            "path": result_path,
            "algorithm": algorithm,
            "hash": checksum,
            "modified_at": info.modified_at,
            "size_bytes": info.size_bytes,
        }, indent=2)
    
    except Exception as e:
        return json.dumps({"error": str(e)})


@tool("check_file_changed")
def check_file_changed(path: str, previous_hash: str, 
                       algorithm: str = "sha256") -> str:
    """Check if a file has changed based on its hash.
    
    Args:
        path: Path to the file.
        previous_hash: Previously recorded hash.
        algorithm: Hash algorithm (default: sha256).
    
    Returns:
        JSON with change status.
    """
    valid, result_path = _validate_path(path)
    if not valid:
        return json.dumps({"error": result_path})
    
    try:
        current_hash = _calculate_checksum(result_path, algorithm)
        
        if not current_hash:
            return json.dumps({
                "error": "Could not calculate file hash",
                "path": path,
            })
        
        changed = current_hash != previous_hash
        info = _get_file_info(result_path)
        
        return json.dumps({
            "path": result_path,
            "has_changed": changed,
            "previous_hash": previous_hash,
            "current_hash": current_hash,
            "current_modified_at": info.modified_at,
        }, indent=2)
    
    except Exception as e:
        return json.dumps({"error": str(e)})


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def get_all_file_ops_tools() -> list:
    """Get all file operations tools."""
    tools = [
        # Reading
        read_file,
        read_file_binary,
        read_file_lines,
        read_file_lines_batch,
        read_file_stream,
        
        # Writing
        write_to_file,
        append_to_file,
        write_file_lines,
        write_file_binary,
        copy_file,
        
        # Editing
        search_and_replace,
        search_and_replace_regex,
        insert_content_at_line,
        delete_lines,
        replace_line,
        
        # Management
        delete_file,
        move_file,
        rename_file,
        truncate_file,
        
        # Directory
        list_directory,
        list_directory_tree,
        create_directory,
        remove_directory,
        get_directory_size,
        
        # Search
        glob_files,
        search_files_content,
        search_files_regex,
        find_files_by_size,
        find_files_by_date,
        
        # Metadata
        get_file_info,
        get_file_checksum,
        get_file_permissions,
        set_file_permissions,
        compare_files,
        
        # Compression
        compress_file_gzip,
        decompress_file_gzip,
        compress_file_zip,
        decompress_file_zip,
        list_zip_contents,
        compress_file_tar,
        decompress_file_tar,
        list_tar_contents,
        
        # Symlinks
        create_symlink,
        read_symlink,
        remove_symlink,
        
        # Batch
        batch_copy,
        batch_delete,
        batch_search_replace,
        
        # Temporary
        create_temporary_file,
        create_temporary_directory,
        
        # File Formats
        read_csv,
        write_csv,
        read_json,
        write_json,
        read_xml,
        write_xml,
        
        # Analysis
        count_lines,
        count_words,
        get_file_type,
        
        # Monitoring
        get_file_hash,
        check_file_changed,
    ]
    
    return tools


__all__ = [
    # Data classes
    "FileInfo",
    "SearchResult",
    "DiffResult",
    "FileType",
    "PermissionLevel",
    
    # Reading tools
    "read_file",
    "read_file_binary",
    "read_file_lines",
    "read_file_lines_batch",
    "read_file_stream",
    
    # Writing tools
    "write_to_file",
    "append_to_file",
    "write_file_lines",
    "write_file_binary",
    "copy_file",
    
    # Editing tools
    "search_and_replace",
    "search_and_replace_regex",
    "insert_content_at_line",
    "delete_lines",
    "replace_line",
    
    # Management tools
    "delete_file",
    "move_file",
    "rename_file",
    "truncate_file",
    
    # Directory tools
    "list_directory",
    "list_directory_tree",
    "create_directory",
    "remove_directory",
    "get_directory_size",
    
    # Search tools
    "glob_files",
    "search_files_content",
    "search_files_regex",
    "find_files_by_size",
    "find_files_by_date",
    
    # Metadata tools
    "get_file_info",
    "get_file_checksum",
    "get_file_permissions",
    "set_file_permissions",
    "compare_files",
    
    # Compression tools
    "compress_file_gzip",
    "decompress_file_gzip",
    "compress_file_zip",
    "decompress_file_zip",
    "list_zip_contents",
    "compress_file_tar",
    "decompress_file_tar",
    "list_tar_contents",
    
    # Symlink tools
    "create_symlink",
    "read_symlink",
    "remove_symlink",
    
    # Batch tools
    "batch_copy",
    "batch_delete",
    "batch_search_replace",
    
    # Temporary tools
    "create_temporary_file",
    "create_temporary_directory",
    
    # File format tools
    "read_csv",
    "write_csv",
    "read_json",
    "write_json",
    "read_xml",
    "write_xml",
    
    # Analysis tools
    "count_lines",
    "count_words",
    "get_file_type",
    
    # Monitoring tools
    "get_file_hash",
    "check_file_changed",
    
    # Functions
    "get_all_file_ops_tools",
]
