"""Task management system for complex task breakdown."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Annotated, TypedDict, Any
from datetime import datetime


class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    CANCELLED = "cancelled"


class Priority(str, Enum):
    """Task priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Task:
    """Represents a single task in the todo list."""
    content: str
    status: TaskStatus = TaskStatus.PENDING
    priority: Priority = Priority.MEDIUM
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    parent_task_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    notes: str = ""
    dependencies: list[str] = field(default_factory=list)
    subtasks: list[str] = field(default_factory=list)  # IDs of subtasks
    result: Optional[str] = None  # Result/outcome when completed
    
    def to_dict(self) -> dict[str, Any]:
        """Convert task to dictionary for serialization."""
        return {
            "task_id": self.task_id,
            "content": self.content,
            "status": self.status.value,
            "priority": self.priority.value,
            "parent_task_id": self.parent_task_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "notes": self.notes,
            "dependencies": self.dependencies,
            "subtasks": self.subtasks,
            "result": self.result,
        }
    
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Task":
        """Create Task from dictionary."""
        return cls(
            task_id=data.get("task_id", str(uuid.uuid4())),
            content=data["content"],
            status=TaskStatus(data.get("status", "pending")),
            priority=Priority(data.get("priority", "medium")),
            parent_task_id=data.get("parent_task_id"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.utcnow(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.utcnow(),
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
            notes=data.get("notes", ""),
            dependencies=data.get("dependencies", []),
            subtasks=data.get("subtasks", []),
            result=data.get("result"),
        )


class TodoList(TypedDict):
    """Todo list container for the agent state."""
    tasks: list[dict[str, Any]]  # List of task dictionaries
    active_task_id: Optional[str]  # Currently working task
    task_counter: int  # For generating sequential task IDs


def create_empty_todo_list() -> TodoList:
    """Create an empty todo list."""
    return {
        "tasks": [],
        "active_task_id": None,
        "task_counter": 0,
    }


def create_task(
    todo_list: TodoList,
    content: str,
    priority: str = "medium",
    parent_task_id: Optional[str] = None,
    dependencies: list[str] | None = None,
) -> dict[str, Any]:
    """Create a new task and add it to the todo list.
    
    Args:
        todo_list: The current todo list
        content: Task description
        priority: Task priority (low, medium, high, critical)
        parent_task_id: Optional parent task ID for subtasks
        dependencies: Optional list of task IDs this task depends on
    
    Returns:
        The created task dictionary
    """
    task_counter = todo_list["task_counter"] + 1
    
    task = Task(
        content=content,
        priority=Priority(priority),
        parent_task_id=parent_task_id,
        dependencies=dependencies or [],
    )
    
    # If this is a subtask, add to parent's subtasks list
    if parent_task_id:
        for t in todo_list["tasks"]:
            if t["task_id"] == parent_task_id:
                t["subtasks"].append(task.task_id)
                break
    
    new_task = task.to_dict()
    todo_list["tasks"].append(new_task)
    todo_list["task_counter"] = task_counter
    
    return new_task


def update_task_status(
    todo_list: TodoList,
    task_id: str,
    status: str,
    result: str | None = None,
) -> dict[str, Any] | None:
    """Update a task's status.
    
    Args:
        todo_list: The current todo list
        task_id: ID of the task to update
        status: New status (pending, in_progress, completed, blocked, cancelled)
        result: Optional result/outcome when completing
    
    Returns:
        The updated task dictionary or None if not found
    """
    for task in todo_list["tasks"]:
        if task["task_id"] == task_id:
            task["status"] = status
            task["updated_at"] = datetime.utcnow().isoformat()
            
            if status == TaskStatus.COMPLETED.value:
                task["completed_at"] = datetime.utcnow().isoformat()
                task["result"] = result or ""
            
            # If completing a parent task, check if all subtasks are done
            if task.get("subtasks"):
                all_done = all(
                    t["status"] == TaskStatus.COMPLETED.value
                    for t in todo_list["tasks"]
                    if t["task_id"] in task["subtasks"]
                )
                if all_done:
                    # Auto-complete parent when all subtasks done
                    task["status"] = TaskStatus.COMPLETED.value
                    task["completed_at"] = datetime.utcnow().isoformat()
            
            return task
    
    return None


def remove_task(todo_list: TodoList, task_id: str) -> bool:
    """Remove a task from the todo list.
    
    Args:
        todo_list: The current todo list
        task_id: ID of the task to remove
    
    Returns:
        True if task was removed, False if not found
    """
    for i, task in enumerate(todo_list["tasks"]):
        if task["task_id"] == task_id:
            # Remove from parent's subtasks if applicable
            if task.get("parent_task_id"):
                for parent in todo_list["tasks"]:
                    if parent["task_id"] == task["parent_task_id"]:
                        parent["subtasks"].remove(task_id)
                        break
            
            # Remove from dependencies of other tasks
            for other in todo_list["tasks"]:
                if task_id in other.get("dependencies", []):
                    other["dependencies"].remove(task_id)
            
            todo_list["tasks"].pop(i)
            return True
    
    return False


def set_active_task(todo_list: TodoList, task_id: str | None) -> bool:
    """Set the active task (the one currently being worked on).
    
    Args:
        todo_list: The current todo list
        task_id: ID of the task to set as active, or None to clear
    
    Returns:
        True if task was found, False otherwise
    """
    if task_id is None:
        todo_list["active_task_id"] = None
        return True
    
    for task in todo_list["tasks"]:
        if task["task_id"] == task_id:
            todo_list["active_task_id"] = task_id
            return True
    
    return False


def get_task(todo_list: TodoList, task_id: str) -> dict[str, Any] | None:
    """Get a task by ID.
    
    Args:
        todo_list: The current todo list
        task_id: ID of the task to get
    
    Returns:
        The task dictionary or None if not found
    """
    for task in todo_list["tasks"]:
        if task["task_id"] == task_id:
            return task
    return None


def get_tasks_by_status(todo_list: TodoList, status: str) -> list[dict[str, Any]]:
    """Get all tasks with a specific status.
    
    Args:
        todo_list: The current todo list
        status: Status to filter by
    
    Returns:
        with the specified List of tasks status
    """
    return [t for t in todo_list["tasks"] if t["status"] == status]


def get_pending_tasks(todo_list: TodoList) -> list[dict[str, Any]]:
    """Get all pending tasks ordered by priority and creation time."""
    pending = [t for t in todo_list["tasks"] if t["status"] == TaskStatus.PENDING.value]
    priority_order = {Priority.CRITICAL: 0, Priority.HIGH: 1, Priority.MEDIUM: 2, Priority.LOW: 3}
    return sorted(
        pending,
        key=lambda t: (priority_order.get(Priority(t["priority"]), 3), t["created_at"])
    )


def get_next_task(todo_list: TodoList) -> dict[str, Any] | None:
    """Get the next task to work on (highest priority pending task).
    
    Args:
        todo_list: The current todo list
    
    Returns:
        The next task or None if no pending tasks
    """
    pending = get_pending_tasks(todo_list)
    
    # Filter out tasks with unresolved dependencies
    for task in pending:
        deps_resolved = all(
            get_task(todo_list, dep_id) is None or 
            get_task(todo_list, dep_id)["status"] == TaskStatus.COMPLETED.value
            for dep_id in task.get("dependencies", [])
        )
        if deps_resolved:
            return task
    
    return pending[0] if pending else None


def get_todo_list_summary(todo_list: TodoList) -> dict[str, Any]:
    """Get a summary of the todo list status.
    
    Args:
        todo_list: The current todo list
    
    Returns:
        Summary dictionary with counts and percentages
    """
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


def add_subtask(
    todo_list: TodoList,
    parent_task_id: str,
    content: str,
    priority: str = "medium",
) -> dict[str, Any] | None:
    """Add a subtask to a parent task.
    
    Args:
        todo_list: The current todo list
        parent_task_id: ID of the parent task
        content: Subtask description
        priority: Task priority
    
    Returns:
        The created subtask or None if parent not found
    """
    parent = get_task(todo_list, parent_task_id)
    if not parent:
        return None
    
    subtask = create_task(
        todo_list=todo_list,
        content=content,
        priority=priority,
        parent_task_id=parent_task_id,
    )
    
    return subtask


def update_task_notes(todo_list: TodoList, task_id: str, notes: str) -> dict[str, Any] | None:
    """Update a task's notes.
    
    Args:
        todo_list: The current todo list
        task_id: ID of the task to update
        notes: New notes content
    
    Returns:
        The updated task or None if not found
    """
    for task in todo_list["tasks"]:
        if task["task_id"] == task_id:
            task["notes"] = notes
            task["updated_at"] = datetime.utcnow().isoformat()
            return task
    return None
