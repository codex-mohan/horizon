"""Shell execution tools for the Horizon agent.

This module provides shell command execution tools that use the @horizon/shell
package for cross-platform command execution. It includes both interactive and
non-interactive modes.

Security Considerations:
- For LOCAL mode: Commands execute directly on the host system (full access)
- For DEPLOYED mode: Commands should be routed through the sandbox service

The execution mode is determined by the HORIZON_EXECUTION_MODE environment variable:
- "local" (default): Direct host execution using @horizon/shell
- "sandbox": Route commands through the sandbox service
"""

import os
import json
import asyncio
import subprocess
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from langchain_core.tools import tool
from rich.console import Console

console = Console()


class ExecutionMode(Enum):
    """Execution mode for shell commands."""

    LOCAL = "local"
    SANDBOX = "sandbox"


@dataclass
class ShellResult:
    """Result of a shell command execution."""

    command: str
    stdout: str
    stderr: str
    exit_code: int
    success: bool
    duration_ms: int
    cwd: str
    truncated: bool = False
    approved: bool = True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "command": self.command,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "exit_code": self.exit_code,
            "success": self.success,
            "duration_ms": self.duration_ms,
            "cwd": self.cwd,
            "truncated": self.truncated,
        }


@dataclass
class ShellSession:
    """Stateful shell session for interactive execution."""

    session_id: str
    cwd: str
    env: Dict[str, str] = field(default_factory=dict)
    history: List[ShellResult] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)


# Global session storage
_sessions: Dict[str, ShellSession] = {}


def get_execution_mode() -> ExecutionMode:
    """Get the current execution mode from environment."""
    mode = os.environ.get("HORIZON_EXECUTION_MODE", "local").lower()
    return ExecutionMode(mode) if mode in [m.value for m in ExecutionMode] else ExecutionMode.LOCAL


def get_or_create_session(session_id: Optional[str] = None) -> ShellSession:
    """Get or create a shell session."""
    if session_id is None:
        session_id = f"session-{datetime.now().timestamp()}"

    if session_id not in _sessions:
        _sessions[session_id] = ShellSession(
            session_id=session_id,
            cwd=os.getcwd(),
            env=dict(os.environ),
        )

    session = _sessions[session_id]
    session.last_activity = datetime.now()
    return session


async def execute_via_bun_shell(
    command: str,
    cwd: str,
    env: Optional[Dict[str, str]] = None,
    timeout: int = 30000,
) -> ShellResult:
    """Execute a command using Bun's shell via subprocess.

    This function calls a Bun script that uses $`command` for cross-platform
    shell execution.
    """
    start_time = datetime.now()

    # Build the Bun command
    # We use Bun to execute the shell command for cross-platform compatibility
    bun_script = f'''
    import {{ $ }} from "bun";
    const result = await $`{command.replace("`", "\\`").replace("$", "\\$")}`.quiet().nothrow();
    console.log(JSON.stringify({{
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
        exitCode: result.exitCode
    }}));
    '''

    try:
        process = await asyncio.create_subprocess_exec(
            "bun",
            "-e",
            bun_script,
            cwd=cwd,
            env={**os.environ, **(env or {})},
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout / 1000,
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return ShellResult(
                command=command,
                stdout="",
                stderr=f"Command timed out after {timeout}ms",
                exit_code=-1,
                success=False,
                duration_ms=timeout,
                cwd=cwd,
            )

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        # Parse the JSON output from Bun
        try:
            result_data = json.loads(stdout_bytes.decode())
            return ShellResult(
                command=command,
                stdout=result_data.get("stdout", ""),
                stderr=result_data.get("stderr", ""),
                exit_code=result_data.get("exitCode", 0),
                success=result_data.get("exitCode", 0) == 0,
                duration_ms=duration_ms,
                cwd=cwd,
            )
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return ShellResult(
                command=command,
                stdout=stdout_bytes.decode(),
                stderr=stderr_bytes.decode(),
                exit_code=process.returncode or 0,
                success=process.returncode == 0,
                duration_ms=duration_ms,
                cwd=cwd,
            )

    except FileNotFoundError:
        # Bun not found, fall back to native subprocess
        return await execute_native(command, cwd, env, timeout)
    except Exception as e:
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        return ShellResult(
            command=command,
            stdout="",
            stderr=str(e),
            exit_code=-1,
            success=False,
            duration_ms=duration_ms,
            cwd=cwd,
        )


async def execute_native(
    command: str,
    cwd: str,
    env: Optional[Dict[str, str]] = None,
    timeout: int = 30000,
) -> ShellResult:
    """Execute a command using native subprocess (fallback)."""
    start_time = datetime.now()

    try:
        # Use shell=True for complex commands
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            env={**os.environ, **(env or {})},
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout / 1000,
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return ShellResult(
                command=command,
                stdout="",
                stderr=f"Command timed out after {timeout}ms",
                exit_code=-1,
                success=False,
                duration_ms=timeout,
                cwd=cwd,
            )

        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)

        return ShellResult(
            command=command,
            stdout=stdout_bytes.decode(errors="replace"),
            stderr=stderr_bytes.decode(errors="replace"),
            exit_code=process.returncode or 0,
            success=process.returncode == 0,
            duration_ms=duration_ms,
            cwd=cwd,
        )

    except Exception as e:
        duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        return ShellResult(
            command=command,
            stdout="",
            stderr=str(e),
            exit_code=-1,
            success=False,
            duration_ms=duration_ms,
            cwd=cwd,
        )


