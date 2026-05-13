# Horizon Sandbox — Bash Runtime
# Minimal Alpine with bash, coreutils, and curl

FROM alpine:3.19

# Install essential shell utilities
RUN apk add --no-cache \
    bash \
    coreutils \
    curl \
    jq \
    sed \
    awk \
    grep \
    findutils \
    util-linux \
    bc \
    file \
    ca-certificates

# Create non-root user
RUN adduser -D -s /bin/bash runner

# Set working directory
WORKDIR /tmp

USER runner
