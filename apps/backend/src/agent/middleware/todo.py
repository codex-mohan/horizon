"""Todo list management middleware for task breakdown and tracking.

This module provides comprehensive todo management including:
- Task complexity detection (LLM/heuristic/auto)
- Todo list creation and tracking
- Feedback loops for task completion
- Dynamic re-planning based on tool results
"""

from __future__ import annotations

from enum import Enum
from typing import Optional, Any, Literal
from pydantic import BaseModel, Field, validator
from datetime import datetime
import json

from agent.middleware.base import BaseMiddleware, console
from agent.state import AgentState
from agent.llm_loader import create_llm
from agent.config import AgentConfig
from agent.todo import (
    Task,
    TaskStatus,
    Priority,
    TodoList,
    create_task,
    update_task_status,
    remove_task,
    set_active_task,
    get_task,
    get_todo_list_summary,
    get_next_task,
    get_pending_tasks,
    create_empty_todo_list,
)


# Complexity detection approach options
class ComplexityApproach(str, Enum):
    """Approach for detecting if a task needs a todo list."""
    LLM = "llm"          # Use LLM to decide
    HEURISTIC = "heuristic"  # Use keyword/word count heuristics
    AUTO = "auto"        # Use LLM but fall back to heuristic on failure


# ============================================================================
# Pydantic Models for Structured LLM Output
# ============================================================================

class TaskBreakdownItem(BaseModel):
    """A single task in the breakdown."""
    content: str = Field(..., description="Clear, concise task description")
    priority: str = Field(
        default="medium",
        description="Task priority level: low, medium, or high"
    )
    estimated_steps: Optional[int] = Field(
        default=None,
        description="Estimated number of steps to complete"
    )
    
    @validator("priority")
    def normalize_priority(cls, v):
        """Normalize priority to one of the valid values."""
        if v is None:
            return "medium"
        v_lower = v.lower().strip()
        if v_lower in ("low", "medium", "high"):
            return v_lower
        # Default to medium if invalid value
        return "medium"


class TaskComplexityResult(BaseModel):
    """Result of task complexity analysis."""
    needs_todo_list: bool = Field(
        ...,
        description="Whether the task requires a todo list"
    )
    reasoning: str = Field(
        ...,
        description="Brief reasoning for the decision"
    )
    suggested_tasks: list[TaskBreakdownItem] = Field(
        default_factory=list,
        description="Suggested task breakdown if todo list is needed"
    )
    active_task_id: Optional[str] = Field(
        default=None,
        description="Recommended task ID to work on first"
    )


class TodoProgressResult(BaseModel):
    """Result of todo progress analysis after tool execution."""
    completed_task_id: Optional[str] = Field(
        default=None,
        description="Task ID that was completed by the tool"
    )
    should_replan: bool = Field(
        default=False,
        description="Whether the todo list needs re-planning"
    )
    next_task_id: Optional[str] = Field(
        default=None,
        description="Next task to work on"
    )
    reasoning: str = Field(
        default="",
        description="Reasoning for the decisions"
    )


# ============================================================================
# Task Complexity Detector
# ============================================================================

