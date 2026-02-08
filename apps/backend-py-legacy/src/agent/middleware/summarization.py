"""Context summarization middleware."""

import os
from pathlib import Path

from agent.middleware.base import BaseMiddleware, console
from agent.state import AgentState
from agent.llm_loader import create_llm, LLMConfig
from agent.config import AgentConfig
from langchain_core.messages import HumanMessage, SystemMessage
from typing import Optional, Any


class SummarizationMiddleware(BaseMiddleware):
    """Summarize conversation when token limit approached."""
    
    def __init__(self, threshold: int = 135000, config: AgentConfig = None):
        super().__init__("Summarization")
        self.threshold = threshold
        self.config = config or AgentConfig.from_env()
        
        # Load system prompt from conversation_summarizer.md
        prompt_path = Path(__file__).parent.parent / "prompts" / "conversation_summarizer.md"
        if prompt_path.exists():
            self.system_prompt = prompt_path.read_text()
        else:
            # Fallback prompt if file not found
            self.system_prompt = """You are an expert Conversation Summarizer.
Create a comprehensive summary of the conversation that preserves all critical information including:
- Key decisions and their rationale
- Important numbers, measurements, and quantities
- Code snippets and technical specifications
- User preferences and requirements
- Action items and commitments

Format the summary clearly with sections for easy reference."""
    
    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Check and summarize if needed."""
        total_tokens = state.get("total_tokens", 0)
        
        if total_tokens >= self.threshold:
            console.log(f"[yellow]📝 [{self.name}] Token limit reached, summarizing[/yellow]")
            
            # Create LLM using config settings
            llm = create_llm(
                provider=self.config.provider if hasattr(self.config.provider, 'value') else None,
                model_name=self.config.model_name,
                temperature=0.3,  # Lower temperature for summarization
                max_tokens=2000,
                api_key=self.config.api_key,
                base_url=self.config.base_url,
            )
            
            summary_prompt = self._create_summary_prompt(state["messages"])
            
            # Create messages with system prompt and user prompt
            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=summary_prompt),
            ]
            
            response = await llm.ainvoke(messages)
            
            return {
                "long_term_memory": {
                    **state.get("long_term_memory", {}),
                    "summary": response.content
                }
            }
        
        return None
    
    def _create_summary_prompt(self, messages) -> str:
        """Create a summary request prompt with conversation context."""
        # Extract message content for summarization
        message_list = []
        for m in messages:
            if hasattr(m, 'content') and m.content:
                role = getattr(m, 'name', None) or type(m).__name__
                message_list.append(f"{role}: {m.content}")
        
        conversation_text = "\n".join(message_list)
        
        return f"""Please analyze the following conversation and create a comprehensive summary following the system prompt guidelines.

## Conversation History
{conversation_text}

## Summary Request
Create a detailed summary that:
1. Preserves ALL critical information (numbers, formulae, decisions, commitments)
2. Maintains the narrative flow and conversation arc
3. Highlights any action items or follow-ups
4. Extracts key technical details, code, and configurations

Begin your analysis now."""
