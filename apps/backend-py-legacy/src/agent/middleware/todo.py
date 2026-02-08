"""Simplified todo middleware - model manages tasks via tools."""

from __future__ import annotations

from typing import Optional, Any
from langchain_core.tools import BaseTool

from agent.middleware.base import BaseMiddleware, console
from agent.state import AgentState
from agent.todo import (
    TodoList,
    create_empty_todo_list,
    create_task,
    update_task_status,
    set_active_task,
    get_task,
    get_next_task,
    get_pending_tasks,
    get_todo_list_summary,
)


# ============================================================================
# Todo Tools for the Model
# ============================================================================

class TodoListTasksTool(BaseTool):
    """Tool to list all tasks in the todo list."""

    name: str = "todo_list"
    description: str = """List all tasks in the todo list with their status.

    Returns:
        JSON with todo list summary and all tasks"""

    todo_list: Optional[TodoList] = None

    def _run(self) -> str:
        """Execute the tool."""
        if self.todo_list is None:
            return '{"error": "No todo list exists"}'

        todo_list = self.todo_list
        summary = get_todo_list_summary(todo_list)

        tasks = []
        for task in todo_list["tasks"]:
            tasks.append({
                "task_id": task["task_id"],
                "content": task["content"],
                "status": task["status"],
                "priority": task["priority"],
            })

        return f'''{{
    "summary": {{
        "total": {summary["total"]},
        "completed": {summary["completed"]},
        "in_progress": {summary["in_progress"]},
        "pending": {summary["pending"]},
        "completion_percentage": {summary["completion_percentage"]}
    }},
    "active_task_id": {f'"{summary["active_task_id"]}"' if summary["active_task_id"] else "null"},
    "tasks": {tasks}
}}'''

    async def _arun(self) -> str:
        """Async execution."""
        return self._run()


class TodoCreateTaskTool(BaseTool):
    """Tool to create a new task in the todo list."""

    name: str = "todo_create_task"
    description: str = """Create a new task in the todo list.

    Args:
        content: Description of the task (required)
        priority: Task priority - low, medium, high, or critical (default: medium)
        parent_task_id: Optional ID of a parent task for subtasks

    Returns:
        JSON with task_id and confirmation message"""

    todo_list: Optional[TodoList] = None

    def _run(self, content: str, priority: str = "medium", parent_task_id: Optional[str] = None) -> str:
        """Execute the tool."""
        if self.todo_list is None:
            return '{"error": "No todo list exists"}'

        task = create_task(self.todo_list, content, priority, parent_task_id)
        return f'{{"task_id": "{task["task_id"]}", "content": "{content}", "status": "pending"}}'

    async def _arun(self, content: str, priority: str = "medium", parent_task_id: Optional[str] = None) -> str:
        """Async execution."""
        return self._run(content, priority, parent_task_id)


class TodoUpdateTaskStatusTool(BaseTool):
    """Tool to update a task's status."""

    name: str = "todo_update_status"
    description: str = """Update the status of a task.

    Args:
        task_id: ID of the task to update (required)
        status: New status - pending, in_progress, completed, blocked, or cancelled (required)
        result: Optional result/outcome when completing the task

    Returns:
        JSON with updated task info or error"""

    todo_list: Optional[TodoList] = None

    def _run(self, task_id: str, status: str, result: Optional[str] = None) -> str:
        """Execute the tool."""
        if self.todo_list is None:
            return '{"error": "No todo list exists"}'

        task = get_task(self.todo_list, task_id)
        if not task:
            return f'{{"error": "Task {task_id} not found"}}'

        updated = update_task_status(self.todo_list, task_id, status, result)
        if updated:
            return f'{{"task_id": "{task_id}", "status": "{status}", "content": "{updated["content"]}"}}'
        return f'{{"error": "Failed to update task {task_id}"}}'

    async def _arun(self, task_id: str, status: str, result: Optional[str] = None) -> str:
        """Async execution."""
        return self._run(task_id, status, result)


