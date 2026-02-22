# Horizon Configuration Guide

This guide covers all aspects of configuring Horizon for development, production, and installed deployments.

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration Files](#configuration-files)
- [Configuration Options](#configuration-options)
- [Lookup Priority](#lookup-priority)
- [Environment Variables](#environment-variables)
- [Examples](#examples)
- [Development vs Production](#development-vs-production)

## Quick Start

Horizon uses a configuration file (`horizon.json`) to customize workspace settings and agent behavior.

1. **Development**: Config is auto-created from `config/horizon.example.json` on first run
2. **Edit config**: Modify `config/horizon.json` to customize your settings
3. **Your changes are local**: The config file is gitignored and won't be committed

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `config.schema.json` | `config/` | JSON Schema for validation |
| `horizon.example.json` | `config/` | Template/example configuration |
| `horizon.json` | `config/` | Your local configuration (gitignored) |

## Configuration Options

### workspace

Controls shell command execution environment.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultPath` | `string \| null` | `null` | Default working directory for shell commands. If `null`, uses `WORKSPACE_PATH` env var or current directory |
| `allowOverride` | `boolean` | `true` | Allow runtime override of workspace path via API |
| `restrictedPaths` | `string[]` | `[]` | Paths that are restricted from shell access |
| `allowedExtensions` | `string[]` | `[]` | File extensions allowed for operations (empty = all allowed) |

### agent

Controls agent behavior and retry logic.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `integer` | `3` | Maximum retry attempts for failed operations (0-10) |
| `timeout` | `integer` | `30000` | Default timeout for operations in milliseconds (1000-300000) |

## Lookup Priority

Horizon uses XDG-style configuration lookup with the following priority order:

1. **`HORIZON_CONFIG` environment variable** - Explicit path to config file
2. **Monorepo config** - `config/horizon.json` (for development)
3. **Current directory** - `./horizon.json`
4. **Parent directories** - Walking up from cwd, looks for `.horizon/config.json` or `horizon.json`
5. **User home directory**:
   - `~/.horizon/config.json`
   - `~/.config/horizon/config.json` (XDG style)
6. **System-wide**:
   - Unix: `/etc/horizon/config.json`
   - Windows: `%APPDATA%/horizon/config.json`
7. **Auto-create** - Copies `horizon.example.json` to appropriate location
8. **Default fallback** - Built-in default values

## Environment Variables

These environment variables can override file-based configuration:

| Variable | Description |
|----------|-------------|
| `HORIZON_CONFIG` | Explicit path to configuration file |
| `WORKSPACE_PATH` | Override workspace path (takes precedence over config file `defaultPath`) |

## Examples

### Restrict Shell Access to Project Directory

```json
{
    "workspace": {
        "defaultPath": "/home/user/my-project",
        "allowOverride": false,
        "restrictedPaths": ["/etc", "/root", "~/.ssh", "~/.gnupg"]
    }
}
```

### Allow Only Specific File Types

```json
{
    "workspace": {
        "allowedExtensions": [".js", ".ts", ".tsx", ".json", ".md", ".txt", ".yaml", ".yml"]
    }
}
```

### Increase Timeout for Slow Operations

```json
{
    "agent": {
        "maxRetries": 5,
        "timeout": 60000
    }
}
```

### Minimal Configuration

```json
{
    "workspace": {
        "defaultPath": null
    },
    "agent": {
        "maxRetries": 3,
        "timeout": 30000
    }
}
```

## Development vs Production

### Development Mode

When running `bun dev` or `turbo dev`:

- Config is loaded from `config/horizon.json` in the monorepo root
- If missing, it's auto-created from `config/horizon.example.json`
- Changes take effect on server restart

### Production/Installed Mode

When Horizon is installed as a package:

- Config follows XDG Base Directory specification
- User-level config: `~/.horizon/config.json` or `~/.config/horizon/config.json`
- System-wide config: `/etc/horizon/config.json` (Unix) or `%APPDATA%/horizon/config.json` (Windows)

### Docker Deployment

When running in Docker:

- Mount config at `/app/config/horizon.json`
- Or set `HORIZON_CONFIG=/path/to/config.json`
- Or use environment variables for overrides

```yaml
# docker-compose.yaml example
services:
  backend:
    volumes:
      - ./config/horizon.json:/app/config/horizon.json:ro
    environment:
      - WORKSPACE_PATH=/workspace
```

## Validation

Configuration is validated using JSON Schema. Invalid configurations will:

1. Log an error with specific validation issues
2. Fall back to default values

To validate your configuration manually:

```bash
# Using ajv-cli (install: npm install -g ajv-cli)
ajv validate -s config/config.schema.json -d config/horizon.json
```

## Troubleshooting

### Config Not Loading

1. Check file path and permissions
2. Validate JSON syntax: `cat config/horizon.json | jq .`
3. Check logs for `[Config]` messages
4. Verify with `HORIZON_CONFIG` env var

### Wrong Workspace Path

1. Check `WORKSPACE_PATH` environment variable
2. Check `workspace.defaultPath` in config
3. Verify path exists and is accessible

### Changes Not Taking Effect

1. Restart the backend server
2. Clear any cached configuration (internal)
3. Verify you're editing the correct file (check logs for loaded path)