class TaskComplexityDetector:
    """Determines if a user request needs a todo list using LLM or heuristics.
    
    This class provides a token-efficient way to analyze if a task is complex
    enough to warrant a todo list. It supports both LLM-based and heuristic
    approaches, with structured Pydantic output for minimal token usage.
    """
    
    # Token-efficient system prompt for complexity detection
    SYSTEM_PROMPT = """You are a task complexity analyzer. Determine if the user's request needs a structured todo list.
    
Output JSON with:
- needs_todo_list: boolean
- reasoning: brief reason (1 sentence)
- suggested_tasks: array of {content, priority} if needed (max 5 tasks)

Keep output minimal. Only suggest tasks if truly complex."""
    
    # Heuristic indicators (kept for fallback)
    COMPLEXITY_KEYWORDS = [
        "create", "build", "develop", "implement", "design",
        "set up", "configure", "deploy", "migrate", "refactor",
        "write tests", "add feature", "fix bug", "optimize",
        "multiple", "several", "various", "different",
        "step by step", "break down", "plan", "project",
    ]
    
    def __init__(
        self,
        approach: ComplexityApproach = ComplexityApproach.AUTO,
        max_tokens: int = 100,
        llm=None,
    ):
        """Initialize the detector.
        
        Args:
            approach: Detection approach (llm, heuristic, or auto)
            max_tokens: Max tokens for LLM response (default 100 for efficiency)
            llm: Optional pre-configured LLM instance
        """
        self.approach = approach
        self.max_tokens = max_tokens
        self._llm = llm
    
    @property
    def llm(self):
        """Lazy-load LLM if not provided."""
        if self._llm is None:
            self._llm = create_llm(temperature=0.1, max_tokens=self.max_tokens)
        return self._llm
    
    async def analyze(
        self,
        user_request: str,
        existing_todo_count: int = 0,
    ) -> TaskComplexityResult:
        """Analyze if the user request needs a todo list.
        
        Args:
            user_request: The user's message/request
            existing_todo_count: Number of existing tasks (to avoid duplication)
        
        Returns:
            TaskComplexityResult with structured analysis
        """
        # Skip if already has tasks
        if existing_todo_count > 0:
            return TaskComplexityResult(
                needs_todo_list=False,
                reasoning="Todo list already exists",
                suggested_tasks=[],
            )
        
        # Use heuristic approach
        if self.approach == ComplexityApproach.HEURISTIC:
            return self._heuristic_analysis(user_request)
        
        # Use LLM approach
        if self.approach in (ComplexityApproach.LLM, ComplexityApproach.AUTO):
            try:
                result = await self._llm_analysis(user_request)
                if result is not None:
                    return result
                
                # Fallback to heuristic if LLM fails (for AUTO mode)
                if self.approach == ComplexityApproach.AUTO:
                    console.log("[TaskComplexityDetector] LLM failed, falling back to heuristic")
                    return self._heuristic_analysis(user_request)
                
                # For LLM mode, return empty result on failure
                return TaskComplexityResult(
                    needs_todo_list=False,
                    reasoning="LLM analysis failed",
                    suggested_tasks=[],
                )
            except Exception as e:
                console.log(f"[TaskComplexityDetector] LLM error: {e}")
                if self.approach == ComplexityApproach.AUTO:
                    return self._heuristic_analysis(user_request)
                return TaskComplexityResult(
                    needs_todo_list=False,
                    reasoning=f"LLM error: {str(e)[:50]}",
                    suggested_tasks=[],
                )
        
        # Default fallback
        return TaskComplexityResult(
            needs_todo_list=False,
            reasoning="Unknown approach",
            suggested_tasks=[],
        )
    
    def _heuristic_analysis(self, user_request: str) -> TaskComplexityResult:
        """Simple heuristic-based analysis."""
        request_lower = user_request.lower()
        word_count = len(request_lower.split())
        
        # Check for complexity keywords
        keyword_matches = sum(
            1 for kw in self.COMPLEXITY_KEYWORDS if kw in request_lower
        )
        
        # Decision logic
        needs_todo = word_count >= 30 or keyword_matches >= 2
        
        if needs_todo:
            # Extract a simple task from the request
            content = user_request.strip()[:150]
            if len(user_request) > 150:
                content += "..."
            
            return TaskComplexityResult(
                needs_todo_list=True,
                reasoning=f"Heuristic: {word_count} words, {keyword_matches} keywords",
                suggested_tasks=[
                    TaskBreakdownItem(
                        content=content,
                        priority="high" if keyword_matches >= 2 else "medium",
                    )
                ],
            )
        
        return TaskComplexityResult(
            needs_todo_list=False,
            reasoning=f"Not complex enough ({word_count} words, {keyword_matches} keywords)",
            suggested_tasks=[],
        )
    
    async def _llm_analysis(self, user_request: str) -> TaskComplexityResult | None:
        """LLM-based analysis with structured output."""
        from langchain_core.messages import HumanMessage
        
        user_message = f"Request: {user_request[:300]}"
        
        response = await self.llm.ainvoke([
            ("system", self.SYSTEM_PROMPT),
            ("human", user_message),
        ])
        
        # Extract content from response (handle both string and list content)
        content = response.content
        if isinstance(content, list):
            # Handle list content (common in newer langchain versions)
            text_parts = []
            for item in content:
                if isinstance(item, dict):
                    text_parts.append(str(item.get('text', '')))
                else:
                    text_parts.append(str(item))
            content = ' '.join(text_parts)
        elif not isinstance(content, str):
            content = str(content)
        
        # Try to extract JSON from response
        try:
            # Handle potential markdown code blocks
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            data = json.loads(content.strip())
            return TaskComplexityResult(**data)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            console.log(f"[TaskComplexityDetector] Failed to parse LLM response: {e}")
            return None


