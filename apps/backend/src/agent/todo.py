"""Task management tools for the agent."""

from __future__ import annotations

import uuid
from enum import Enum
from typing import Optional, TypedDict, Any
from datetime import datetime


class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class TodoList(TypedDict):
    """Todo list container for the agent state."""
    tasks: list[dict[str, Any]]
    active_task_id: Optional[str]


def create_empty_todo_list() -> TodoList:
    """Create an empty todo list."""
    return {
        "tasks": [],
        "active_task_id": None,
    }


def create_task(
    todo_list: TodoList,
    content: str,
    priority: str = "medium",
    parent_task_id: Optional[str] = None,
) -> dict[str, Any]:
    """Create a new task and add it to the todo list."""
    task = {
        "task_id": str(uuid.uuid4()),
        "content": content,
        "status": TaskStatus.PENDING.value,
        "priority": priority,
        "parent_task_id": parent_task_id,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "notes": "",
        "subtasks": [],
        "result": None,
    }

    # If this is a subtask, add to parent's subtasks list
    if parent_task_id:
        for t in todo_list["tasks"]:
            if t["task_id"] == parent_task_id:
                t["subtasks"].append(task["task_id"])
                break

    todo_list["tasks"].append(task)
    return task


def update_task_status(
    todo_list: TodoList,
    task_id: str,
    status: str,
    result: str | None = None,
) -> dict[str, Any] | None:
    """Update a task's status."""
    for task in todo_list["tasks"]:
        if task["task_id"] == task_id:
            task["status"] = status
            task["updated_at"] = datetime.utcnow().isoformat()

            if status == TaskStatus.COMPLETED.value:
                task["completed_at"] = datetime.utcnow().isoformat()
                task["result"] = result or ""

            return task

    return None


def set_active_task(todo_list: TodoList, task_id: str | None) -> bool:
    """Set the active task (the one currently being worked on)."""
    if task_id is None:
        todo_list["active_task_id"] = None
        return True

    for task in todo_list["tasks"]:
        if task["task_id"] == task_id:
            todo_list["active_task_id"] = task_id
            return True

    return False


def get_task(todo_list: TodoList, task_id: str) -> dict[str, Any] | None:
    """Get a task by ID."""
    for task in todo_list["tasks"]:
        if task["task_id"] == task_id:
            return task
    return None


def get_pending_tasks(todo_list: TodoList) -> list[dict[str, Any]]:
    """Get all pending tasks ordered by creation time."""
    return [t for t in todo_list["tasks"] if t["status"] == TaskStatus.PENDING.value]


def get_next_task(todo_list: TodoList) -> dict[str, Any] | None:
    """Get the next task to work on (first pending task)."""
    pending = get_pending_tasks(todo_list)
    return pending[0] if pending else None


def get_todo_list_summary(todo_list: TodoList) -> dict[str, Any]:
    """Get a summary of the todo list status."""
    tasks = todo_list["tasks"]
    total = len(tasks)
    completed = len([t for t in tasks if t["status"] == TaskStatus.COMPLETED.value])
    in_progress = len([t for t in tasks if t["status"] == TaskStatus.IN_PROGRESS.value])
    pending = len([t for t in tasks if t["status"] == TaskStatus.PENDING.value])
    blocked = len([t for t in tasks if t["status"] == TaskStatus.BLOCKED.value])

    return {
        "total": total,
        "completed": completed,
        "in_progress": in_progress,
        "pending": pending,
        "blocked": blocked,
        "completion_percentage": round((completed / total * 100), 2) if total > 0 else 0,
        "active_task_id": todo_list["active_task_id"],
    }
