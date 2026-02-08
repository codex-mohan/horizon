# ============================================================================
# llm_loader.py
# ============================================================================
"""Multi-provider LLM loader using LangChain's init_chat_model.

Supports:
- OpenAI
- Anthropic
- Google (Gemini)
- Ollama (local models)
- Groq (fast inference)
- Any OpenAI-compatible API (LM Studio, LocalAI, etc.)

Model configuration should be managed in model_settings.py.
API keys should be in environment variables (never in code).
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

from rich.console import Console

# Import model settings for configuration (use relative import)
from .model_settings import (
    LLMProvider,
    ModelConfig,
    ModelDefaults,
    get_default_config_for_provider,
)

# Create a ModelDefaults instance for configuration
model_defaults = ModelDefaults()

console = Console()

# Import Google Generative AI for API key authentication
try:
    from langchain_google_genai import ChatGoogleGenerativeAI
    GOOGLE_GENAI_AVAILABLE = True
except ImportError:
    GOOGLE_GENAI_AVAILABLE = False

# Import Groq for native Groq support
try:
    from langchain_groq import ChatGroq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False


# =============================================================================
# LLM Configuration (using model_settings.py)
# =============================================================================

# LLMConfig is now imported from model_settings.py as ModelConfig
# Use ModelConfig from src.agent.model_settings for all configuration

# For backward compatibility, create an alias
LLMConfig = ModelConfig


def get_api_key_for_provider(provider: LLMProvider) -> Optional[str]:
    """Get the appropriate API key from environment variables for a provider."""
    env_vars = {
        LLMProvider.OPENAI: "OPENAI_API_KEY",
        LLMProvider.ANTHROPIC: "ANTHROPIC_API_KEY",
        LLMProvider.GOOGLE: "GOOGLE_API_KEY",
        LLMProvider.OLLAMA: None,  # Ollama doesn't use API keys
        LLMProvider.GROQ: "GROQ_API_KEY",
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
        LLMProvider.GROQ: None,  # Groq is handled natively by langchain-groq
        LLMProvider.OPENAI_COMPATIBLE: "OPENAI_COMPATIBLE_BASE_URL",
    }
    env_var = env_vars.get(provider)
    return os.getenv(env_var) if env_var else None


def _resolve_config(config: Optional[ModelConfig] = None) -> tuple[ModelConfig, Optional[str]]:
    """Resolve configuration with environment variable fallback.
    
    Returns:
        Tuple of (ModelConfig, api_key) where api_key is separate from config
    """
    api_key = None
    
    if config is None:
        # Use model_settings factory to create config from environment/model_settings.py
        config = model_defaults.create()
    
    # Get API key from environment for the provider
    api_key = get_api_key_for_provider(config.provider)
    
    return config, api_key


def _get_model_params(config: ModelConfig, api_key: Optional[str] = None) -> dict[str, Any]:
    """Build parameters for init_chat_model based on provider."""
    params = {
        "model": config.model_name,
        "temperature": config.temperature,
    }
    
    if config.max_tokens is not None:
        params["max_tokens"] = config.max_tokens
    
    if api_key is not None:
        params["api_key"] = api_key
    
    # Only set base_url for providers that need it (not Groq - handled natively)
    if config.base_url is not None and config.provider != LLMProvider.GROQ:
        params["base_url"] = config.base_url
    
    return params


def load_llm(config: Optional[ModelConfig] = None) -> BaseChatModel:
    """Load a chat model using LangChain's init_chat_model.
    
    Args:
        config: ModelConfig with provider and model settings (from model_settings.py).
                If None, loads from model_settings.py defaults/environment.
    
    Returns:
        Initialized LangChain chat model.
    
    Raises:
        ValueError: If API key is missing for providers that require it.
        ValueError: If an unsupported provider is specified.
    """
    config, api_key = _resolve_config(config)
    
    # Handle Google provider separately using ChatGoogleGenerativeAI (REST API with API key)
    if config.provider == LLMProvider.GOOGLE:
        if not GOOGLE_GENAI_AVAILABLE:
            raise ValueError(
                "langchain_google_genai is required for Google provider. "
                "Install with: pip install -U langchain-google-genai"
            )
        if not api_key:
            raise ValueError(
                "API key is required for Google. Please set GOOGLE_API_KEY environment variable."
            )
        
        return ChatGoogleGenerativeAI(
            model=config.model_name,
            google_api_key=api_key,
            temperature=config.temperature,
            max_output_tokens=config.max_tokens,
        )
    
    # Handle Groq provider separately using ChatGroq (native Groq support)
    if config.provider == LLMProvider.GROQ:
        if not GROQ_AVAILABLE:
            raise ValueError(
                "langchain_groq is required for Groq provider. "
                "Install with: pip install -U langchain-groq"
            )
        if not api_key:
            raise ValueError(
                "API key is required for Groq. Please set GROQ_API_KEY environment variable."
            )
        
        return ChatGroq(
            model=config.model_name,
            groq_api_key=api_key,
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
    
    # Provider to model type mapping for init_chat_model
    provider_to_provider_str = {
        LLMProvider.OPENAI: "openai",
        LLMProvider.ANTHROPIC: "anthropic",
        LLMProvider.OLLAMA: "ollama",
        LLMProvider.GROQ: "groq",
        LLMProvider.OPENAI_COMPATIBLE: "openai",
    }
    
    model_type = provider_to_provider_str.get(config.provider)
    if model_type is None:
        raise ValueError(f"Unsupported LLM provider: {config.provider}")
    
    console.log(f"Got Model Type: {model_type}")
    
    # Check for required API keys (excluding Groq - handled separately)
    if config.provider in (LLMProvider.OPENAI, LLMProvider.ANTHROPIC):
        if not api_key:
            raise ValueError(
                f"API key is required for {config.provider.value}. "
                f"Please set the appropriate environment variable."
            )
    
    params = _get_model_params(config, api_key)
    
    return init_chat_model(model_provider=model_type, **params)


def create_llm(
    provider: Optional[str] = None,
    model_name: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: Optional[int] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
) -> BaseChatModel:
    """Convenience function to create an LLM.
    
    Args:
        provider: LLM provider to use (string like "anthropic", "groq", etc.).
        model_name: Name of the model to load.
        temperature: Temperature for sampling.
        max_tokens: Maximum tokens to generate.
        api_key: API key for the provider (optional, will use env var if not provided).
        base_url: Base URL for OpenAI-compatible APIs.
    
    Returns:
        Initialized LangChain chat model.
    """
    # Use model_defaults factory to create config
    config = model_defaults.create(
        provider=provider,
        model_name=model_name,
        temperature=temperature,
        max_tokens=max_tokens,
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
    config = ModelConfig(
        provider=LLMProvider.OPENAI,
        model_name=model_name,
        temperature=temperature,
        base_url=base_url,
    )
    return load_llm(config)


def load_anthropic(
    model_name: str = "claude-sonnet-4-20250514",
    temperature: float = 0.7,
    api_key: Optional[str] = None,
) -> BaseChatModel:
    """Load an Anthropic model."""
    config = ModelConfig(
        provider=LLMProvider.ANTHROPIC,
        model_name=model_name,
        temperature=temperature,
    )
    return load_llm(config)


def load_google(
    model_name: str = "gemini-2.0-flash-exp",
    temperature: float = 0.7,
    api_key: Optional[str] = None,
) -> BaseChatModel:
    """Load a Google Gemini model."""
    config = ModelConfig(
        provider=LLMProvider.GOOGLE,
        model_name=model_name,
        temperature=temperature,
    )
    return load_llm(config)


def load_ollama(
    model_name: str = "llama3.2",
    temperature: float = 0.7,
    base_url: Optional[str] = None,
) -> BaseChatModel:
    """Load an Ollama model (local)."""
    config = ModelConfig(
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
    config = ModelConfig(
        provider=LLMProvider.OPENAI_COMPATIBLE,
        model_name=model_name,
        temperature=temperature,
        base_url=base_url,
    )
    return load_llm(config)


def load_groq(
    model_name: str = "llama-3.3-70b-versatile",
    temperature: float = 0.7,
    api_key: Optional[str] = None,
) -> BaseChatModel:
    """Load a Groq model (fast inference)."""
    config = ModelConfig(
        provider=LLMProvider.GROQ,
        model_name=model_name,
        temperature=temperature,
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
        LLMProvider.GROQ: load_groq,
        LLMProvider.OPENAI_COMPATIBLE: load_openai_compatible,
    }
    return loaders.get(provider)