# ============================================================================
# Todo Progress Analyzer (for post-tool execution)
# ============================================================================

class TodoProgressAnalyzer:
    """Analyzes todo progress after tool execution to determine next steps.
    
    This is a key component for the feedback loop that determines:
    - Whether a task was completed
    - If re-planning is needed
    - What the next task should be
    """
    
    SYSTEM_PROMPT = """You are a todo progress analyzer. Given the todo list and recent tool execution results,
determine:
1. Which task was completed (if any)
2. Whether re-planning is needed (e.g., unexpected results, new requirements)
3. What the next task should be

Output JSON with:
- completed_task_id: ID of completed task or null
- should_replan: boolean indicating if re-planning is needed
- next_task_id: ID of next task to work on or null
- reasoning: brief explanation of your analysis

Consider:
- Task completion indicators in tool results
- Dependency relationships between tasks
- Whether the current approach is working"""
    
    def __init__(self, llm=None, max_tokens: int = 150):
        """Initialize the progress analyzer.
        
        Args:
            llm: Optional pre-configured LLM instance
            max_tokens: Max tokens for response
        """
        self.max_tokens = max_tokens
        self._llm = llm
    
    @property
    def llm(self):
        """Lazy-load LLM if not provided."""
        if self._llm is None:
            self._llm = create_llm(temperature=0.1, max_tokens=self.max_tokens)
        return self._llm
    
    async def analyze(
        self,
        todo_list: TodoList,
        tool_name: str,
        tool_result: str,
        last_user_request: str,
    ) -> TodoProgressResult:
        """Analyze todo progress after tool execution.
        
        Args:
            todo_list: Current todo list
            tool_name: Name of the tool that was executed
            tool_result: Result from the tool execution
            last_user_request: Original user request for context
        
        Returns:
            TodoProgressResult with analysis
        """
        # Skip if no todo list
        if not todo_list or not todo_list.get("tasks"):
            return TodoProgressResult(
                should_replan=False,
                reasoning="No todo list exists",
            )
        
        # If no active task, get next one
        active_task_id = todo_list.get("active_task_id")
        if not active_task_id:
            next_task = get_next_task(todo_list)
            if next_task:
                return TodoProgressResult(
                    next_task_id=next_task["task_id"],
                    reasoning="No active task, selecting next pending task",
                )
            # All tasks complete
            return TodoProgressResult(
                completed_task_id=None,
                should_replan=False,
                next_task_id=None,
                reasoning="All tasks completed",
            )
        
        # Check if current task is complete based on tool result
        active_task = get_task(todo_list, active_task_id)
        if not active_task:
            # Active task not found, re-plan
            return TodoProgressResult(
                should_replan=True,
                reasoning="Active task not found in todo list",
            )
        
        # Use LLM to analyze if task is complete
        try:
            result = await self._llm_analyze(
                todo_list, active_task, tool_name, tool_result, last_user_request
            )
            if result:
                return result
        except Exception as e:
            console.log(f"[TodoProgressAnalyzer] LLM error: {e}")
        
        # Fallback to heuristic analysis
        return self._heuristic_analyze(active_task, tool_result)
    
    async def _llm_analyze(
        self,
        todo_list: TodoList,
        active_task: dict[str, Any],
        tool_name: str,
        tool_result: str,
        last_user_request: str,
    ) -> TodoProgressResult | None:
        """LLM-based progress analysis."""
        from langchain_core.messages import HumanMessage
        
        # Build context for LLM
        todo_summary = get_todo_list_summary(todo_list)
        context = f"""
User Request: {last_user_request}

Active Task: {active_task['content']} (ID: {active_task['task_id']})
Task Status: {active_task['status']}

All Tasks:
"""
        for task in todo_list["tasks"]:
            status_icon = "✅" if task["status"] == "completed" else "🔄" if task["status"] == "in_progress" else "⏳"
            context += f"{status_icon} [{task['priority'].upper()}] {task['content']} (ID: {task['task_id']})\n"
        
        context += f"""

Last Tool Executed: {tool_name}
Tool Result: {tool_result[:500]}{'...' if len(tool_result) > 500 else ''}

Analysis:
"""
        
        response = await self.llm.ainvoke([
            ("system", self.SYSTEM_PROMPT),
            ("human", context),
        ])
        
        # Extract content from response (handle both string and list content)
        content = response.content
        if isinstance(content, list):
            # Handle list content (common in newer langchain versions)
            text_parts = []
            for item in content:
                if isinstance(item, dict):
                    text_parts.append(str(item.get('text', '')))
                else:
                    text_parts.append(str(item))
            content = ' '.join(text_parts)
        elif not isinstance(content, str):
            content = str(content)
        
        # Parse JSON
        try:
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            data = json.loads(content.strip())
            return TodoProgressResult(**data)
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            console.log(f"[TodoProgressAnalyzer] Failed to parse LLM response: {e}")
            return None
    
    def _heuristic_analyze(
        self,
        active_task: dict[str, Any],
        tool_result: str,
    ) -> TodoProgressResult:
        """Simple heuristic-based progress analysis."""
        result_lower = tool_result.lower()
        
        # Check for completion indicators
        completion_indicators = [
            "completed", "done", "success", "created", "implemented",
            "finished", "ready", "deployed", "updated", "fixed",
        ]
        
        failure_indicators = [
            "error", "failed", "exception", "cannot", "unable",
            "permission denied", "not found", "invalid",
        ]
        
        completed = any(ind in result_lower for ind in completion_indicators)
        has_error = any(ind in result_lower for ind in failure_indicators)
        
        if has_error:
            return TodoProgressResult(
                should_replan=True,
                next_task_id=active_task["task_id"],
                reasoning=f"Tool execution had errors, may need to retry or re-plan",
            )
        
        if completed:
            return TodoProgressResult(
                completed_task_id=active_task["task_id"],
                should_replan=False,
                reasoning="Tool result indicates task completion",
            )
        
        # No clear indication, assume still in progress
        return TodoProgressResult(
            should_replan=False,
            next_task_id=active_task["task_id"],
            reasoning="No clear completion indicator, continuing with current task",
        )