async def execute_via_sandbox(
    command: str,
    cwd: str,
    timeout: int = 30000,
) -> ShellResult:
    """Execute a command through the sandbox service (for deployed mode)."""
    # TODO: Implement sandbox execution via Docker/HTTP API
    # For now, fall back to native execution with a warning
    console.log("[yellow]Warning: Sandbox execution not yet implemented, using native[/yellow]")
    return await execute_native(command, cwd, timeout=timeout)


# =============================================================================
# LANGCHAIN TOOLS
# =============================================================================


@tool
def run_shell_command(
    command: str,
    cwd: Optional[str] = None,
    timeout_ms: int = 30000,
) -> str:
    """Execute a shell command and return the result.

    This tool executes shell commands on the system. It uses Bun's cross-platform
    shell which provides Unix-style commands (ls, cat, grep, etc.) even on Windows.

    Args:
        command: The shell command to execute.
        cwd: Working directory for the command. Defaults to current directory.
        timeout_ms: Maximum execution time in milliseconds. Default is 30000 (30s).

    Returns:
        JSON string with command result including stdout, stderr, exit_code, and success.

    Examples:
        - List files: run_shell_command("ls -la")
        - Read file: run_shell_command("cat README.md")
        - Find files: run_shell_command("find . -name '*.py'")
        - Check git status: run_shell_command("git status")
    """
    console.log(f"[bold blue]Executing:[/bold blue] {command}")

    mode = get_execution_mode()
    working_dir = cwd or os.getcwd()

    # Run async function
    loop = asyncio.new_event_loop()
    try:
        if mode == ExecutionMode.SANDBOX:
            result = loop.run_until_complete(
                execute_via_sandbox(command, working_dir, timeout_ms)
            )
        else:
            result = loop.run_until_complete(
                execute_via_bun_shell(command, working_dir, timeout=timeout_ms)
            )
    finally:
        loop.close()

    if result.success:
        console.log(f"[green]✓ Command succeeded[/green] (exit code: {result.exit_code})")
    else:
        console.log(f"[red]✗ Command failed[/red] (exit code: {result.exit_code})")

    return json.dumps(result.to_dict(), indent=2)


