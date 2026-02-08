# ============================================================================
# model_config.py
# ============================================================================
"""Model configuration settings for the Horizon Agent.

This file contains all LLM model settings (provider, model name, temperature, etc.).
API keys should NOT be in this file - they belong in .env or environment variables.

Usage:
    from agent.config.model_config import ModelConfig, MODEL_DEFAULTS, load_model_config

    # Use defaults
    config = MODEL_DEFAULTS.create()

    # Or customize
    config = MODEL_DEFAULTS.create(provider="groq", model_name="llama-3.3-70b-versatile")

    # Load from file
    config = load_model_config("path/to/model_config.yaml")
    config = load_model_config("path/to/model_config.toml")
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


class LLMProvider(str, Enum):
    """Supported LLM providers."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OLLAMA = "ollama"
    GROQ = "groq"
    OPENAI_COMPATIBLE = "openai-compatible"


@dataclass
class ModelConfig:
    """Configuration for an LLM model."""

    provider: LLMProvider = LLMProvider.GROQ
    model_name: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    temperature: float = 0.7
    max_tokens: int = 4096
    base_url: Optional[str] = None  # For Ollama and OpenAI-compatible APIs

    def to_llm_config_dict(self) -> dict:
        """Convert to dictionary for LLM initialization."""
        return {
            "provider": self.provider.value,
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "base_url": self.base_url,
        }

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "provider": self.provider.value
            if isinstance(self.provider, LLMProvider)
            else self.provider,
            "model_name": self.model_name,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "base_url": self.base_url,
        }

    def to_yaml(self) -> str:
        """Convert to YAML string."""
        import yaml

        return yaml.dump(self.to_dict(), default_flow_style=False)

    def to_toml(self) -> str:
        """Convert to TOML string."""
        # Convert to TOML-compatible format
        lines = ["[model]"]
        for key, value in self.to_dict().items():
            if value is None:
                continue
            if isinstance(value, str):
                lines.append(f'{key} = "{value}"')
            elif isinstance(value, Enum):
                lines.append(f'{key} = "{value.value}"')
            else:
                lines.append(f"{key} = {value}")
        return "\n".join(lines) + "\n"

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "ModelConfig":
        """Create a ModelConfig from a dictionary.

        Args:
            data: Dictionary with configuration values.

        Returns:
            ModelConfig instance.
        """
        type_hints = {
            "provider": LLMProvider,
            "model_name": str,
            "temperature": float,
            "max_tokens": int,
            "base_url": (str, type(None)),
        }
        converted = convert_config_types(data, type_hints)

        # Handle provider as string or enum
        provider = converted.get("provider", LLMProvider.ANTHROPIC)
        if isinstance(provider, str):
            provider_map = {
                "openai": LLMProvider.OPENAI,
                "anthropic": LLMProvider.ANTHROPIC,
                "google": LLMProvider.GOOGLE,
                "gemini": LLMProvider.GOOGLE,
                "ollama": LLMProvider.OLLAMA,
                "groq": LLMProvider.GROQ,
                "openai-compatible": LLMProvider.OPENAI_COMPATIBLE,
                "local": LLMProvider.OPENAI_COMPATIBLE,
            }
            provider = provider_map.get(provider.lower(), LLMProvider.ANTHROPIC)

        return cls(
            provider=provider,
            model_name=converted.get(
                "model_name", "meta-llama/llama-4-scout-17b-16e-instruct"
            ),
            temperature=converted.get("temperature", 0.7),
            max_tokens=converted.get("max_tokens", 4096),
            base_url=converted.get("base_url"),
        )


# =============================================================================
# Default Model Configurations by Provider
# =============================================================================

# Anthropic defaults
ANTHROPIC_DEFAULTS = ModelConfig(
    provider=LLMProvider.ANTHROPIC,
    model_name="claude-sonnet-4-20250514",
    temperature=0.7,
    max_tokens=4096,
)

# OpenAI defaults
OPENAI_DEFAULTS = ModelConfig(
    provider=LLMProvider.OPENAI,
    model_name="gpt-4o",
    temperature=0.7,
    max_tokens=4096,
)

# Google/Gemini defaults
GOOGLE_DEFAULTS = ModelConfig(
    provider=LLMProvider.GOOGLE,
    model_name="gemini-2.0-flash-exp",
    temperature=0.7,
    max_tokens=4096,
)

# Ollama defaults
OLLAMA_DEFAULTS = ModelConfig(
    provider=LLMProvider.OLLAMA,
    model_name="llama3.2",
    temperature=0.7,
    max_tokens=4096,
    base_url="http://localhost:11434",
)

# Groq defaults
GROQ_DEFAULTS = ModelConfig(
    provider=LLMProvider.GROQ,
    model_name="meta-llama/llama-4-scout-17b-16e-instruct",
    temperature=0.7,
    max_tokens=4096,
)

# OpenAI-compatible defaults (for LM Studio, LocalAI, etc.)
OPENAI_COMPATIBLE_DEFAULTS = ModelConfig(
    provider=LLMProvider.OPENAI_COMPATIBLE,
    model_name="model-name",
    temperature=0.7,
    max_tokens=4096,
    base_url="http://localhost:1234/v1",
)


