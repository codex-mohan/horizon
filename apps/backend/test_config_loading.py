"""Test configuration loading from YAML and TOML files."""

import sys

sys.path.insert(0, "src")

from agent.config import (
    load_agent_config,
    load_model_config,
    AgentConfig,
    ModelConfig,
    LLMProvider,
)


def test_yaml_loading():
    """Test loading agent config from YAML file."""
    config = load_agent_config("config_sample.yaml")
    assert config.provider == LLMProvider.ANTHROPIC
    assert config.model_name == "claude-sonnet-4-20250514"
    assert config.max_model_calls == 10
    assert config.enable_summarization == True
    print("[PASS] YAML loading test passed")


def test_toml_loading():
    """Test loading agent config from TOML file."""
    config = load_agent_config("config_sample.toml")
    assert config.provider == LLMProvider.ANTHROPIC
    assert config.max_model_calls == 10
    assert config.enable_summarization == True
    print("[PASS] TOML loading test passed")


def test_model_config_loading():
    """Test loading model config from YAML file."""
    model_config = load_model_config("config_sample.yaml")
    assert model_config.provider == LLMProvider.ANTHROPIC
    assert model_config.model_name == "claude-sonnet-4-20250514"
    assert model_config.temperature == 0.7
    print("[PASS] Model config loading test passed")


def test_flat_config_format():
    """Test loading flat (non-nested) config format."""
    flat_yaml = """
provider: openai
model_name: gpt-4o
temperature: 0.5
max_model_calls: 20
enable_summarization: false
"""
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
        f.write(flat_yaml)
        temp_path = f.name

    try:
        config = load_agent_config(temp_path)
        assert config.provider == LLMProvider.OPENAI
        assert config.model_name == "gpt-4o"
        assert config.max_model_calls == 20
        assert config.enable_summarization == False
        print("[PASS] Flat config format test passed")
    finally:
        os.unlink(temp_path)


def test_backward_compatibility():
    """Test backward compatibility with existing code."""
    config = AgentConfig()
    assert config.provider == LLMProvider.GROQ
    assert config.max_model_calls == 10
    print("[PASS] Backward compatibility test passed")


if __name__ == "__main__":
    test_yaml_loading()
    test_toml_loading()
    test_model_config_loading()
    test_flat_config_format()
    test_backward_compatibility()
    print("\nAll tests passed!")
