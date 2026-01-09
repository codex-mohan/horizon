# ============================================================================
# llm_loader.py
# ============================================================================
"""Multi-provider LLM loader using LangChain's init_chat_model.

Supports:
- OpenAI
- Anthropic
- Google (Gemini)
- Ollama (local models)
- Any OpenAI-compatible API (LM Studio, LocalAI, etc.)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Any

from langchain_core.language_models import BaseChatModel
from langchain_core.runnables import Runnable
from langchain_core.messages import BaseMessage
from langchain.chat_models import init_chat_model

# Import Google Generative AI for API key authentication
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    GOOGLE_GENAI_AVAILABLE = True
except ImportError:
    GOOGLE_GENAI_AVAILABLE = False


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OLLAMA = "ollama"
    OPENAI_COMPATIBLE = "openai-compatible"


@dataclass
class LLMConfig:
    """Configuration for loading an LLM."""
    provider: LLMProvider = LLMProvider.ANTHROPIC
    model_name: str = "claude-sonnet-4-20250514"
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    # Provider-specific options
    google_api_key: Optional[str] = None  # Alias for GOOGLE provider
    ollama_base_url: Optional[str] = None  # Alias for OLLAMA base URL
    
    def __post_init__(self):
        # Resolve provider-specific API keys
        if self.provider == LLMProvider.GOOGLE:
            if not self.api_key:
                self.api_key = self.google_api_key or os.getenv("GOOGLE_API_KEY")
        elif self.provider == LLMProvider.OLLAMA:
            if not self.base_url:
                self.base_url = self.ollama_base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        # For OpenAI-compatible, use base_url if provided
        elif self.provider == LLMProvider.OPENAI_COMPATIBLE:
            if not self.base_url:
                self.base_url = os.getenv("OPENAI_COMPATIBLE_BASE_URL")


def get_api_key_for_provider(provider: LLMProvider) -> Optional[str]:
    """Get the appropriate API key from environment variables for a provider."""
    env_vars = {
        LLMProvider.OPENAI: "OPENAI_API_KEY",
        LLMProvider.ANTHROPIC: "ANTHROPIC_API_KEY",
        LLMProvider.GOOGLE: "GOOGLE_API_KEY",
        LLMProvider.OLLAMA: None,  # Ollama doesn't use API keys
        LLMProvider.OPENAI_COMPATIBLE: "OPENAI_COMPATIBLE_API_KEY",
    }
    env_var = env_vars.get(provider)
    return os.getenv(env_var) if env_var else None


def get_base_url_for_provider(provider: LLMProvider) -> Optional[str]:
    """Get the appropriate base URL from environment variables for a provider."""
    env_vars = {
        LLMProvider.OPENAI: "OPENAI_BASE_URL",
        LLMProvider.ANTHROPIC: "ANTHROPIC_BASE_URL",
        LLMProvider.GOOGLE: None,  # Google doesn't use base URL
        LLMProvider.OLLAMA: "OLLAMA_BASE_URL",
        LLMProvider.OPENAI_COMPATIBLE: "OPENAI_COMPATIBLE_BASE_URL",
    }
    env_var = env_vars.get(provider)
    return os.getenv(env_var) if env_var else None


def _resolve_config(config: Optional[LLMConfig] = None) -> LLMConfig:
    """Resolve configuration with environment variable fallback."""
    if config is None:
        # Load from environment variables
        provider_str = os.getenv("LLM_PROVIDER", "anthropic").lower()
        provider_map = {
            "openai": LLMProvider.OPENAI,
            "anthropic": LLMProvider.ANTHROPIC,
            "google": LLMProvider.GOOGLE,
            "gemini": LLMProvider.GOOGLE,
            "ollama": LLMProvider.OLLAMA,
            "openai-compatible": LLMProvider.OPENAI_COMPATIBLE,
            "local": LLMProvider.OPENAI_COMPATIBLE,
        }
        provider = provider_map.get(provider_str, LLMProvider.ANTHROPIC)
        
        config = LLMConfig(
            provider=provider,
            model_name=os.getenv("LLM_MODEL_NAME", "claude-sonnet-4-20250514"),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
            api_key=get_api_key_for_provider(provider),
            base_url=get_base_url_for_provider(provider),
        )
    
    # Resolve API key and base URL from environment if not set
    if not config.api_key:
        config.api_key = get_api_key_for_provider(config.provider)
    if not config.base_url:
        config.base_url = get_base_url_for_provider(config.provider)
    
    return config


def _get_model_params(config: LLMConfig) -> dict[str, Any]:
    """Build parameters for init_chat_model based on provider."""
    params = {
        "model": config.model_name,
        "temperature": config.temperature,
    }
    
    if config.max_tokens is not None:
        params["max_tokens"] = config.max_tokens
    
    if config.api_key is not None:
        params["api_key"] = config.api_key
    
    if config.base_url is not None:
        params["base_url"] = config.base_url
    
    return params


def load_llm(config: Optional[LLMConfig] = None) -> BaseChatModel:
    """Load a chat model using LangChain's init_chat_model.
    
    Args:
        config: LLMConfig with provider and model settings.
                If None, loads from environment variables.
    
    Returns:
        Initialized LangChain chat model.
    
    Raises:
        ValueError: If API key is missing for providers that require it.
        ValueError: If an unsupported provider is specified.
    """
    config = _resolve_config(config)
    
    # Handle Google provider separately using ChatGoogleGenerativeAI (REST API with API key)
    if config.provider == LLMProvider.GOOGLE:
        if not GOOGLE_GENAI_AVAILABLE:
            raise ValueError(
                "langchain_google_genai is required for Google provider. "
                "Install with: pip install -U langchain-google-genai"
            )
        if not config.api_key:
            raise ValueError(
                "API key is required for Google. Please set GOOGLE_API_KEY environment variable."
            )
        
        return ChatGoogleGenerativeAI(
            model=config.model_name,
            google_api_key=config.api_key,
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
        )
    
    # Provider to model type mapping for init_chat_model
    provider_to_model_type = {
        LLMProvider.OPENAI: "openai",
        LLMProvider.ANTHROPIC: "anthropic",
        LLMProvider.OLLAMA: "ollama",
        LLMProvider.OPENAI_COMPATIBLE: "openai",
    }
    
    model_type = provider_to_model_type.get(config.provider)
    if model_type is None:
        raise ValueError(f"Unsupported LLM provider: {config.provider}")
    
    # Check for required API keys
    if config.provider in (LLMProvider.OPENAI, LLMProvider.ANTHROPIC):
        if not config.api_key:
            raise ValueError(
                f"API key is required for {config.provider.value}. "
                f"Please set the appropriate environment variable."
            )
    
    params = _get_model_params(config)
    
    return init_chat_model(model_type=model_type, **params)


def create_llm(
    provider: Optional[LLMProvider] = None,
    model_name: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> BaseChatModel:
    """Convenience function to create an LLM.
    
    Args:
        provider: LLM provider to use.
        model_name: Name of the model to load.
        temperature: Temperature for sampling.
        max_tokens: Maximum tokens to generate.
        api_key: API key for the provider.
        base_url: Base URL for OpenAI-compatible APIs.
    
    Returns:
        Initialized LangChain chat model.
    """
    if provider is None:
        # Load from environment
        provider_str = os.getenv("LLM_PROVIDER", "anthropic").lower()
        provider_map = {
            "openai": LLMProvider.OPENAI,
            "anthropic": LLMProvider.ANTHROPIC,
            "google": LLMProvider.GOOGLE,
            "gemini": LLMProvider.GOOGLE,
            "ollama": LLMProvider.OLLAMA,
            "openai-compatible": LLMProvider.OPENAI_COMPATIBLE,
        }
        provider = provider_map.get(provider_str, LLMProvider.ANTHROPIC)
    
    config = LLMConfig(
        provider=provider,
        model_name=model_name or os.getenv("LLM_MODEL_NAME", "claude-sonnet-4-20250514"),
        temperature=temperature,
        max_tokens=max_tokens,
        api_key=api_key,
        base_url=base_url,
    )
    
    return load_llm(config)


# =============================================================================
# Convenience Functions for Specific Providers
# =============================================================================

def load_openai(
    model_name: str = "gpt-4o",
    temperature: float = 0.7,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> BaseChatModel:
    """Load an OpenAI model."""
    config = LLMConfig(
        provider=LLMProvider.OPENAI,
        model_name=model_name,
        temperature=temperature,
        api_key=api_key,
        base_url=base_url,
    )
    return load_llm(config)


def load_anthropic(
    model_name: str = "claude-sonnet-4-20250514",
    temperature: float = 0.7,
    api_key: Optional[str] = None,
) -> BaseChatModel:
    """Load an Anthropic model."""
    config = LLMConfig(
        provider=LLMProvider.ANTHROPIC,
        model_name=model_name,
        temperature=temperature,
        api_key=api_key,
    )
    return load_llm(config)


def load_google(
    model_name: str = "gemini-2.0-flash-exp",
    temperature: float = 0.7,
    api_key: Optional[str] = None,
) -> BaseChatModel:
    """Load a Google Gemini model."""
    config = LLMConfig(
        provider=LLMProvider.GOOGLE,
        model_name=model_name,
        temperature=temperature,
        api_key=api_key,
    )
    return load_llm(config)


def load_ollama(
    model_name: str = "llama3.2",
    temperature: float = 0.7,
    base_url: Optional[str] = None,
) -> BaseChatModel:
    """Load an Ollama model (local)."""
    config = LLMConfig(
        provider=LLMProvider.OLLAMA,
        model_name=model_name,
        temperature=temperature,
        base_url=base_url,
    )
    return load_llm(config)


def load_openai_compatible(
    model_name: str,
    base_url: str,
    api_key: Optional[str] = None,
    temperature: float = 0.7,
) -> BaseChatModel:
    """Load an OpenAI-compatible model (LM Studio, LocalAI, etc.)."""
    config = LLMConfig(
        provider=LLMProvider.OPENAI_COMPATIBLE,
        model_name=model_name,
        temperature=temperature,
        api_key=api_key,
        base_url=base_url,
    )
    return load_llm(config)


# =============================================================================
# Factory Function
# =============================================================================

def get_loader_for_provider(provider: LLMProvider):
    """Get the appropriate loader function for a provider."""
    loaders = {
        LLMProvider.OPENAI: load_openai,
        LLMProvider.ANTHROPIC: load_anthropic,
        LLMProvider.GOOGLE: load_google,
        LLMProvider.OLLAMA: load_ollama,
        LLMProvider.OPENAI_COMPATIBLE: load_openai_compatible,
    }
    return loaders.get(provider)
