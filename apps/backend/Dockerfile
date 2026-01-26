# =============================================================================
# Horizon Backend Dockerfile
# =============================================================================
# Multi-stage build for development and production
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Base image with Python and dependencies
# -----------------------------------------------------------------------------
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd --gid 1000 horizon \
    && useradd --uid 1000 --gid horizon --shell /bin/bash --create-home horizon

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# -----------------------------------------------------------------------------
# Stage 2: Development image
# -----------------------------------------------------------------------------
FROM base as development

# Install all dependencies including dev
RUN uv pip install --system -e ".[dev]"

# Install LangGraph CLI for development server
RUN uv pip install --system "langgraph-cli[inmem]"

# Copy source code
COPY --chown=horizon:horizon . .

# Switch to non-root user
USER horizon

# Expose ports
# 2024: LangGraph Server
# 8000: FastAPI Server
EXPOSE 2024 8000

# Development command - runs LangGraph dev server
CMD ["langgraph", "dev", "--host", "0.0.0.0", "--port", "2024"]

# -----------------------------------------------------------------------------
# Stage 3: Production image
# -----------------------------------------------------------------------------
FROM base as production

# Install production dependencies only
RUN uv pip install --system -e .

# Copy source code
COPY --chown=horizon:horizon . .

# Switch to non-root user
USER horizon

# Expose ports
EXPOSE 2024 8000

# Production command - runs uvicorn with proper settings
CMD ["python", "-m", "uvicorn", "agent.app:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "4", \
    "--loop", "uvloop", \
    "--http", "httptools"]
