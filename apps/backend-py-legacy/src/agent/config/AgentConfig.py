"""Configuration management for the agent system.

Model configuration is managed in agent.config.model_settings.
This module handles agent-specific configuration (middleware, limits, etc.).

Usage:
    from agent.config.AgentConfig import AgentConfig, load_agent_config

    # Use defaults
    config = AgentConfig()

    # Load from file
    config = load_agent_config("path/to/agent_config.yaml")
    config = load_agent_config("path/to/agent_config.toml")

    # Load with model config
    from agent.config.model_config import load_model_config
    model_config = load_model_config("model_config.yaml")
    config = load_agent_config("agent_config.yaml", model_config=model_config)
"""

from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any, Optional, Union

from .config_loader import (
    ConfigLoadError,
    apply_env_overrides,
    convert_config_types,
    load_config_file,
    merge_configs,
)
from .model_config import LLMProvider, ModelConfig, ModelDefaults


@dataclass
class AgentConfig:
    """Agent-specific configuration (not LLM model settings).

    LLM model settings (provider, model_name, temperature, etc.) are managed
    in agent.config.model_settings. This class handles middleware toggles,
    limits, retry settings, and prompt configuration.

    For backward compatibility, LLM settings are also available as properties
    that delegate to model_config.
    """

    # Reference to model configuration (loaded from model_settings.py)
    model_config: Optional[ModelConfig] = None

    # -------------------------------------------------------------------------
    # LLM Configuration Properties (for backward compatibility)
    # -------------------------------------------------------------------------
    # These delegate to model_config if available, otherwise use defaults

    @property
    def provider(self) -> LLMProvider:
        """Get the LLM provider from model config or default."""
        if self.model_config is not None:
            return self.model_config.provider
        return LLMProvider.GROQ

    @property
    def model_name(self) -> str:
        """Get the model name from model config or default."""
        if self.model_config is not None:
            return self.model_config.model_name
        return "meta-llama/llama-4-scout-17b-16e-instruct"

    @property
    def temperature(self) -> float:
        """Get the temperature from model config or default."""
        if self.model_config is not None:
            return self.model_config.temperature
        return 0.7

    @property
    def max_tokens(self) -> int:
        """Get the max tokens from model config or default."""
        if self.model_config is not None:
            return self.model_config.max_tokens
        return 4096

    @property
    def api_key(self) -> Optional[str]:
        """Get the API key (not stored, always None for config)."""
        return None

    @property
    def base_url(self) -> Optional[str]:
        """Get the base URL from model config or default."""
        if self.model_config is not None:
            return self.model_config.base_url
        return None

    # -------------------------------------------------------------------------
    # Agent Configuration
    # -------------------------------------------------------------------------

    # Middleware toggles
    enable_summarization: bool = True
    enable_memory_loader: bool = True
    enable_pii_detection: bool = True
    enable_rate_limiting: bool = True
    enable_token_tracking: bool = True
    enable_model_fallback: bool = True
    enable_tool_retry: bool = True
    enable_todo_list: bool = True
    enable_todo_planner: bool = True

    # Limits
    max_model_calls: int = 10
    max_tool_calls: int = 20
    summarization_threshold: int = 135000
    rate_limit_window: int = 60

    # Retry settings
    max_retries: int = 3
    backoff_factor: float = 2.0
    initial_delay: float = 1.0

    # Prompt template sections
    character: str = "You are a helpful AI assistant."
    core_behavior: str = "Be helpful, harmless, and honest."
    instructions: str = "Follow user instructions carefully."
    interaction_guidelines: str = "Be conversational and clear."
    knowledge_capabilities: str = "Use available tools when needed."
    reasoning_approach: str = "Think step by step."
    response_format: str = "Respond in a clear format."
    formatting_standards: str = "Use markdown when appropriate."
    security_requirements: str = "Never share sensitive information."

    # -------------------------------------------------------------------------
    # Serialization Methods
    # -------------------------------------------------------------------------

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            # Model config
            "model_config": self.model_config.to_dict() if self.model_config else None,
            # Middleware toggles
            "enable_summarization": self.enable_summarization,
            "enable_memory_loader": self.enable_memory_loader,
            "enable_pii_detection": self.enable_pii_detection,
            "enable_rate_limiting": self.enable_rate_limiting,
            "enable_token_tracking": self.enable_token_tracking,
            "enable_model_fallback": self.enable_model_fallback,
            "enable_tool_retry": self.enable_tool_retry,
            "enable_todo_list": self.enable_todo_list,
            "enable_todo_planner": self.enable_todo_planner,
            # Limits
            "max_model_calls": self.max_model_calls,
            "max_tool_calls": self.max_tool_calls,
            "summarization_threshold": self.summarization_threshold,
            "rate_limit_window": self.rate_limit_window,
            # Retry settings
            "max_retries": self.max_retries,
            "backoff_factor": self.backoff_factor,
            "initial_delay": self.initial_delay,
            # Prompt templates
            "character": self.character,
            "core_behavior": self.core_behavior,
            "instructions": self.instructions,
            "interaction_guidelines": self.interaction_guidelines,
            "knowledge_capabilities": self.knowledge_capabilities,
            "reasoning_approach": self.reasoning_approach,
            "response_format": self.response_format,
            "formatting_standards": self.formatting_standards,
            "security_requirements": self.security_requirements,
        }

    def to_yaml(self) -> str:
        """Convert to YAML string."""
        import yaml

        return yaml.dump(self.to_dict(), default_flow_style=False)

    def to_toml(self) -> str:
        """Convert to TOML string."""
        lines = []
        d = self.to_dict()

        # Model section
        if d.get("model_config"):
            lines.append("[model]")
            for key, value in d["model_config"].items():
                if value is None:
                    continue
                if isinstance(value, str):
                    lines.append(f'{key} = "{value}"')
                elif isinstance(value, Enum):
                    lines.append(f'{key} = "{value.value}"')
                else:
                    lines.append(f"{key} = {value}")
            lines.append("")

        # Middleware section
        lines.append("[middleware]")
        for key in [
            "enable_summarization",
            "enable_memory_loader",
            "enable_pii_detection",
            "enable_rate_limiting",
            "enable_token_tracking",
            "enable_model_fallback",
            "enable_tool_retry",
            "enable_todo_list",
            "enable_todo_planner",
        ]:
            lines.append(f"{key} = {d[key]}")
        lines.append("")

        # Limits section
        lines.append("[limits]")
        for key in [
            "max_model_calls",
            "max_tool_calls",
            "summarization_threshold",
            "rate_limit_window",
        ]:
            lines.append(f"{key} = {d[key]}")
        lines.append("")

        # Retry section
        lines.append("[retry]")
        for key in ["max_retries", "backoff_factor", "initial_delay"]:
            lines.append(f"{key} = {d[key]}")
        lines.append("")

        # Prompts section
        lines.append("[prompts]")
        for key in [
            "character",
            "core_behavior",
            "instructions",
            "interaction_guidelines",
            "knowledge_capabilities",
            "reasoning_approach",
            "response_format",
            "formatting_standards",
            "security_requirements",
        ]:
            value = d[key]
            # Escape newlines for TOML
            if "\n" in value:
                value = value.replace("\n", "\\n")
            lines.append(f'{key} = """{value}"""')
        lines.append("")

        return "\n".join(lines)

    # -------------------------------------------------------------------------
    # Class Methods
    # -------------------------------------------------------------------------

    @classmethod
    def development(cls) -> "AgentConfig":
        """Create a development configuration."""
        return cls(
            max_model_calls=50,
            enable_rate_limiting=False,
            enable_pii_detection=False,
        )

    @classmethod
    def production(cls) -> "AgentConfig":
        """Create a production configuration."""
        return cls(
            max_model_calls=10,
            enable_rate_limiting=True,
            enable_pii_detection=True,
        )

    @classmethod
    def from_model_settings(cls) -> "AgentConfig":
        """Create agent config with model settings loaded from model_settings.py.

        This uses the ModelDefaults factory from model_settings.py to create
        the model configuration based on environment variables or defaults.
        """
        model_defaults = ModelDefaults()
        model_config = model_defaults.create()

        return cls(model_config=model_config)

    # Backward compatibility alias
    from_env = from_model_settings

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "AgentConfig":
        """Create an AgentConfig from a dictionary.

        Args:
            data: Dictionary with configuration values.

        Returns:
            AgentConfig instance.
        """
        # Define type hints for agent config fields
        type_hints = {
            # Model config
            "model_config": dict,
            # Middleware toggles
            "enable_summarization": bool,
            "enable_memory_loader": bool,
            "enable_pii_detection": bool,
            "enable_rate_limiting": bool,
            "enable_token_tracking": bool,
            "enable_model_fallback": bool,
            "enable_tool_retry": bool,
            "enable_todo_list": bool,
            "enable_todo_planner": bool,
            # Limits
            "max_model_calls": int,
            "max_tool_calls": int,
            "summarization_threshold": int,
            "rate_limit_window": int,
            # Retry settings
            "max_retries": int,
            "backoff_factor": float,
            "initial_delay": float,
            # Prompts
            "character": str,
            "core_behavior": str,
            "instructions": str,
            "interaction_guidelines": str,
            "knowledge_capabilities": str,
            "reasoning_approach": str,
            "response_format": str,
            "formatting_standards": str,
            "security_requirements": str,
        }

        converted = convert_config_types(data, type_hints)

        # Handle model_config nested dict
        model_cfg = None
        if "model_config" in converted and converted["model_config"]:
            if isinstance(converted["model_config"], dict):
                model_cfg = ModelConfig.from_dict(converted["model_config"])
            else:
                model_cfg = converted["model_config"]

        # Create instance with extracted fields
        model_fields = {"model_config": model_cfg}
        agent_fields = {
            k: v
            for k, v in converted.items()
            if k not in type_hints or k == "model_config"
        }

        return cls(**agent_fields)


