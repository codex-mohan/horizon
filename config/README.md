# Horizon Configuration

This directory contains configuration files for the Horizon AI assistant.

## Files

| File | Description |
|------|-------------|
| `config.schema.json` | JSON Schema for configuration validation |
| `horizon.example.json` | Example configuration template |
| `horizon.json` | Your local configuration (gitignored, auto-created) |

## Quick Start

1. Horizon will automatically create `horizon.json` from `horizon.example.json` on first run
2. Edit `horizon.json` to customize your workspace settings
3. Your changes are local and won't be committed to git

## Configuration Options

### workspace

Settings for shell command execution workspace.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultPath` | string \| null | null | Default working directory for shell commands. If null, uses `WORKSPACE_PATH` env var or current directory |
| `allowOverride` | boolean | true | Allow runtime override of workspace path via API |
| `restrictedPaths` | string[] | [] | Paths that are restricted from access |
| `allowedExtensions` | string[] | [] | File extensions allowed for operations (empty = all allowed) |

### agent

Settings for agent behavior.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | integer | 3 | Maximum retry attempts for failed operations (0-10) |
| `timeout` | integer | 30000 | Default timeout for operations in milliseconds (1000-300000) |

## Configuration Lookup Priority

Horizon uses XDG-style configuration lookup with the following priority:

1. **Environment variable**: `HORIZON_CONFIG` (explicit path)
2. **Monorepo config**: `config/horizon.json` (for development)
3. **Current directory**: `./horizon.json`
4. **Parent directories**: Walking up from cwd, looks for `.horizon/config.json` or `horizon.json`
5. **User home directory**:
   - `~/.horizon/config.json`
   - `~/.config/horizon/config.json` (XDG style)
6. **System-wide**:
   - Unix: `/etc/horizon/config.json`
   - Windows: `%APPDATA%/horizon/config.json`
7. **Auto-create**: If nothing found, copies `horizon.example.json` to appropriate location
8. **Fallback**: Default values

## Environment Variables

These environment variables override or supplement file-based configuration:

| Variable | Description |
|----------|-------------|
| `HORIZON_CONFIG` | Explicit path to config file |
| `WORKSPACE_PATH` | Override workspace path (takes precedence over config file) |

## Examples

### Restrict Shell Access to Specific Directory

```json
{
    "workspace": {
        "defaultPath": "/home/user/projects",
        "allowOverride": false,
        "restrictedPaths": ["/etc", "/root", "~/.ssh"]
    }
}
```

### Allow Only Specific File Types

```json
{
    "workspace": {
        "allowedExtensions": [".js", ".ts", ".json", ".md", ".txt"]
    }
}
```

### Adjust Agent Timeout

```json
{
    "agent": {
        "maxRetries": 5,
        "timeout": 60000
    }
}
```

## Development vs Production

- **Development**: Uses `config/horizon.json` in monorepo root
- **Production/Installed**: Uses user-level config (`~/.horizon/config.json`) or system-wide config