class TodoSetActiveTaskTool(BaseTool):
    """Tool to set the active task."""

    name: str = "todo_set_active"
    description: str = """Set which task is currently active (being worked on).

    Args:
        task_id: ID of the task to set as active, or null to clear active task

    Returns:
        JSON with confirmation or error"""

    todo_list: Optional[TodoList] = None

    def _run(self, task_id: str | None) -> str:
        """Execute the tool."""
        if self.todo_list is None:
            return '{"error": "No todo list exists"}'

        if task_id is None:
            set_active_task(self.todo_list, None)
            return '{"status": "cleared", "message": "Active task cleared"}'

        task = get_task(self.todo_list, task_id)
        if not task:
            return f'{{"error": "Task {task_id} not found"}}'

        set_active_task(self.todo_list, task_id)
        return f'{{"task_id": "{task_id}", "content": "{task["content"]}", "status": "active"}}'

    async def _arun(self, task_id: str | None) -> str:
        """Async execution."""
        return self._run(task_id)


def get_todo_tools(todo_list: TodoList | None) -> list[BaseTool]:
    """Get todo tools bound to the current todo list."""
    if not todo_list:
        return []

    tools: list[BaseTool] = [
        TodoListTasksTool(),
        TodoCreateTaskTool(),
        TodoUpdateTaskStatusTool(),
        TodoSetActiveTaskTool(),
    ]

    for tool in tools:
        tool.todo_list = todo_list

    return tools


# ============================================================================
# Todo Middleware - Initializes todo list and provides context
# ============================================================================

class TodoMiddleware(BaseMiddleware):
    """Middleware for todo list management.

    Simple approach:
    1. Initialize empty todo list if not exists
    2. Provide todo context in system prompt
    3. Give model tools to manage tasks
    4. No heuristic analysis - model manages tasks via tools
    """

    def __init__(self, enabled: bool = True):
        super().__init__("Todo")
        self.enabled: bool = enabled

    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Initialize todo list if not exists."""
        if not self.enabled:
            return None

        if "todo_list" not in state:
            state["todo_list"] = create_empty_todo_list()
            console.log(f"[{self.name}] Initialized empty todo list")

        return None

    async def after_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Check if all tasks are completed."""
        if not self.enabled:
            return None

        todo_list = state.get("todo_list")
        if not todo_list or not todo_list.get("tasks"):
            return None

        # Check if all tasks are completed
        summary = get_todo_list_summary(todo_list)
        if summary["pending"] == 0 and summary["in_progress"] == 0:
            console.log(f"[{self.name}] All tasks completed!")
            state["_all_tasks_completed"] = True

        return None


class TodoPlannerMiddleware(BaseMiddleware):
    """Middleware that creates todo lists for complex tasks.

    Uses simple heuristic: if user request is long or contains keywords,
    suggest creating a todo list (model decides via todo_create_task).
    """

    def __init__(self, enabled: bool = True):
        super().__init__("TodoPlanner")
        self.enabled: bool = enabled

    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Check if we should suggest creating a todo list."""
        if not self.enabled:
            return None

        # Only suggest if no todo list exists
        todo_list = state.get("todo_list")
        if todo_list and todo_list.get("tasks"):
            return None

        messages = state.get("messages", [])
        if not messages:
            return None

        # Get last user message
        last_user_msg = None
        for msg in reversed(messages):
            if hasattr(msg, 'type') and msg.type in ('human', 'user'):
                content = msg.content
                if isinstance(content, str):
                    last_user_msg = content
                break

        if not last_user_msg:
            return None

        # Simple heuristic: suggest todo list for complex requests
        request_lower = last_user_msg.lower()
        complexity_keywords = [
            "create", "build", "develop", "implement", "design",
            "set up", "configure", "deploy", "migrate", "refactor",
            "write tests", "add feature", "fix bug", "optimize",
            "multiple", "several", "various", "different",
            "step by step", "break down", "plan", "project",
        ]

        word_count = len(request_lower.split())
        keyword_matches = sum(1 for kw in complexity_keywords if kw in request_lower)

        # Suggest todo list if complex
        if word_count >= 30 or keyword_matches >= 2:
            console.log(f"[{self.name}] Complex request detected, model can create todo list")

        return None