# =============================================================================
# File Loading Functions
# =============================================================================


def _get_agent_type_hints() -> dict[str, type]:
    """Get type hints for AgentConfig fields."""
    return {
        # Model config
        "model_config": dict,
        # Middleware toggles
        "enable_summarization": bool,
        "enable_memory_loader": bool,
        "enable_pii_detection": bool,
        "enable_rate_limiting": bool,
        "enable_token_tracking": bool,
        "enable_model_fallback": bool,
        "enable_tool_retry": bool,
        "enable_todo_list": bool,
        "enable_todo_planner": bool,
        # Limits
        "max_model_calls": int,
        "max_tool_calls": int,
        "summarization_threshold": int,
        "rate_limit_window": int,
        # Retry settings
        "max_retries": int,
        "backoff_factor": float,
        "initial_delay": float,
        # Prompts
        "character": str,
        "core_behavior": str,
        "instructions": str,
        "interaction_guidelines": str,
        "knowledge_capabilities": str,
        "reasoning_approach": str,
        "response_format": str,
        "formatting_standards": str,
        "security_requirements": str,
    }


def _parse_agent_config(data: dict[str, Any]) -> dict[str, Any]:
    """Parse agent configuration from loaded data.

    Handles both flat and nested (by section) formats.
    """
    result = {}

    # Sections to handle (these are AgentConfig fields)
    sections = ["middleware", "limits", "retry", "prompts"]

    # Keys to exclude from agent config (these belong to other configs)
    exclude_keys = ["model", "model_config"]

    # Model fields that should be extracted in flat format
    model_fields = ["provider", "model_name", "temperature", "max_tokens", "base_url"]

    has_sections = any(s in data for s in sections)

    if has_sections:
        # Nested format: middleware: {...}, limits: {...}, etc.
        for section in sections:
            if section in data and isinstance(data[section], dict):
                result.update(data[section])
        # Also copy top-level fields (excluding model-related keys)
        for key in data:
            if key not in sections and key not in exclude_keys:
                result[key] = data[key]
    else:
        # Flat format: all fields at top level
        # Extract model fields to be handled separately
        for key in data:
            if key not in model_fields:
                result[key] = data[key]

    return result


