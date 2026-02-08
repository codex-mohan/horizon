"""Configuration loader for YAML and TOML files.

Supports loading configuration from YAML (.yaml/.yml) and TOML (.toml) files.
Automatically handles type conversions and provides a unified interface.

Usage:
    from agent.config.config_loader import load_config, load_model_config

    # Load agent config
    agent_config = load_config("path/to/config.yaml")

    # Load model config
    model_config = load_model_config("path/to/model_config.toml")
"""

import os
import sys
from pathlib import Path
from typing import Any, Optional, Union

# Try to import TOML library (tomllib for Python 3.11+, tomli for older versions)
if sys.version_info >= (3, 11):
    import tomllib
else:
    try:
        import tomli as tomllib
    except ImportError:
        tomllib = None

import yaml


class ConfigLoadError(Exception):
    """Raised when configuration loading fails."""
    pass


def _get_toml_loader() -> Any:
    """Get the appropriate TOML loader."""
    if tomllib is None:
        raise ConfigLoadError(
            "TOML support requires 'tomli' package for Python < 3.11. "
            "Install it with: pip install tomli"
        )
    return tomllib


def load_yaml(file_path: Union[str, Path]) -> dict[str, Any]:
    """Load configuration from a YAML file.

    Args:
        file_path: Path to the YAML file.

    Returns:
        Parsed configuration dictionary.

    Raises:
        ConfigLoadError: If file cannot be loaded or parsed.
    """
    path = Path(file_path)
    if not path.exists():
        raise ConfigLoadError(f"YAML file not found: {path}")

    try:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        raise ConfigLoadError(f"Failed to parse YAML file {path}: {e}")
    except OSError as e:
        raise ConfigLoadError(f"Failed to read YAML file {path}: {e}")


def load_toml(file_path: Union[str, Path]) -> dict[str, Any]:
    """Load configuration from a TOML file.

    Args:
        file_path: Path to the TOML file.

    Returns:
        Parsed configuration dictionary.

    Raises:
        ConfigLoadError: If file cannot be loaded or parsed.
    """
    path = Path(file_path)
    if not path.exists():
        raise ConfigLoadError(f"TOML file not found: {path}")

    try:
        with open(path, "rb") as f:
            return _get_toml_loader().load(f)
    except OSError as e:
        raise ConfigLoadError(f"Failed to read TOML file {path}: {e}")


def load_config_file(
    file_path: Union[str, Path],
    file_type: Optional[str] = None,
) -> dict[str, Any]:
    """Load configuration from a YAML or TOML file.

    Args:
        file_path: Path to the configuration file.
        file_type: Explicit file type ('yaml' or 'toml'). If not provided,
                   will be inferred from the file extension.

    Returns:
        Parsed configuration dictionary.

    Raises:
        ConfigLoadError: If file cannot be loaded or parsed.
    """
    path = Path(file_path)

    # Determine file type
    if file_type:
        file_type = file_type.lower()
    else:
        suffix = path.suffix.lower()
        if suffix in (".yaml", ".yml"):
            file_type = "yaml"
        elif suffix == ".toml":
            file_type = "toml"
        else:
            raise ConfigLoadError(
                f"Cannot determine file type from extension '{suffix}'. "
                "Please specify file_type='yaml' or file_type='toml'"
            )

    # Load based on file type
    if file_type == "yaml":
        return load_yaml(path)
    elif file_type == "toml":
        return load_toml(path)
    else:
        raise ConfigLoadError(f"Unsupported file type: {file_type}")


def find_config_file(
    config_dir: Union[str, Path],
    file_name: str,
) -> Optional[Path]:
    """Find a configuration file in the specified directory.

    Searches for the file with various extensions (.yaml, .yml, .toml).

    Args:
        config_dir: Directory to search in.
        file_name: Base file name (without extension).

    Returns:
        Path to the found file, or None if not found.
    """
    config_dir = Path(config_dir)

    # Try each extension
    for ext in [".yaml", ".yml", ".toml"]:
        candidate = config_dir / f"{file_name}{ext}"
        if candidate.exists():
            return candidate

    return None


def merge_configs(
    base: dict[str, Any],
    override: dict[str, Any],
    deep: bool = True,
) -> dict[str, Any]:
    """Merge two configuration dictionaries.

    Args:
        base: Base configuration.
        override: Override values (takes precedence).
        deep: Whether to perform deep merging for nested dicts.

    Returns:
        Merged configuration dictionary.
    """
    if not deep:
        return {**base, **override}

    result = base.copy()
    for key, value in override.items():
        if (
            key in result
            and isinstance(result[key], dict)
            and isinstance(value, dict)
        ):
            result[key] = merge_configs(result[key], value, deep=True)
        else:
            result[key] = value

    return result


# =============================================================================
# Type Conversion Utilities
# =============================================================================

def _convert_value(value: Any, target_type: type) -> Any:
    """Convert a value to the target type.

    Args:
        value: Value to convert.
        target_type: Target type.

    Returns:
        Converted value.

    Raises:
        ConfigLoadError: If conversion fails.
    """
    if value is None:
        return None

    if target_type is bool:
        if isinstance(value, str):
            return value.lower() in ("true", "1", "yes")
        return bool(value)

    if target_type is int:
        return int(value)

    if target_type is float:
        return float(value)

    if target_type is str:
        return str(value)

    if target_type is list:
        if isinstance(value, list):
            return value
        return [value]

    return value


def convert_config_types(
    config: dict[str, Any],
    type_hints: dict[str, type],
) -> dict[str, Any]:
    """Convert configuration values to their target types based on type hints.

    Args:
        config: Configuration dictionary.
        type_hints: Mapping of field names to target types.

    Returns:
        Configuration with converted values.
    """
    result = {}
    for key, value in config.items():
        if key in type_hints:
            target_type = type_hints[key]
            try:
                result[key] = _convert_value(value, target_type)
            except (TypeError, ValueError) as e:
                raise ConfigLoadError(
                    f"Failed to convert '{key}' to {target_type.__name__}: {e}"
                )
        else:
            result[key] = value

    return result


# =============================================================================
# Environment Variable Support
# =============================================================================

def apply_env_overrides(
    config: dict[str, Any],
    prefix: str = "AGENT_",
) -> dict[str, Any]:
    """Apply environment variable overrides to configuration.

    Environment variables are prefixed and use double underscores for nesting.
    For example, AGENT__ENABLE_SUMMARIZATION=true maps to config['enable_summarization'].

    Args:
        config: Base configuration dictionary.
        prefix: Environment variable prefix.

    Returns:
        Configuration with environment overrides applied.
    """
    import os

    result = config.copy()
    prefix_len = len(prefix)

    for key, value in os.environ.items():
        if not key.startswith(prefix):
            continue

        # Parse the key (double underscore = nested)
        config_key = key[prefix_len:].lower().replace("__", ".")

        # Navigate to the nested dict
        keys = config_key.split(".")
        current = result

        for i, k in enumerate(keys[:-1]):
            if k not in current:
                current[k] = {}
            if not isinstance(current[k], dict):
                # Can't nest into a non-dict, skip
                break
            current = current[k]
        else:
            # Set the value
            final_key = keys[-1]
            # Try to preserve type (int, bool, float, str)
            if value.lower() in ("true", "false"):
                value = value.lower() == "true"
            elif value.isdigit():
                value = int(value)
            else:
                try:
                    value = float(value)
                except ValueError:
                    pass  # Keep as string
            current[final_key] = value

    return result
