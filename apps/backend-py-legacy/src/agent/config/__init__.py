"""Configuration package for the Horizon Agent.

This package provides configuration management for the agent system, with support
for loading configuration from YAML and TOML files.

Modules:
    - config_loader: Core file loading utilities (YAML/TOML)
    - model_config: LLM model configuration
    - AgentConfig: Agent-specific configuration (middleware, limits, prompts)

Usage:
    # Import individual classes
    from agent.config import AgentConfig, ModelConfig, LLMProvider

    # Load from files
    from agent.config import load_agent_config, load_model_config

    # Example: Load agent config from YAML
    config = load_agent_config("config/agent_config.yaml")

    # Example: Load model config from TOML
    model_config = load_model_config("config/model_config.toml")

    # Example: Load both from separate files
    from agent.config import load_agent_config_with_model
    config = load_agent_config_with_model(
        "agent_config.yaml",
        "model_config.toml"
    )
"""

from .AgentConfig import AgentConfig, load_agent_config, load_agent_config_with_model
from .config_loader import (
    ConfigLoadError,
    apply_env_overrides,
    convert_config_types,
    load_config_file,
    load_toml,
    load_yaml,
    merge_configs,
)
from .model_config import (
    LLMProvider,
    ModelConfig,
    ModelDefaults,
    MODEL_DEFAULTS,
    load_model_config,
    load_model_config_with_defaults,
)

__all__ = [
    # Core loading utilities
    "ConfigLoadError",
    "load_config_file",
    "load_yaml",
    "load_toml",
    "merge_configs",
    "convert_config_types",
    "apply_env_overrides",
    # Agent config
    "AgentConfig",
    "load_agent_config",
    "load_agent_config_with_model",
    # Model config
    "LLMProvider",
    "ModelConfig",
    "ModelDefaults",
    "MODEL_DEFAULTS",
    "load_model_config",
    "load_model_config_with_defaults",
]
