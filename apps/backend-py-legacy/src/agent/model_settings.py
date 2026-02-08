# ============================================================================
# model_settings.py
# ============================================================================
"""Model configuration settings for the Horizon Agent.

DEPRECATED: This module has been moved to agent.config.model_config.
Please update your imports to use the new location.

For backward compatibility, this module re-exports all symbols from the new location.
"""

# Re-export everything from the new location for backward compatibility
from agent.config.model_config import (
    LLMProvider,
    ModelConfig,
    ModelDefaults,
    ANTHROPIC_DEFAULTS,
    OPENAI_DEFAULTS,
    GOOGLE_DEFAULTS,
    OLLAMA_DEFAULTS,
    GROQ_DEFAULTS,
    OPENAI_COMPATIBLE_DEFAULTS,
    PROVIDER_CONFIGS,
    get_default_config_for_provider,
    model_config,
    MODEL_DEFAULTS,
)

__all__ = [
    "LLMProvider",
    "ModelConfig",
    "ModelDefaults",
    "ANTHROPIC_DEFAULTS",
    "OPENAI_DEFAULTS",
    "GOOGLE_DEFAULTS",
    "OLLAMA_DEFAULTS",
    "GROQ_DEFAULTS",
    "OPENAI_COMPATIBLE_DEFAULTS",
    "PROVIDER_CONFIGS",
    "get_default_config_for_provider",
    "model_config",
    "MODEL_DEFAULTS",
]
