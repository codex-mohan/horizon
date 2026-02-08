from typing import Any, Optional
from abc import ABC
from agent.state import AgentState
from rich.console import Console
from rich.logging import RichHandler
from rich.traceback import install as install_rich_traceback
import logging
import traceback
from datetime import datetime

# Install rich traceback for better error visualization
install_rich_traceback(show_locals=True, width=120)

# Setup rich console
console = Console()

# Setup rich logger
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
    datefmt="[%X]",
    handlers=[RichHandler(console=console, rich_tracebacks=True, markup=True)]
)
logger = logging.getLogger("agent.middleware")


class MiddlewareError(Exception):
    """Base exception for middleware errors."""
    
    def __init__(self, middleware_name: str, message: str, original_error: Optional[Exception] = None):
        self.middleware_name = middleware_name
        self.message = message
        self.original_error = original_error
        self.timestamp = datetime.now()
        super().__init__(f"[{middleware_name}] {message}")
    
    def log(self, level: str = "error"):
        """Log this error with Rich formatting."""
        error_msg = f"[bold red]Middleware Error[/bold red] in [cyan]{self.middleware_name}[/cyan]: {self.message}"
        
        if level == "error":
            logger.error(error_msg)
        elif level == "warning":
            logger.warning(error_msg)
        else:
            logger.info(error_msg)
            
        if self.original_error:
            logger.error(f"Original error: {type(self.original_error).__name__}: {str(self.original_error)}")


def log_middleware_error(middleware_name: str, error: Exception, context: str = "") -> None:
    """Log a middleware error with rich formatting."""
    timestamp = datetime.now().strftime("%H:%M:%S")
    
    console.print(f"\n[bold red]{'─' * 60}[/bold red]")
    console.print(f"[bold red]⚠ MIDDLEWARE ERROR[/bold red] [{timestamp}]")
    console.print(f"[bold cyan]Middleware:[/bold cyan] {middleware_name}")
    if context:
        console.print(f"[bold cyan]Context:[/bold cyan] {context}")
    console.print(f"[bold cyan]Error Type:[/bold cyan] {type(error).__name__}")
    console.print(f"[bold cyan]Message:[/bold cyan] {str(error)}")
    console.print(f"[bold red]{'─' * 60}[/bold red]\n")
    
    # Log the full traceback at debug level
    logger.debug(f"Full traceback:\n{traceback.format_exc()}")


def safe_execute(func):
    """Decorator for safe middleware execution with error logging."""
    async def wrapper(self, state: AgentState, *args, **kwargs) -> dict[str, Any]:
        try:
            result = await func(self, state, *args, **kwargs)
            return result if result is not None else {}
        except Exception as e:
            log_middleware_error(
                self.name if hasattr(self, 'name') else func.__name__,
                e,
                context=f"Executing {func.__name__}"
            )
            # Return empty dict to allow graph to continue gracefully
            return {"_middleware_error": {
                "middleware": self.name if hasattr(self, 'name') else func.__name__,
                "error": str(e),
                "error_type": type(e).__name__,
            }}
    return wrapper


class BaseMiddleware(ABC):
    """Base class for all middleware.
    
    Middleware lifecycle hooks (in order):
    1. before_agent: Run once before agent starts
    2. before_model: Run before each model call
    3. after_model: Run after each model call (before tools)
    4. after_tools: Run after tool execution (if tools were called)
    5. after_agent: Run once after agent completes
    
    All hooks are wrapped with error handling to prevent crashes.
    """
    
    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(f"agent.middleware.{name}")
    
    def log_info(self, message: str):
        """Log an info message with the middleware name."""
        console.print(f"[blue]ℹ [{self.name}][/blue] {message}")
    
    def log_success(self, message: str):
        """Log a success message with the middleware name."""
        console.print(f"[green]✓ [{self.name}][/green] {message}")
    
    def log_warning(self, message: str):
        """Log a warning message with the middleware name."""
        console.print(f"[yellow]⚠ [{self.name}][/yellow] {message}")
    
    def log_error(self, message: str, error: Optional[Exception] = None):
        """Log an error message with the middleware name."""
        console.print(f"[red]✗ [{self.name}][/red] {message}")
        if error:
            self.logger.error(f"Error details: {error}", exc_info=True)
    
    async def before_agent(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run once before agent starts."""
        return None
    
    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run before each model call."""
        return None
    
    async def after_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run after each model call."""
        return None
    
    async def after_tools(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run after tool execution (if tools were called)."""
        return None
    
    async def after_agent(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Run once after agent completes."""
        return None
    
    async def __call__(self, state: AgentState) -> dict[str, Any]:
        """Default execution delegates to before_model with error handling."""
        try:
            result = await self.before_model(state)
            return result if result is not None else {}
        except Exception as e:
            log_middleware_error(self.name, e, context="Middleware execution")
            # Return empty dict to allow graph to continue
            return {"_middleware_error": {
                "middleware": self.name,
                "error": str(e),
                "error_type": type(e).__name__,
            }}