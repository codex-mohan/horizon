"""Horizon Backend API.

This module provides the FastAPI application for the Horizon agent backend.
It can run in two modes:
- LOCAL: Direct system access for personal assistant use
- DEPLOYED: Sandboxed execution for multi-user/managed service

The mode is determined by the HORIZON_EXECUTION_MODE environment variable.
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from agent.graph import build_graph, AgentState
from agent.config import AgentConfig


# =============================================================================
# Configuration
# =============================================================================

def get_cors_origins() -> list[str]:
    """Get CORS origins from environment or use defaults."""
    origins_str = os.environ.get("CORS_ORIGINS", "")
    if origins_str:
        return [origin.strip() for origin in origins_str.split(",")]
    
    # Default origins for development
    return [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "https://smith.langchain.com",
    ]


def get_execution_mode() -> str:
    """Get execution mode from environment."""
    return os.environ.get("HORIZON_EXECUTION_MODE", "local").lower()


def is_production() -> bool:
    """Check if running in production mode."""
    return os.environ.get("ENVIRONMENT", "development").lower() == "production"


# =============================================================================
# Application Lifespan
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    mode = get_execution_mode()
    env = os.environ.get("ENVIRONMENT", "development")
    print(f"🚀 Horizon Backend starting...")
    print(f"   Mode: {mode}")
    print(f"   Environment: {env}")
    print(f"   CORS Origins: {get_cors_origins()}")
    
    # Initialize the graph
    app.state.graph = build_graph()
    print("   ✅ Agent graph initialized")
    
    yield
    
    # Shutdown
    print("👋 Horizon Backend shutting down...")


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title="Horizon API",
    description="Agentic AI Assistant API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if not is_production() else None,
    redoc_url="/redoc" if not is_production() else None,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Exception Handlers
# =============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors."""
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if not is_production() else "An error occurred",
        },
    )


# =============================================================================
# Health & Status Endpoints
# =============================================================================

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/status")
async def status():
    """Detailed status endpoint."""
    return {
        "status": "healthy",
        "mode": get_execution_mode(),
        "environment": os.environ.get("ENVIRONMENT", "development"),
        "version": "0.1.0",
    }


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": "Horizon API",
        "version": "0.1.0",
        "docs": "/docs" if not is_production() else None,
        "health": "/health",
        "status": "/status",
    }


# =============================================================================
# Graph Instance (Lazy loaded in lifespan)
# =============================================================================

# The graph is initialized in the lifespan handler and stored in app.state
# This is used by LangGraph Server integration

graph = build_graph()