# =============================================================================
# Provider Registry
# =============================================================================

PROVIDER_CONFIGS: dict[LLMProvider, ModelConfig] = {
    LLMProvider.ANTHROPIC: ANTHROPIC_DEFAULTS,
    LLMProvider.OPENAI: OPENAI_DEFAULTS,
    LLMProvider.GOOGLE: GOOGLE_DEFAULTS,
    LLMProvider.OLLAMA: OLLAMA_DEFAULTS,
    LLMProvider.GROQ: GROQ_DEFAULTS,
    LLMProvider.OPENAI_COMPATIBLE: OPENAI_COMPATIBLE_DEFAULTS,
}


def get_default_config_for_provider(provider: LLMProvider) -> ModelConfig:
    """Get the default configuration for a specific provider."""
    return PROVIDER_CONFIGS.get(provider, ANTHROPIC_DEFAULTS)


# =============================================================================
# Factory for Creating Model Configurations
# =============================================================================


@dataclass
class ModelDefaults:
    """Factory for creating ModelConfig instances with sensible defaults."""

    def create(
        self,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        base_url: Optional[str] = None,
    ) -> ModelConfig:
        """Create a ModelConfig with optional overrides.

        Args:
            provider: LLM provider name (e.g., "anthropic", "openai", "groq")
            model_name: Override the default model name
            temperature: Override the default temperature
            max_tokens: Override the default max tokens
            base_url: Override the default base URL (for Ollama, etc.)

        Returns:
            ModelConfig instance
        """
        # Parse provider string to enum
        if provider is None:
            # Try to load from environment variable
            import os

            provider_str = os.getenv("LLM_PROVIDER", "groq").lower()
            provider = provider_str

        # Map string to enum
        provider_map = {
            "openai": LLMProvider.OPENAI,
            "anthropic": LLMProvider.ANTHROPIC,
            "google": LLMProvider.GOOGLE,
            "gemini": LLMProvider.GOOGLE,
            "ollama": LLMProvider.OLLAMA,
            "groq": LLMProvider.GROQ,
            "openai-compatible": LLMProvider.OPENAI_COMPATIBLE,
            "local": LLMProvider.OPENAI_COMPATIBLE,
        }
        provider_enum = provider_map.get(provider, LLMProvider.ANTHROPIC)

        # Start with defaults for this provider
        config = get_default_config_for_provider(provider_enum)

        # Apply overrides
        if model_name is not None:
            config.model_name = model_name
        if temperature is not None:
            config.temperature = temperature
        if max_tokens is not None:
            config.max_tokens = max_tokens
        if base_url is not None:
            config.base_url = base_url

        return config


# =============================================================================
# File Loading Functions
# =============================================================================


def load_model_config(
    file_path: Union[str, Path],
    overrides: Optional[dict[str, Any]] = None,
    apply_env: bool = True,
) -> ModelConfig:
    """Load ModelConfig from a YAML or TOML file.

    Args:
        file_path: Path to the configuration file.
        overrides: Optional dictionary of overrides to apply after loading.
        apply_env: Whether to apply environment variable overrides.

    Returns:
        ModelConfig instance.

    Raises:
        ConfigLoadError: If the file cannot be loaded or parsed.

    Example:
        # Load from YAML
        config = load_model_config("config/model_config.yaml")

        # Load from TOML
        config = load_model_config("config/model_config.toml")

        # Load with overrides
        config = load_model_config("config.yaml", overrides={"temperature": 0.5})
    """
    # Load raw config
    raw_config = load_config_file(file_path)

    # Flatten nested config (support both flat and nested formats)
    if "model" in raw_config and isinstance(raw_config["model"], dict):
        raw_config = raw_config["model"]

    # Apply environment overrides
    if apply_env:
        raw_config = apply_env_overrides(raw_config, prefix="MODEL_")

    # Apply explicit overrides
    if overrides:
        raw_config = merge_configs(raw_config, overrides)

    return ModelConfig.from_dict(raw_config)


def load_model_config_with_defaults(
    file_path: Union[str, Path],
    provider: Optional[str] = None,
    apply_env: bool = True,
) -> ModelConfig:
    """Load ModelConfig from file with default provider configuration.

    This function first loads the provider defaults, then applies overrides
    from the configuration file.

    Args:
        file_path: Path to the configuration file.
        provider: LLM provider name for defaults.
        apply_env: Whether to apply environment variable overrides.

    Returns:
        ModelConfig instance.
    """
    # Get defaults for provider
    defaults = ModelDefaults()
    config = defaults.create(provider=provider)

    # Load config from file
    file_config = load_model_config(file_path, apply_env=apply_env)

    # Merge: file config takes precedence
    return merge_configs(file_config.to_dict(), config.to_dict())


# Singleton instance for easy importing
model_config = ModelDefaults()

# Export for convenient access
MODEL_DEFAULTS = model_config
