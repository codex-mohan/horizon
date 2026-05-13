# Main Sandbox Worker Image
# Runs BullMQ worker + Docker-in-Docker for ephemeral code execution

FROM docker:24-dind

# Install Node.js 20, Python 3, Bash, and build tools for native deps
RUN apk add --no-cache \
    bash \
    curl \
    nodejs \
    npm \
    python3 \
    py3-pip \
    python3-dev \
    build-base \
    g++ \
    make \
    linux-headers \
    libstdc++

WORKDIR /app

# Install dependencies first for layer caching
COPY package.json ./
RUN npm install

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Pre-build runtime images so they are available inside DinD
# These will be built at startup or you can bake them in via multi-stage if needed.
# For simplicity, the worker builds/pulls them on first use or you can build them in CI.
COPY runtimes ./runtimes

ENV REDIS_URL=redis://redis:6379
ENV NODE_ENV=production

EXPOSE 2375

# Start dockerd in background, then run worker
# Note: In production orchestration (Docker Compose / K8s), dockerd is often started
# by the runtime or a sidecar. We use a small entrypoint script.
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/worker.js"]
