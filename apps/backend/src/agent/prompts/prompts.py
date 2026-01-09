"""Prompt template management."""

from datetime import datetime
from agent.config import AgentConfig
from agent.tools import get_all_tools
from agent.todo import get_todo_list_summary, get_task
import platform
import os


class PromptBuilder:
    def __init__(self, config: AgentConfig):
        self.config = config
    
    def build_system_prompt(self, state: dict) -> str:
        """Build the complete system prompt from template."""
        
        tools_list = "\n".join([
            f"- {tool.name}: {tool.description}"
            for tool in get_all_tools()
        ])
        
        # Build todo section if todo_list exists
        todo_section = self._build_todo_section(state)
        
        return f"""<character>
You are {state.get('metadata', {}).get('agent_name', 'Claude')}.
{self.config.character}

</character>

<instructions>
{self.config.instructions}

## Interaction Guidelines
{self.config.interaction_guidelines}

## Knowledge & Capabilities
- Knowledge cutoff: January 2025
{self.config.knowledge_capabilities}

## Reasoning Approach
{self.config.reasoning_approach}
</instructions>

<response_format>
{self.config.response_format}

## Formatting Standards
{self.config.formatting_standards}
</response_format>

<system_state>
## System Information
- **System Name**: {platform.system()}
- **Operating System**: {platform.platform()}
- **Current Date**: {datetime.now().strftime("%Y-%m-%d")}
- **Current Time**: {datetime.now().strftime("%H:%M:%S")}
- **Connectivity Status**: Online

## Session Context
- **Session ID**: {state.get('session_id', 'unknown')}
- **User Preferences**: {state.get('user_preferences', {})}
- **Model Calls**: {state.get('model_calls', 0)}
- **Tool Calls**: {state.get('tool_calls', 0)}
</system_state>

{todo_section}

<security>
## Security Protocol
{self.config.security_requirements}
</security>

<tools>
## Available Tools
{tools_list}
</tools>
"""
    
    def _build_todo_section(self, state: dict) -> str:
        """Build the todo section for the system prompt."""
        todo_list = state.get("todo_list")
        if not todo_list or not todo_list.get("tasks"):
            return ""
        
        summary = get_todo_list_summary(todo_list)
        active_task_id = todo_list.get("active_task_id")
        
        lines = ["<task_management>", "## Task Management"]
        lines.append(f"**Progress**: {summary['completion_percentage']:.1f}% complete ({summary['completed']}/{summary['total']} tasks)")
        
        if active_task_id:
            active_task = get_task(todo_list, active_task_id)
            if active_task:
                priority = active_task.get("priority", "medium").upper()
                status = active_task.get("status", "pending")
                lines.append(f"""
## Current Task (Work on this first)
**[{priority}]** {active_task['content']}
Status: {status}
""")
        
        # List pending tasks
        pending = [t for t in todo_list["tasks"] if t["status"] == "pending"]
        if pending:
            lines.append("\n## Pending Tasks")
            for i, task in enumerate(pending, 1):
                if task["task_id"] != active_task_id:
                    priority = task.get("priority", "medium").upper()
                    lines.append(f"{i}. **[{priority}]** {task['content']}")
        
        lines.append("</task_management>")
        return "\n".join(lines)