def load_agent_config(
    file_path: Union[str, Path],
    model_config: Optional[ModelConfig] = None,
    overrides: Optional[dict[str, Any]] = None,
    apply_env: bool = True,
) -> AgentConfig:
    """Load AgentConfig from a YAML or TOML file.

    Args:
        file_path: Path to the configuration file.
        model_config: Optional ModelConfig to associate with the agent config.
        overrides: Optional dictionary of overrides to apply after loading.
        apply_env: Whether to apply environment variable overrides.

    Returns:
        AgentConfig instance.

    Raises:
        ConfigLoadError: If the file cannot be loaded or parsed.

    Example:
        # Load from YAML
        config = load_agent_config("config/agent_config.yaml")

        # Load from TOML
        config = load_agent_config("config/agent_config.toml")

        # Load with model config
        from agent.config.model_config import load_model_config
        model_cfg = load_model_config("model_config.yaml")
        config = load_agent_config("agent_config.yaml", model_config=model_cfg)
    """
    # Load raw config
    raw_config = load_config_file(file_path)

    # Parse config (handle nested sections)
    parsed_config = _parse_agent_config(raw_config)

    # Apply environment overrides
    if apply_env:
        parsed_config = apply_env_overrides(parsed_config, prefix="AGENT_")

    # Apply explicit overrides
    if overrides:
        parsed_config = merge_configs(parsed_config, overrides)

    # Convert types
    type_hints = _get_agent_type_hints()
    converted = convert_config_types(parsed_config, type_hints)

    # Handle model_config nested dict (check both "model" and "model_config" keys)
    model_cfg = model_config
    if model_cfg is None:
        # Try "model" key first (from YAML/TOML files)
        if "model" in raw_config and isinstance(raw_config["model"], dict):
            model_cfg = ModelConfig.from_dict(raw_config["model"])
        # Try model fields from flat config format
        elif any(k in raw_config for k in ["provider", "model_name"]):
            model_fields = {}
            for key in [
                "provider",
                "model_name",
                "temperature",
                "max_tokens",
                "base_url",
            ]:
                if key in raw_config:
                    model_fields[key] = raw_config[key]
            if model_fields:
                model_cfg = ModelConfig.from_dict(model_fields)
        # Fall back to "model_config" key
        elif "model_config" in converted and converted["model_config"]:
            if isinstance(converted["model_config"], dict):
                model_cfg = ModelConfig.from_dict(converted["model_config"])

    # Remove model_config from converted dict (it's handled separately)
    converted.pop("model_config", None)

    return AgentConfig(model_config=model_cfg, **converted)


def load_agent_config_with_model(
    agent_file_path: Union[str, Path],
    model_file_path: Union[str, Path],
    apply_env: bool = True,
) -> AgentConfig:
    """Load AgentConfig from separate agent and model config files.

    Args:
        agent_file_path: Path to the agent configuration file.
        model_file_path: Path to the model configuration file.
        apply_env: Whether to apply environment variable overrides.

    Returns:
        AgentConfig instance with model_config loaded.
    """
    from .model_config import load_model_config

    model_cfg = load_model_config(model_file_path, apply_env=apply_env)
    return load_agent_config(
        agent_file_path, model_config=model_cfg, apply_env=apply_env
    )