# ============================================================================
# Todo Middleware
# ============================================================================

class TodoMiddleware(BaseMiddleware):
    """Middleware for managing todo lists and task tracking.
    
    This middleware:
    - Tracks task progress based on user/model messages
    - Provides task summaries to guide the model
    """
    
    def __init__(self, enabled: bool = True):
        super().__init__("Todo")
        self.enabled = enabled
    
    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Process the todo list before model invocation."""
        if not self.enabled:
            return None
        
        # Initialize todo_list if not present
        if "todo_list" not in state:
            state["todo_list"] = create_empty_todo_list()
            console.log(f"[{self.name}] Initialized empty todo list")
            return None
        
        todo_list = state["todo_list"]
        messages = state.get("messages", [])
        
        # Analyze user message for progress updates
        if messages and todo_list["tasks"]:
            last_user_msg = self._get_last_user_message(messages)
            if last_user_msg:
                updated = self._analyze_progress(todo_list, last_user_msg)
                if updated:
                    console.log(f"[{self.name}] Updated task progress based on user message")
                    return {"todo_list": todo_list}
        
        return None
    
    async def after_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Process the todo list after model invocation."""
        if not self.enabled:
            return None
        
        if "todo_list" not in state:
            return None
        
        todo_list = state["todo_list"]
        messages = state.get("messages", [])
        
        if messages:
            last_assistant_msg = self._get_last_assistant_message(messages)
            if last_assistant_msg:
                updated = self._analyze_model_response(todo_list, last_assistant_msg)
                if updated:
                    console.log(f"[{self.name}] Updated tasks based on model response")
                    return {"todo_list": todo_list}
        
        return None
    
    def _get_last_user_message(self, messages) -> Optional[str]:
        """Extract the content of the last user message."""
        for msg in reversed(messages):
            if hasattr(msg, 'content') and hasattr(msg, 'type'):
                if msg.type in ('human', 'user'):
                    return msg.content if isinstance(msg.content, str) else ""
        return None
    
    def _get_last_assistant_message(self, messages) -> Optional[str]:
        """Extract the content of the last assistant message."""
        for msg in reversed(messages):
            if hasattr(msg, 'content') and hasattr(msg, 'type'):
                if msg.type in ('ai', 'assistant'):
                    return msg.content if isinstance(msg.content, str) else ""
        return None
    
    def _analyze_progress(self, todo_list: TodoList, message: str) -> bool:
        """Analyze user message for task progress indicators."""
        message_lower = message.lower()
        updated = False
        
        progress_indicators = {
            TaskStatus.COMPLETED: ["completed", "done", "finished", "ready", "implemented"],
            TaskStatus.IN_PROGRESS: ["working on", "currently", "in progress", "started"],
            TaskStatus.BLOCKED: ["blocked", "waiting", "pending", "depend"],
        }
        
        for task in todo_list["tasks"]:
            task_content_lower = task["content"].lower()
            
            for status, indicators in progress_indicators.items():
                for indicator in indicators:
                    if indicator in message_lower:
                        if any(word in task_content_lower for word in message_lower.split()[:10]):
                            if task["status"] != status.value:
                                update_task_status(todo_list, task["task_id"], status.value)
                                updated = True
                                break
        
        return updated
    
    def _analyze_model_response(self, todo_list: TodoList, message: str) -> bool:
        """Analyze model response for task updates."""
        message_lower = message.lower()
        updated = False
        
        if todo_list["active_task_id"]:
            active_task = get_task(todo_list, todo_list["active_task_id"])
            if active_task and active_task["status"] == TaskStatus.IN_PROGRESS.value:
                if any(word in message_lower for word in ["done", "completed", "finished", "ready"]):
                    update_task_status(todo_list, todo_list["active_task_id"], TaskStatus.COMPLETED.value)
                    updated = True
        
        return updated


