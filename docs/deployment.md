# Horizon Deployment Guide

This guide covers deploying Horizon in various environments: development, Docker, and production installations.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Development Deployment](#development-deployment)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [Configuration Management](#configuration-management)
- [Security Considerations](#security-considerations)
- [Monitoring and Logging](#monitoring-and-logging)

## Architecture Overview

Horizon consists of three main components:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js Web   │────▶│  LangGraph Agent │────▶│     Qdrant      │
│   (Frontend)    │◄────│    (Backend)     │◄────│  (Vector DB)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  External APIs   │
                        │  (LLM Providers) │
                        └──────────────────┘
```

| Component | Port | Purpose |
|-----------|------|---------|
| Web (Next.js) | 3000 | Chat interface, user management |
| Backend (LangGraph) | 2024 | Agent inference, tool execution |
| Qdrant | 6333 | Vector storage for memory |
| Redis | 6379 | Session cache (optional) |

## Development Deployment

### Prerequisites

- **Bun** >= 1.3.6
- **Node.js** >= 20
- **Docker** (for Qdrant)

### Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/horizon.git
cd horizon
bun install

# 2. Start Qdrant (required for memory)
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# 3. Configure environment
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env with your API keys

# 4. Start development servers
bun dev
```

This starts both frontend (port 3000) and backend (port 2024).

### Development Configuration

Configuration is auto-created from `config/horizon.example.json`. See [Configuration Guide](./configuration.md).

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Development stack
docker compose up

# Production stack
docker compose -f docker-compose.prod.yaml up -d
```

### Services

| Service | Image | Description |
|---------|-------|-------------|
| `web` | Next.js | Frontend application |
| `backend` | Bun + Hono | LangGraph agent server |
| `qdrant` | qdrant/qdrant | Vector database |
| `redis` | redis:alpine | Session store |
| `sandbox` | Custom | Isolated code execution |
| `nginx` | nginx:alpine | Reverse proxy (production) |

### Docker Volumes

```yaml
volumes:
  qdrant_data:        # Vector database persistence
  redis_data:         # Session persistence
  checkpoints:        # LangGraph checkpoints
  assistant_data:     # User assistants
```

### Environment Configuration

```bash
# Create .env file for Docker
cat > .env << EOF
MODEL_PROVIDER=groq
MODEL_NAME=meta-llama/llama-4-scout-17b-16e-instruct
GROQ_API_KEY=your-key-here
JWT_SECRET=your-jwt-secret
EOF
```

### Health Checks

```bash
# Check all services
docker compose ps

# Check backend health
curl http://localhost:2024/health

# Check Qdrant health
curl http://localhost:6333/healthz
```

## Production Deployment

### Option 1: Vercel + Self-Hosted Backend

Frontend on Vercel, backend on your infrastructure:

1. **Deploy Backend**:
   ```bash
   cd apps/backend
   bun build --compile --outfile horizon-backend
   ./horizon-backend
   ```

2. **Deploy Frontend to Vercel**:
   ```bash
   cd apps/web
   vercel --prod
   ```

3. **Set environment variables in Vercel**:
   - `NEXT_PUBLIC_LANGGRAPH_API_URL=https://your-backend.com`

### Option 2: Full Self-Hosted

Use the production Docker Compose:

```bash
docker compose -f docker-compose.prod.yaml up -d
```

This includes:
- Nginx reverse proxy with SSL
- Isolated sandbox for code execution
- Redis for session management

### Option 3: Kubernetes

Kubernetes manifests are planned. For now, use Docker Compose with a tool like Kompose:

```bash
kompose convert -f docker-compose.prod.yaml
kubectl apply -f .
```

### SSL/TLS Configuration

Production Docker includes Nginx with SSL. Configure in `nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
}
```

## Configuration Management

### Environment Variables

Production requires these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `MODEL_PROVIDER` | Yes | LLM provider (openai, anthropic, google, groq, ollama) |
| `MODEL_NAME` | Yes | Model identifier |
| `[PROVIDER]_API_KEY` | Yes* | API key for chosen provider |
| `JWT_SECRET` | Yes | Secret for JWT signing |
| `QDRANT_URL` | No | Qdrant endpoint (default: localhost:6333) |

### Config File Locations

| Environment | Config Location |
|-------------|-----------------|
| Development | `config/horizon.json` |
| Docker | `/app/config/horizon.json` |
| Installed (Unix) | `~/.horizon/config.json` or `/etc/horizon/config.json` |
| Installed (Windows) | `%APPDATA%/horizon/config.json` |

## Security Considerations

### API Keys

- Never commit API keys to git
- Use environment variables or secret management
- Rotate keys regularly

### Shell Execution

The shell tool has multiple safety layers:

- **Dangerous patterns**: Blocked by default (rm -rf, sudo, etc.)
- **Approval modes**: `always`, `never`, `dangerous`, `custom`
- **Restricted paths**: Configure in `workspace.restrictedPaths`
- **Timeouts**: Default 30 seconds

### Authentication

- JWT-based sessions with configurable expiry
- Password hashing with bcrypt
- CORS configured for your domain

### Network Security

```yaml
# docker-compose.prod.yaml
services:
  backend:
    environment:
      - ENABLE_RATE_LIMITING=true
      - RATE_LIMIT_WINDOW=60
      - RATE_LIMIT_MAX_REQUESTS=100
```

## Monitoring and Logging

### Application Logs

```bash
# Docker logs
docker compose logs -f backend

# Structured logs (planned)
# Logs are prefixed with [Config], [Agent], [Tool], etc.
```

### Health Endpoints

```bash
# Backend health
curl http://localhost:2024/health

# Response:
{
  "status": "healthy",
  "service": "backend-ts"
}
```

### Metrics (Planned)

Prometheus metrics endpoint planned for future release.

## Troubleshooting

### Common Issues

**Backend won't start**:
- Check Qdrant is running
- Verify API keys are set
- Check port 2024 is available

**Frontend can't connect to backend**:
- Verify `NEXT_PUBLIC_LANGGRAPH_API_URL`
- Check CORS settings
- Verify backend is healthy

**Memory not working**:
- Ensure Qdrant is running
- Check `QDRANT_URL` environment variable
- Verify `ENABLE_MEMORY=true`

### Debug Mode

```bash
# Enable debug logging
DEBUG=langgraph:* bun dev
```
