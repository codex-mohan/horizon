"""Conversation Summarizer Sub-Agent for LangGraph/LangChain Workflow.

This module provides a specialized sub-agent for generating detailed summaries
of LangGraph conversations while preserving crucial context, numbers, formulae,
and other critical information.

Usage:
    from src.agent.sub_agents.conversation_summerizer import (
        create_summarizer_graph,
        summarize_conversation,
        SummarizerState,
    )

    # Option 1: Direct async function call
    summary = await summarize_conversation(messages, llm)

    # Option 2: Use as a LangGraph node
    summarizer_graph = create_summarizer_graph(llm)
    result = await summarizer_graph.ainvoke(state)
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any, Dict, List, Optional, Union

from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.runnables import Runnable
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph
from typing_extensions import TypedDict


# =============================================================================
# SYSTEM PROMPT LOADER
# =============================================================================

def _get_prompts_dir() -> str:
    """Get the directory path for prompts."""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(current_dir, "..", "prompts")


@lru_cache(maxsize=1)
def load_summarizer_system_prompt() -> str:
    """Load the conversation summarizer system prompt from .md file.

    Returns:
        The system prompt string from the markdown file.
    """
    prompts_dir = _get_prompts_dir()
    prompt_file = os.path.join(prompts_dir, "conversation_summarizer.md")

    if not os.path.exists(prompt_file):
        return _FALLBACK_SYSTEM_PROMPT

    with open(prompt_file, "r", encoding="utf-8") as f:
        return f.read()


# =============================================================================
# State Definitions
# =============================================================================

class SummarizerState(TypedDict):
    """State for the conversation summarizer sub-agent."""
    messages: List[BaseMessage]
    conversation_metadata: Dict[str, Any]
    summary: str
    intermediate_steps: List[str]


@dataclass
class SummarizerInput:
    """Input data structure for the summarizer."""
    messages: List[Union[Dict[str, Any], BaseMessage]]
    metadata: Optional[Dict[str, Any]] = None
    options: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.options is None:
            self.options = {}


# =============================================================================
# Utility Functions
# =============================================================================

def messages_to_dicts(messages: List[BaseMessage]) -> List[Dict[str, Any]]:
    """Convert BaseMessage objects to dictionaries."""
    result = []
    for msg in messages:
        msg_dict = {
            "type": msg.type,
            "content": msg.content,
        }
        if hasattr(msg, "additional_kwargs") and msg.additional_kwargs:
            msg_dict["additional_kwargs"] = msg.additional_kwargs
        if hasattr(msg, "response_metadata") and msg.response_metadata:
            msg_dict["response_metadata"] = msg.response_metadata
        if hasattr(msg, "tool_calls") and msg.tool_calls:
            msg_dict["tool_calls"] = [
                {
                    "id": tc.get("id", ""),
                    "name": tc.get("name", ""),
                    "args": tc.get("args", {}),
                }
                for tc in msg.tool_calls
            ]
        if hasattr(msg, "id") and msg.id:
            msg_dict["id"] = msg.id
        result.append(msg_dict)
    return result


def dicts_to_messages(message_dicts: List[Dict[str, Any]]) -> List[BaseMessage]:
    """Convert dictionaries back to BaseMessage objects."""
    messages = []
    for msg_dict in message_dicts:
        msg_type = msg_dict.get("type", "unknown")
        content = msg_dict.get("content", "")

        if msg_type == "human":
            messages.append(HumanMessage(content=content))
        elif msg_type == "ai":
            messages.append(AIMessage(content=content))
        elif msg_type == "system":
            messages.append(SystemMessage(content=content))
        elif msg_type == "tool":
            messages.append(ToolMessage(content=content, tool_call_id=msg_dict.get("tool_call_id", "")))
        else:
            messages.append(HumanMessage(content=f"[Unknown message type: {msg_type}] {content}"))
    return messages


def extract_critical_info(message_dicts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Pre-extract critical information from messages."""
    critical_info = {
        "numbers": [],
        "formulae": [],
        "code_snippets": [],
        "decisions": [],
        "commitments": [],
        "error_messages": [],
        "urls": [],
        "configuration_values": [],
    }

    number_pattern = re.compile(
        r'\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\s*(?:px|em|rem|%|vw|vh|ms|s|min|h|d|kb|mb|gb|tb|KB|MB|GB|TB)?\b'
    )
    formula_pattern = re.compile(
        r'(?:[a-zA-Z_][a-zA-Z0-9_]*\s*[=><!+\-*/%^]|Math\.\w+|lambda\s+.+:|def\s+\w+\s*\([^)]*\)\s*:)'
    )
    url_pattern = re.compile(
        r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[^\s]*'
    )
    config_patterns = [
        re.compile(r'(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*[^\s]+', re.IGNORECASE),
        re.compile(r'(?:DATABASE_URL|DB_URL|REDIS_URL)\s*[=:]\s*[^\s]+', re.IGNORECASE),
        re.compile(r'(?:PORT|HOST|PATH)\s*[=:]\s*\d+', re.IGNORECASE),
    ]

    for idx, msg in enumerate(message_dicts):
        content = str(msg.get("content", ""))

        numbers = number_pattern.findall(content)
        if numbers:
            critical_info["numbers"].append({"message_idx": idx, "values": numbers})

        formulae = formula_pattern.findall(content)
        if formulae:
            critical_info["formulae"].append({"message_idx": idx, "expressions": formulae})

        code_blocks = re.findall(r'```[\w]*\n[\s\S]*?```', content)
        if code_blocks:
            critical_info["code_snippets"].append({"message_idx": idx, "codes": code_blocks})

        urls = url_pattern.findall(content)
        if urls:
            critical_info["urls"].append({"message_idx": idx, "links": urls})

        for pattern in config_patterns:
            matches = pattern.findall(content)
            if matches:
                critical_info["configuration_values"].append(
                    {"message_idx": idx, "values": matches}
                )

        if any(keyword in content.lower() for keyword in ["decided", "decision", "agreed", "will", "promise", "commit"]):
            if "decision" not in critical_info or len(critical_info["decisions"]) < 5:
                critical_info["decisions"].append({"message_idx": idx, "content": content[:200]})

        if any(keyword in content.lower() for keyword in ["error", "exception", "failed", "traceback"]):
            critical_info["error_messages"].append({"message_idx": idx, "content": content[:300]})

    return critical_info


