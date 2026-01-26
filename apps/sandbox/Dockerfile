# =============================================================================
# Horizon Sandbox Dockerfile
# =============================================================================
# Minimal, secure Python execution environment
# =============================================================================

FROM python:3.11-slim

# Security hardening
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_NO_CACHE_DIR=1 \
    HOME=/sandbox

# Install minimal system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create sandbox user with restricted permissions
RUN groupadd --gid 65534 sandbox \
    && useradd --uid 65534 --gid sandbox --shell /bin/false --home-dir /sandbox sandbox \
    && mkdir -p /sandbox /workspaces \
    && chown -R sandbox:sandbox /sandbox /workspaces

# Install common Python packages for code execution
RUN pip install --no-cache-dir \
    numpy \
    pandas \
    matplotlib \
    requests \
    httpx \
    pydantic \
    python-dateutil \
    PyYAML

# Copy executor script
COPY --chown=sandbox:sandbox executor.py /sandbox/executor.py
COPY --chown=sandbox:sandbox requirements.txt /sandbox/requirements.txt

WORKDIR /sandbox

# Switch to sandbox user
USER sandbox

# Default command - wait for execution requests
CMD ["python", "/sandbox/executor.py"]
