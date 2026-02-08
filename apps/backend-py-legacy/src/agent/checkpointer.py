"""
Checkpointer factory for LangGraph persistence.

Supports multiple backends:
- memory: In-memory storage (default, for development)
- postgres: PostgreSQL storage (for production)

Configure via environment variables:
- CHECKPOINTER_BACKEND: "memory" or "postgres"
- POSTGRES_CONNECTION_STRING: PostgreSQL connection string (required for postgres backend)
"""

import os
from typing import Optional
from langgraph.checkpoint.memory import MemorySaver

# Type alias for checkpointer
CheckpointerType = MemorySaver  # Base type, will be extended when postgres is used


def create_checkpointer(backend: Optional[str] = None) -> CheckpointerType:
    """
    Create a checkpointer based on configuration.
    
    Args:
        backend: Override for CHECKPOINTER_BACKEND env var. 
                 Options: "memory", "postgres"
    
    Returns:
        Configured checkpointer instance.
    """
    backend = backend or os.getenv("CHECKPOINTER_BACKEND", "memory")
    
    if backend == "postgres":
        return _create_postgres_checkpointer()
    
    # Default to in-memory
    return MemorySaver()


def _create_postgres_checkpointer():
    """Create PostgreSQL checkpointer."""
    try:
        from langgraph.checkpoint.postgres import PostgresSaver
    except ImportError:
        raise ImportError(
            "PostgreSQL checkpointer requires 'langgraph-checkpoint-postgres' package. "
            "Install with: pip install langgraph-checkpoint-postgres psycopg[binary,pool]"
        )
    
    conn_string = os.getenv("POSTGRES_CONNECTION_STRING")
    if not conn_string:
        raise ValueError(
            "POSTGRES_CONNECTION_STRING environment variable is required "
            "when using postgres checkpointer backend."
        )
    
    return PostgresSaver.from_conn_string(conn_string)


# Lazy singleton instance
_checkpointer_instance: Optional[CheckpointerType] = None


def get_checkpointer() -> CheckpointerType:
    """Get or create the singleton checkpointer instance."""
    global _checkpointer_instance
    if _checkpointer_instance is None:
        _checkpointer_instance = create_checkpointer()
    return _checkpointer_instance