@tool
def run_interactive_command(
    command: str,
    session_id: Optional[str] = None,
    timeout_ms: int = 30000,
) -> str:
    """Execute a command in an interactive shell session.

    This maintains state across commands (working directory, environment variables).
    Use this for workflows that require multiple commands that depend on each other.

    Args:
        command: The shell command to execute.
        session_id: Optional session ID to continue an existing session.
        timeout_ms: Maximum execution time in milliseconds.

    Returns:
        JSON string with command result and session information.

    Examples:
        - Start session: run_interactive_command("cd /path/to/project", session_id="dev")
        - Continue: run_interactive_command("npm install", session_id="dev")
        - Check state: run_interactive_command("pwd", session_id="dev")
    """
    session = get_or_create_session(session_id)
    console.log(f"[bold blue]Session {session.session_id}:[/bold blue] {command}")

    # Handle built-in commands
    trimmed = command.strip()
    parts = trimmed.split(None, 1)
    cmd = parts[0].lower() if parts else ""

    if cmd == "cd":
        target = parts[1] if len(parts) > 1 else os.path.expanduser("~")

        # Handle special paths
        if target == "-":
            target = session.env.get("OLDPWD", session.cwd)
        elif target == "~":
            target = os.path.expanduser("~")

        # Resolve path
        if not os.path.isabs(target):
            target = os.path.normpath(os.path.join(session.cwd, target))

        if os.path.isdir(target):
            session.env["OLDPWD"] = session.cwd
            session.cwd = target
            result = ShellResult(
                command=command,
                stdout="",
                stderr="",
                exit_code=0,
                success=True,
                duration_ms=0,
                cwd=session.cwd,
            )
        else:
            result = ShellResult(
                command=command,
                stdout="",
                stderr=f"cd: {target}: No such file or directory",
                exit_code=1,
                success=False,
                duration_ms=0,
                cwd=session.cwd,
            )

        session.history.append(result)
        return json.dumps({
            "result": result.to_dict(),
            "session": {
                "id": session.session_id,
                "cwd": session.cwd,
                "command_count": len(session.history),
            },
        }, indent=2)

    if cmd == "pwd":
        result = ShellResult(
            command=command,
            stdout=session.cwd,
            stderr="",
            exit_code=0,
            success=True,
            duration_ms=0,
            cwd=session.cwd,
        )
        session.history.append(result)
        return json.dumps({
            "result": result.to_dict(),
            "session": {
                "id": session.session_id,
                "cwd": session.cwd,
                "command_count": len(session.history),
            },
        }, indent=2)

    # Execute regular command
    mode = get_execution_mode()

    loop = asyncio.new_event_loop()
    try:
        if mode == ExecutionMode.SANDBOX:
            result = loop.run_until_complete(
                execute_via_sandbox(command, session.cwd, timeout_ms)
            )
        else:
            result = loop.run_until_complete(
                execute_via_bun_shell(command, session.cwd, session.env, timeout_ms)
            )
    finally:
        loop.close()

    session.history.append(result)

    if result.success:
        console.log(f"[green]✓ Command succeeded[/green]")
    else:
        console.log(f"[red]✗ Command failed[/red] (exit code: {result.exit_code})")

    return json.dumps({
        "result": result.to_dict(),
        "session": {
            "id": session.session_id,
            "cwd": session.cwd,
            "command_count": len(session.history),
        },
    }, indent=2)


@tool
def get_session_info(session_id: str) -> str:
    """Get information about a shell session.

    Args:
        session_id: The session ID to look up.

    Returns:
        JSON string with session information including cwd, history count, etc.
    """
    if session_id not in _sessions:
        return json.dumps({"error": f"Session '{session_id}' not found"})

    session = _sessions[session_id]
    return json.dumps({
        "id": session.session_id,
        "cwd": session.cwd,
        "command_count": len(session.history),
        "created_at": session.created_at.isoformat(),
        "last_activity": session.last_activity.isoformat(),
    }, indent=2)


@tool
def list_sessions() -> str:
    """List all active shell sessions.

    Returns:
        JSON string with list of active sessions.
    """
    sessions_info = []
    for session in _sessions.values():
        sessions_info.append({
            "id": session.session_id,
            "cwd": session.cwd,
            "command_count": len(session.history),
            "last_activity": session.last_activity.isoformat(),
        })

    return json.dumps({"sessions": sessions_info}, indent=2)


@tool
def close_session(session_id: str) -> str:
    """Close and clean up a shell session.

    Args:
        session_id: The session ID to close.

    Returns:
        Confirmation message.
    """
    if session_id in _sessions:
        del _sessions[session_id]
        return f"Session '{session_id}' closed."
    return f"Session '{session_id}' not found."


def get_all_shell_tools():
    """Get all shell execution tools."""
    return [
        run_shell_command,
        run_interactive_command,
        get_session_info,
        list_sessions,
        close_session,
    ]


__all__ = [
    "run_shell_command",
    "run_interactive_command",
    "get_session_info",
    "list_sessions",
    "close_session",
    "get_all_shell_tools",
    "ShellResult",
    "ShellSession",
    "ExecutionMode",
]