# ============================================================================
# Todo Planner Middleware
# ============================================================================

class TodoPlannerMiddleware(BaseMiddleware):
    """Middleware that creates todo lists for complex tasks.
    
    Uses an LLM-based detector to decide if a task needs a todo list,
    with configurable approach (LLM, heuristic, or auto).
    Also supports dynamic re-planning via after_model hook.
    """
    
    def __init__(
        self,
        enabled: bool = True,
        approach: ComplexityApproach = ComplexityApproach.AUTO,
        complexity_detector: TaskComplexityDetector | None = None,
        progress_analyzer: TodoProgressAnalyzer | None = None,
    ):
        super().__init__("TodoPlanner")
        self.enabled = enabled
        self.approach = approach
        self._detector = complexity_detector
        self._analyzer = progress_analyzer
    
    @property
    def detector(self) -> TaskComplexityDetector:
        """Get or create the complexity detector."""
        if self._detector is None:
            self._detector = TaskComplexityDetector(
                approach=self.approach,
                max_tokens=100,  # Token-efficient
            )
        return self._detector
    
    @property
    def analyzer(self) -> TodoProgressAnalyzer:
        """Get or create the progress analyzer."""
        if self._analyzer is None:
            self._analyzer = TodoProgressAnalyzer(
                max_tokens=150,
            )
        return self._analyzer
    
    async def before_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Analyze user request and create todo list if needed."""
        if not self.enabled:
            return None
        
        # Skip if todo list already exists with tasks
        if state.get("todo_list", {}).get("tasks"):
            return None
        
        messages = state.get("messages", [])
        if not messages:
            return None
        
        last_user_msg = self._get_last_user_message(messages)
        if not last_user_msg:
            return None
        
        todo_list = state.get("todo_list", create_empty_todo_list())
        existing_count = len(todo_list.get("tasks", []))
        
        # Analyze complexity
        result = await self.detector.analyze(last_user_msg, existing_count)
        
        if result.needs_todo_list and result.suggested_tasks:
            console.log(f"[{self.name}] {result.reasoning}, creating todo list")
            
            # Create todo list from LLM suggestions
            for task_item in result.suggested_tasks:
                create_task(
                    todo_list=todo_list,
                    content=task_item.content,
                    priority=task_item.priority,
                )
            
            console.log(f"[{self.name}] Created {len(result.suggested_tasks)} tasks")
            
            # Set active task if specified
            if result.active_task_id:
                set_active_task(todo_list, result.active_task_id)
            else:
                # Auto-set first pending task as active
                next_task = get_next_task(todo_list)
                if next_task:
                    set_active_task(todo_list, next_task["task_id"])
            
            # Update state with new todo list
            if "todo_list" not in state:
                state["todo_list"] = todo_list
            
            return {"todo_list": todo_list}
        
        console.log(f"[{self.name}] {result.reasoning}")
        return None
    
    async def after_model(self, state: AgentState) -> Optional[dict[str, Any]]:
        """Update todo list after model response and set active task."""
        if not self.enabled:
            return None
        
        todo_list = state.get("todo_list")
        if not todo_list or not todo_list.get("tasks"):
            return None
        
        messages = state.get("messages", [])
        if not messages:
            return None
        
        # Ensure active task is set
        if not todo_list.get("active_task_id"):
            next_task = get_next_task(todo_list)
            if next_task:
                set_active_task(todo_list, next_task["task_id"])
                console.log(f"[{self.name}] Set active task: {next_task['content'][:50]}...")
                return {"todo_list": todo_list}
        
        return None
    
    def _get_last_user_message(self, messages) -> Optional[str]:
        """Extract the content of the last user message."""
        for msg in reversed(messages):
            if hasattr(msg, 'content') and hasattr(msg, 'type'):
                if msg.type in ('human', 'user'):
                    content = msg.content
                    if isinstance(content, str):
                        return content
                    elif isinstance(content, list):
                        text_parts = [
                            p.get('text', '') for p in content
                            if isinstance(p, dict) and p.get('type') == 'text'
                        ]
                        return ' '.join(text_parts)
        return None


# ============================================================================
# Todo Progress Middleware (for post-tool execution)
# ============================================================================

class TodoProgressMiddleware(BaseMiddleware):
    """Middleware that analyzes todo progress after tool execution.
    
    This is a key component for the feedback loop that:
    - Analyzes tool results to determine task completion
    - Updates task status based on execution results
    - Determines if re-planning is needed
    - Sets the next active task
    """
    
    def __init__(
        self,
        enabled: bool = True,
        progress_analyzer: TodoProgressAnalyzer | None = None,
    ):
        super().__init__("TodoProgress")
        self.enabled = enabled
        self._analyzer = progress_analyzer
    
    @property
    def analyzer(self) -> TodoProgressAnalyzer:
        """Get or create the progress analyzer."""
        if self._analyzer is None:
            self._analyzer = TodoProgressAnalyzer(max_tokens=150)
        return self._analyzer
    
    async def __call__(self, state: AgentState) -> dict[str, Any]:
        """Analyze tool results and update todo list accordingly.
        
        This is the key method for the feedback loop that determines:
        1. Which task was completed (if any)
        2. If re-planning is needed
        3. What the next task should be
        """
        if not self.enabled:
            return {}
        
        todo_list = state.get("todo_list")
        if not todo_list or not todo_list.get("tasks"):
            return {}
        
        # Get last tool execution info
        tool_info = self._get_last_tool_execution(state)
        if not tool_info:
            console.log(f"[{self.name}] No tool execution found")
            return {}
        
        tool_name, tool_result = tool_info
        
        # Get last user request for context
        messages = state.get("messages", [])
        last_user_msg = self._get_last_user_message(messages)
        
        # Analyze progress
        result = await self.analyzer.analyze(
            todo_list=todo_list,
            tool_name=tool_name,
            tool_result=tool_result,
            last_user_request=last_user_msg or "",
        )
        
        console.log(f"[{self.name}] {result.reasoning}")
        
        updates = {}
        
        # Mark completed task
        if result.completed_task_id:
            update_task_status(todo_list, result.completed_task_id, TaskStatus.COMPLETED.value)
            console.log(f"[{self.name}] Task completed: {result.completed_task_id}")
            updates["todo_list"] = todo_list
        
        # Handle re-planning
        if result.should_replan:
            # Clear active task to trigger re-planning
            set_active_task(todo_list, None)
            console.log(f"[{self.name}] Re-planning triggered")
            updates["todo_list"] = todo_list
            # Set a flag for re-planning
            state["_needs_todo_replan"] = True
            updates["_needs_todo_replan"] = True
        
        # Set next active task
        if result.next_task_id:
            set_active_task(todo_list, result.next_task_id)
            console.log(f"[{self.name}] Next task: {result.next_task_id}")
            updates["todo_list"] = todo_list
        
        # Check if all tasks are complete
        summary = get_todo_list_summary(todo_list)
        if summary["pending"] == 0 and summary["in_progress"] == 0:
            console.log(f"[{self.name}] All tasks completed!")
        
        return updates
    
    def _get_last_tool_execution(self, state: AgentState) -> Optional[tuple[str, str]]:
        """Get the last tool name and result from state."""
        messages = state.get("messages", [])
        
        # Look for tool result messages
        for msg in reversed(messages):
            if hasattr(msg, 'type') and msg.type == 'tool':
                tool_name = getattr(msg, 'name', 'unknown')
                content = msg.content
                if isinstance(content, str):
                    return (tool_name, content)
                elif isinstance(content, list):
                    # Handle list content (common in langchain)
                    text_parts = []
                    for item in content:
                        if isinstance(item, dict):
                            text_parts.append(str(item.get('text', '')))
                        else:
                            text_parts.append(str(item))
                    return (tool_name, ' '.join(text_parts))
                else:
                    return (tool_name, str(content))
        
        # Check for tool_calls in last assistant message
        if messages:
            last_msg = messages[-1]
            if hasattr(last_msg, 'tool_calls') and last_msg.tool_calls:
                # Return the tool that was called (we don't have result yet)
                tool_call = last_msg.tool_calls[0]
                return (tool_call.get('name', 'unknown'), "Tool was called")
        
        return None
    
    def _get_last_user_message(self, messages) -> Optional[str]:
        """Extract the content of the last user message."""
        for msg in reversed(messages):
            if hasattr(msg, 'content') and hasattr(msg, 'type'):
                if msg.type in ('human', 'user'):
                    content = msg.content
                    if isinstance(content, str):
                        return content
                    elif isinstance(content, list):
                        text_parts = [
                            p.get('text', '') for p in content
                            if isinstance(p, dict) and p.get('type') == 'text'
                        ]
                        return ' '.join(text_parts)
        return None


# ============================================================================
# Todo Checker Middleware (for routing decisions)
# ============================================================================

class TodoCheckerMiddleware(BaseMiddleware):
    """Middleware that checks todo status and determines routing.
    
    This middleware is called after todo_progress to decide:
    1. If re-planning is needed (go to todo_planner)
    2. If we should continue with the model (go to model)
    """
    
    def __init__(self, enabled: bool = True):
        super().__init__("TodoChecker")
        self.enabled = enabled
    
    async def __call__(self, state: AgentState) -> dict[str, Any]:
        """Check todo status and return routing decision.
        
        Returns:
            dict with routing decision:
            - _todo_route: "todo_planner" or "model"
        """
        if not self.enabled:
            return {"_todo_route": "model"}
        
        todo_list = state.get("todo_list")
        if not todo_list or not todo_list.get("tasks"):
            return {"_todo_route": "model"}
        
        # Check if re-planning was triggered
        if state.get("_needs_todo_replan"):
            console.log(f"[{self.name}] Re-planning needed, routing to todo_planner")
            # Clear the flag
            state["_needs_todo_replan"] = False
            return {"_todo_route": "todo_planner", "_needs_todo_replan": False}
        
        # Check if all tasks are completed
        summary = get_todo_list_summary(todo_list)
        if summary["pending"] == 0 and summary["in_progress"] == 0:
            console.log(f"[{self.name}] All tasks completed, routing to model")
            return {"_todo_route": "model"}
        
        # Check if we need to set active task
        if not todo_list.get("active_task_id"):
            next_task = get_next_task(todo_list)
            if next_task:
                set_active_task(todo_list, next_task["task_id"])
                console.log(f"[{self.name}] Set active task: {next_task['content'][:50]}...")
                return {"_todo_route": "model", "todo_list": todo_list}
        
        # Continue with model
        return {"_todo_route": "model"}


# ============================================================================
# Utility Functions
# ============================================================================

def create_todo_summary(todo_list: TodoList) -> str:
    """Create a human-readable summary of the todo list."""
    summary = get_todo_list_summary(todo_list)
    
    lines = [
        "## Todo List Summary",
        f"**Progress**: {summary['completion_percentage']:.1f}% complete",
        f"**Total Tasks**: {summary['total']}",
        f"**Completed**: {summary['completed']}",
        f"**In Progress**: {summary['in_progress']}",
        f"**Pending**: {summary['pending']}",
        f"**Blocked**: {summary['blocked']}",
        "",
        "### Tasks",
    ]
    
    status_icons = {
        "pending": "⏳",
        "in_progress": "🔄",
        "completed": "✅",
        "blocked": "🚫",
        "cancelled": "❌",
    }
    
    for task in todo_list["tasks"]:
        icon = status_icons.get(task["status"], "📋")
        priority = task.get("priority", "medium").upper()
        lines.append(f"{icon} **[{priority}]** {task['content']}")
        
        if task.get("subtasks"):
            for subtask_id in task["subtasks"]:
                subtask = get_task(todo_list, subtask_id)
                if subtask:
                    sub_icon = status_icons.get(subtask["status"], "📋")
                    lines.append(f"    {sub_icon} {subtask['content']}")
    
    return "\n".join(lines)
