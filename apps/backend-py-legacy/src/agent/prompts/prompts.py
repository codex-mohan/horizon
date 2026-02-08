"""Prompt template management."""

from datetime import datetime
from agent.config import AgentConfig
from agent.tools import get_all_tools
from agent.todo import get_todo_list_summary, get_task
import platform


class PromptBuilder:
    def __init__(self, config: AgentConfig):
        self.config = config

    def build_system_prompt(self, state: dict) -> str:
        """Build the complete system prompt from template."""


        # Build todo section if todo_list exists
        todo_section = self._build_todo_section(state)
        todo_tools_section = self._build_todo_tools_section(state)
        
        # Get token warning if threshold was reached
        token_warning = state.get("token_warning_message", "")
        token_warning_section = token_warning if token_warning else ""

        return f"""<character>
You are {state.get('metadata', {}).get('agent_name', 'Horizon')}.
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

## Token Usage
- **Input Tokens**: ~{state.get('input_tokens', 0):,}
- **Output Tokens**: ~{state.get('output_tokens', 0):,}
- **Total Tokens**: ~{state.get('total_tokens', 0):,}
</system_state>

{todo_section}

{todo_tools_section}

<security>
## Security Protocol
{self.config.security_requirements}
</security>

{token_warning_section}

---
"""

    def _build_todo_section(self, state: dict) -> str:
        """Build the todo section for the system prompt."""
        todo_list = state.get("todo_list")
        if not todo_list or not todo_list.get("tasks"):
            return ""

        summary = get_todo_list_summary(todo_list)
        active_task_id = todo_list.get("active_task_id")

        lines = ["<task_management>", "## Task Management"]

        if summary["total"] > 0:
            lines.append(f"**Progress**: {summary['completion_percentage']:.1f}% complete ({summary['completed']}/{summary['total']} tasks)")

            if active_task_id:
                active_task = get_task(todo_list, active_task_id)
                if active_task:
                    priority = active_task.get("priority", "medium").upper()
                    status = active_task.get("status", "pending")
                    lines.append(f"""
## Current Task (Work on this first)
**[{priority}]** {active_task['content']}
Status: {status}""")

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

    def _build_todo_tools_section(self, state: dict) -> str:
        """Build the todo tools section for the system prompt."""
        todo_list = state.get("todo_list")
        if not todo_list or not todo_list.get("tasks"):
            return ""

        return """
<todo_tools>
## Task Management Tools

Use these tools to manage your todo list when working on multi-step tasks:

### todo_list
List all tasks in the todo list with their status.
```
{{"action": "todo_list"}}
```

### todo_create_task
Create a new task in the todo list.
```
{{"action": "todo_create_task", "content": "Task description", "priority": "medium"}}
```
- `content` (required): Description of the task
- `priority` (optional): low, medium, high, or critical (default: medium)

### todo_set_active
Set which task is currently active (being worked on).
```
{{"action": "todo_set_active", "task_id": "abc123"}}
```
- `task_id` (required): ID of the task to set as active

### todo_complete
Mark a task as completed.
```
{{"action": "todo_complete", "task_id": "abc123", "result": "What was accomplished"}}
```
- `task_id` (required): ID of the task to complete
- `result` (optional): Result/outcome of completing the task

### todo_update_status
Update the status of any task.
```
{{"action": "todo_update_status", "task_id": "abc123", "status": "in_progress"}}
```
- `task_id` (required): ID of the task to update
- `status` (required): pending, in_progress, completed, blocked, or cancelled

## Workflow
1. Break down complex tasks using `todo_create_task`
2. Set the active task with `todo_set_active`
3. Work on tasks using other tools
4. Mark tasks complete with `todo_complete`
</todo_tools>
"""
