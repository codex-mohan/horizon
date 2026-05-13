#!/bin/bash
set -e

# Start dockerd in the background for Docker-in-Docker
# Wait until it is responsive, then execute the main command

if [ -z "$DOCKER_HOST" ]; then
    # Start dockerd with tcp so the worker can also talk to it if needed
    dockerd \
        --host=unix:///var/run/docker.sock \
        --host=tcp://0.0.0.0:2375 \
        --tls=false &

    # Wait for dockerd to be ready
    max_attempts=30
    attempt=0
    until docker info > /dev/null 2>&1; do
        attempt=$((attempt + 1))
        if [ "$attempt" -ge "$max_attempts" ]; then
            echo "Docker daemon failed to start"
            exit 1
        fi
        sleep 1
    done
fi

exec "$@"