# =============================================================================
# Summarizer Node Functions
# =============================================================================

async def create_summarizer_prompt(
    messages: List[BaseMessage],
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """Create the full summarization prompt."""
    system_prompt = load_summarizer_system_prompt()
    message_dicts = messages_to_dicts(messages)
    critical_info = extract_critical_info(message_dicts)

    context_parts = []

    if metadata:
        context_parts.append("## Conversation Metadata")
        for key, value in metadata.items():
            context_parts.append(f"- **{key}**: {value}")

    if critical_info.get("numbers"):
        context_parts.append("\n## Pre-Extracted Numbers")
        for item in critical_info["numbers"][:10]:
            context_parts.append(f"- Message {item['message_idx']}: {', '.join(item['values'])}")

    if critical_info.get("formulae"):
        context_parts.append("\n## Pre-Extracted Formulae")
        for item in critical_info["formulae"][:10]:
            context_parts.append(f"- Message {item['message_idx']}: {item['expressions']}")

    if critical_info.get("code_snippets"):
        context_parts.append("\n## Pre-Extracted Code Snippets")
        for item in critical_info["code_snippets"][:5]:
            context_parts.append(f"- Message {item['message_idx']}: {item['codes']}")

    if critical_info.get("urls"):
        context_parts.append("\n## Pre-Extracted URLs")
        for item in critical_info["urls"][:10]:
            context_parts.append(f"- Message {item['message_idx']}: {item['links']}")

    conversation_formatted = "\n\n".join([
        f"--- Message {idx} ({msg.get('type', 'unknown')}) ---\n{msg.get('content', '')}"
        for idx, msg in enumerate(message_dicts)
    ])

    full_prompt = f"""{system_prompt}

{chr(10).join(context_parts) if context_parts else ''}

## Full Conversation History
Below is the complete conversation history to summarize:

{conversation_formatted}

---

Now, generate a comprehensive summary following the structure and requirements specified in the system prompt above. Ensure all critical information is preserved and properly formatted.
"""
    return full_prompt


async def summarizer_node(
    state: SummarizerState,
    llm: Union[ChatGoogleGenerativeAI, ChatOpenAI],
) -> Dict[str, Any]:
    """Process messages and generate a summary."""
    messages = state.get("messages", [])
    metadata = state.get("conversation_metadata", {})
    intermediate_steps = state.get("intermediate_steps", [])

    intermediate_steps.append(f"Processing {len(messages)} messages")

    prompt = await create_summarizer_prompt(messages, metadata)
    response = await llm.ainvoke([HumanMessage(content=prompt)])

    intermediate_steps.append("Summary generated successfully")

    return {
        "summary": response.content,
        "intermediate_steps": intermediate_steps,
    }


# =============================================================================
# Graph Creation
# =============================================================================

def create_summarizer_graph(
    llm: Optional[Union[ChatGoogleGenerativeAI, ChatOpenAI]] = None,
    name: str = "Conversation Summarizer",
) -> StateGraph:
    """Create a LangGraph for conversation summarization."""
    if llm is None:
        from agent.llm_loader import create_llm
        llm = create_llm()

    builder = StateGraph(SummarizerState)
    builder.add_node("summarize", lambda state: summarizer_node(state, llm))
    builder.add_edge("__start__", "summarize")
    builder.add_edge("summarize", "__end__")

    return builder.compile(name=name)


# =============================================================================
# Convenience Functions
# =============================================================================

async def summarize_conversation(
    messages: List[Union[Dict[str, Any], BaseMessage]],
    llm: Optional[Union[ChatGoogleGenerativeAI, ChatOpenAI]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """Convenience function to summarize a conversation."""
    if llm is None:
        from agent.llm_loader import create_llm
        llm = create_llm()

    if messages and isinstance(messages[0], dict):
        base_messages = dicts_to_messages(messages)
    else:
        base_messages = messages

    graph = create_summarizer_graph(llm)

    initial_state = SummarizerState(
        messages=base_messages,
        conversation_metadata=metadata or {},
        summary="",
        intermediate_steps=[],
    )

    result = await graph.ainvoke(initial_state)
    return result.get("summary", "")


async def summarize_with_structured_output(
    messages: List[Union[Dict[str, Any], BaseMessage]],
    llm: Optional[Union[ChatGoogleGenerativeAI, ChatOpenAI]] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Summarize conversation with structured output."""
    summary_text = await summarize_conversation(messages, llm, metadata)

    structured = {
        "full_summary": summary_text,
        "overview": "",
        "key_findings": [],
        "decisions": [],
        "action_items": [],
        "critical_info": {},
    }

    lines = summary_text.split("\n")
    current_section = ""
    for line in lines:
        if line.startswith("## "):
            current_section = line[3:].strip()
        elif line.startswith("- "):
            item = line[2:].strip()
            if current_section == "Overview":
                structured["overview"] += item + "\n"
            elif current_section in ["Key Findings & Decisions", "Decisions Made"]:
                structured["decisions"].append(item)
            elif current_section == "Action Items & Follow-ups":
                if item.startswith("[ ]") or item.startswith("-[ ]"):
                    structured["action_items"].append(item)

    return structured


# =============================================================================
# LangChain Runnable Wrapper
# =============================================================================

class ConversationSummarizer(Runnable):
    """LangChain Runnable wrapper for the conversation summarizer."""

    def __init__(
        self,
        llm: Optional[Union[ChatGoogleGenerativeAI, ChatOpenAI]] = None,
    ):
        if llm is None:
            from agent.llm_loader import create_llm
            llm = create_llm()
        self.llm = llm
        self.graph = create_summarizer_graph(llm)

    async def ainvoke(
        self,
        input_: Dict[str, Any],
        config: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        messages = input_.get("messages", [])
        metadata = input_.get("metadata", {})

        if messages and isinstance(messages[0], dict):
            base_messages = dicts_to_messages(messages)
        else:
            base_messages = messages

        state = SummarizerState(
            messages=base_messages,
            conversation_metadata=metadata,
            summary="",
            intermediate_steps=[],
        )

        return await self.graph.ainvoke(state, config=config)

    def invoke(
        self,
        input_: Dict[str, Any],
        config: Optional[Dict[str, Any]] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        import asyncio
        return asyncio.run(self.ainvoke(input_, config, **kwargs))


# =============================================================================
# Fallback System Prompt (if .md file not found)
# =============================================================================

_FALLBACK_SYSTEM_PROMPT = """You are an expert Conversation Summarizer specialized in creating comprehensive,
context-preserving summaries of AI conversations.

## CORE OBJECTIVES
1. Preserve Complete Context: Ensure no important context is lost in summarization
2. Extract Critical Information: Identify and highlight crucial numbers, formulae, decisions, and insights
3. Maintain Narrative Flow: Keep track of the conversation arc and progression
4. Highlight Action Items: Capture any tasks, follow-ups, or pending actions

## SUMMARY REQUIREMENTS

### Information Priority Hierarchy
**TIER 1 - CRITICAL (Always Include):**
- Numerical values, measurements, counts, dates, times
- Mathematical formulae, equations, algorithms
- Decisions made and their rationale
- Commitments, promises, or agreements
- Error messages, code snippets, technical specifications
- API endpoints, URLs, configuration values

**TIER 2 - HIGH PRIORITY:**
- Key arguments or positions
- Questions posed and their answers
- Problem statements and proposed solutions

### Structural Format
Provide summary with: Overview, Key Findings & Decisions, Detailed Breakdown, Extracted Knowledge, Action Items, and Preserved Context.
"""
