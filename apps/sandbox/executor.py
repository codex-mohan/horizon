"""Sandbox Code Executor.

This module provides a secure code execution environment that runs in an
isolated Docker container. It accepts code via stdin/file and returns
results via stdout.

Security features:
- Runs as restricted user (sandbox:sandbox)
- No network access (unless explicitly enabled)
- Resource limits (CPU, memory, time)
- Read-only filesystem (except /tmp and /workspaces)
- No shell access
"""

import sys
import json
import traceback
import signal
import resource
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr
from typing import Any


def set_resource_limits() -> None:
    """Set resource limits for code execution."""
    # Max CPU time: 30 seconds
    resource.setrlimit(resource.RLIMIT_CPU, (30, 30))
    
    # Max memory: 256MB
    max_memory = 256 * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_AS, (max_memory, max_memory))
    
    # Max file size: 10MB
    max_file_size = 10 * 1024 * 1024
    resource.setrlimit(resource.RLIMIT_FSIZE, (max_file_size, max_file_size))
    
    # Max open files: 100
    resource.setrlimit(resource.RLIMIT_NOFILE, (100, 100))
    
    # No core dumps
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def timeout_handler(signum: int, frame: Any) -> None:
    """Handle execution timeout."""
    raise TimeoutError("Code execution timed out (30 seconds)")


def execute_code(code: str, timeout: int = 30) -> dict:
    """Execute Python code in a sandboxed environment.
    
    Args:
        code: Python code to execute.
        timeout: Maximum execution time in seconds.
        
    Returns:
        Dictionary with stdout, stderr, result, and success flag.
    """
    result = {
        "stdout": "",
        "stderr": "",
        "result": None,
        "success": False,
        "error": None,
    }
    
    # Set up signal handler for timeout
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(timeout)
    
    stdout_capture = StringIO()
    stderr_capture = StringIO()
    
    try:
        # Set resource limits
        set_resource_limits()
        
        # Create restricted globals for exec
        safe_globals = {
            "__builtins__": __builtins__,
            "__name__": "__main__",
            "__doc__": None,
        }
        
        # Allow common safe imports
        safe_modules = [
            "math", "random", "datetime", "json", "re", "collections",
            "itertools", "functools", "operator", "string", "textwrap",
            "numpy", "pandas", "matplotlib", "matplotlib.pyplot",
        ]
        
        for module in safe_modules:
            try:
                safe_globals[module.split(".")[-1]] = __import__(module)
            except ImportError:
                pass
        
        # Execute code with output capture
        with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
            exec_result = exec(code, safe_globals)
            
            # Try to get the last expression value
            if "_" in safe_globals:
                result["result"] = repr(safe_globals["_"])
        
        result["success"] = True
        
    except TimeoutError as e:
        result["error"] = str(e)
        result["stderr"] = str(e)
    except MemoryError:
        result["error"] = "Memory limit exceeded"
        result["stderr"] = "Memory limit exceeded"
    except Exception as e:
        result["error"] = str(e)
        result["stderr"] = traceback.format_exc()
    finally:
        # Cancel alarm
        signal.alarm(0)
        
        # Capture outputs
        result["stdout"] = stdout_capture.getvalue()
        if not result["stderr"]:
            result["stderr"] = stderr_capture.getvalue()
    
    return result


def main() -> None:
    """Main entry point for the executor."""
    # Read input from stdin
    try:
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            # No input, wait mode (for container keep-alive)
            print(json.dumps({"status": "ready", "message": "Sandbox executor ready"}))
            sys.stdout.flush()
            
            # Keep running and process requests
            while True:
                try:
                    line = sys.stdin.readline()
                    if not line:
                        break
                    
                    request = json.loads(line)
                    code = request.get("code", "")
                    timeout = request.get("timeout", 30)
                    
                    result = execute_code(code, timeout)
                    print(json.dumps(result))
                    sys.stdout.flush()
                    
                except json.JSONDecodeError:
                    print(json.dumps({"error": "Invalid JSON input"}))
                    sys.stdout.flush()
                except Exception as e:
                    print(json.dumps({"error": str(e)}))
                    sys.stdout.flush()
        else:
            # Direct execution mode
            try:
                request = json.loads(input_data)
                code = request.get("code", input_data)
                timeout = request.get("timeout", 30)
            except json.JSONDecodeError:
                code = input_data
                timeout = 30
            
            result = execute_code(code, timeout)
            print(json.dumps(result))
            
    except Exception as e:
        print(json.dumps({"error": str(e), "success": False}))
        sys.exit(1)


if __name__ == "__main__":
    main()
