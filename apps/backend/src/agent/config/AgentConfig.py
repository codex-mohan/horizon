"""Configuration management for the agent system."""

from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class LLMProvider(str, Enum):
    """Supported LLM providers."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OLLAMA = "ollama"
    OPENAI_COMPATIBLE = "openai-compatible"


@dataclass
class AgentConfig:
    # LLM Provider Configuration
    provider: LLMProvider = LLMProvider.ANTHROPIC
    model_name: str = "claude-sonnet-4-20250514"
    temperature: float = 0.7
    max_tokens: int = 4096
    
    # API Keys (loaded from environment, can be overridden here)
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    
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
    
    # Todo settings
    todo_complexity_approach: str = "auto"  # llm, heuristic, or auto
    todo_complexity_threshold: int = 30
    
    # Limits
    max_model_calls: int = 10
    max_tool_calls: int = 20
    summarization_threshold: int = 135000
    rate_limit_window: int = 60
    
    # Retry settings
    max_retries: int = 3
    backoff_factor: float = 2.0
    initial_delay: float = 1.0
    
    # Fallback models (per provider)
    fallback_models: dict[str, list[str]] = field(default_factory=lambda: {
        "anthropic": ["claude-sonnet-4-20250514", "claude-opus-4-20250514"],
        "openai": ["gpt-4o", "gpt-4o-mini"],
        "google": ["gemini-2.0-flash-exp", "gemini-1.5-pro"],
        "ollama": ["llama3.2", "mistral"],
        "openai-compatible": ["model-name"],
    })
    
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
    
    def get_fallback_models(self) -> list[str]:
        """Get fallback models for the current provider."""
        return self.fallback_models.get(self.provider.value, [])
    
    @classmethod
    def development(cls) -> "AgentConfig":
        return cls(
            max_model_calls=50,
            enable_rate_limiting=False,
            enable_pii_detection=False,
        )
    
    @classmethod
    def production(cls) -> "AgentConfig":
        return cls(
            max_model_calls=10,
            enable_rate_limiting=True,
            enable_pii_detection=True,
        )
    
    @classmethod
    def from_env(cls) -> "AgentConfig":
        """Create config from environment variables."""
        import os
        from enum import Enum
        
        provider_str = os.getenv("LLM_PROVIDER", "anthropic").lower()
        provider_map = {
            "openai": cls.Provider.OPENAI,
            "anthropic": cls.Provider.ANTHROPIC,
            "google": cls.Provider.GOOGLE,
            "gemini": cls.Provider.GOOGLE,
            "ollama": cls.Provider.OLLAMA,
            "openai-compatible": cls.Provider.OPENAI_COMPATIBLE,
        }
        provider = provider_map.get(provider_str, cls.Provider.ANTHROPIC)
        
        # Map provider to config's provider (need to handle enum name conflict)
        provider_value = provider.value if isinstance(provider, Enum) else provider
        
        # Get the appropriate API key based on provider
        if provider_value == "google":
            api_key = os.getenv("GOOGLE_API_KEY")
        elif provider_value == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
        elif provider_value == "anthropic":
            api_key = os.getenv("ANTHROPIC_API_KEY")
        elif provider_value == "openai-compatible":
            api_key = os.getenv("OPENAI_COMPATIBLE_API_KEY")
        else:
            api_key = None
        
        # Get base URL based on provider
        if provider_value == "openai-compatible":
            base_url = os.getenv("OPENAI_COMPATIBLE_BASE_URL")
        elif provider_value == "ollama":
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        elif provider_value == "openai":
            base_url = os.getenv("OPENAI_BASE_URL")
        else:
            base_url = None
        
        return cls(
            provider=LLMProvider(provider_value) if isinstance(provider, Enum) else LLMProvider(provider_str),
            model_name=os.getenv("LLM_MODEL_NAME", "claude-sonnet-4-20250514"),
            temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
            max_tokens=int(os.getenv("LLM_MAX_TOKENS", "4096")),
            api_key=api_key,
            base_url=base_url,
        )
    
    # Keep old Provider enum for backward compatibility
    class Provider(str, Enum):
        OPENAI = "openai"
        ANTHROPIC = "anthropic"
        GOOGLE = "google"
        OLLAMA = "ollama"
        OPENAI_COMPATIBLE = "openai-compatible"
