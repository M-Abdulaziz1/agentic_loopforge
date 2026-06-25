# Core Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first testable LoopForge backend foundation for goal clarity, generated loop specs, permissioned tools, context packing, and evented run execution.

**Architecture:** Start with a Python package under `api/loopforge` using focused modules and deterministic fake providers. The first slice uses in-memory storage and fake LLM/sandbox implementations so behavior is testable before adding databases, Celery, Docker/gVisor, and the web UI. FastAPI exposes the same resource shape that future persistence and workers will use.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pytest, httpx TestClient, stdlib protocols/dataclasses.

---

## Scope Split

The approved design covers backend runtime, sandboxing, tools, context management, local LLM integration, frontend, infrastructure, and security harnesses. This first plan implements the core backend contracts and an in-process API. Follow-up plans should cover the React UI, durable Postgres persistence, Celery worker, Docker/gVisor sandbox provider, OpenAI-compatible LLM provider, online tools, and Docker compose.

## File Structure

- Create `pyproject.toml`: Python project metadata, dependencies, pytest config.
- Create `api/loopforge/__init__.py`: package marker and version.
- Create `api/loopforge/domain.py`: enums and Pydantic models for goals, clarification, loop specs, runs, events, context, tools, and gates.
- Create `api/loopforge/context.py`: token estimation, context ledger, retrieval, context packing, and compaction.
- Create `api/loopforge/providers.py`: `LLMProvider`, `SandboxProvider`, deterministic fake providers.
- Create `api/loopforge/tools.py`: tool registry, runtime modes, and permission checks.
- Create `api/loopforge/planner.py`: clarity checker, clarification question generation, loop-spec generation.
- Create `api/loopforge/runner.py`: approved loop execution, budget checks, event emission, improvement/finalization behavior.
- Create `api/loopforge/store.py`: in-memory repository used by tests and API.
- Create `api/loopforge/app.py`: FastAPI app factory and endpoints.
- Create `tests/conftest.py`: shared pytest fixtures.
- Create `tests/test_smoke.py`: package import smoke test.
- Create `tests/test_context.py`: context manager behavior.
- Create `tests/test_tools.py`: tool permission behavior.
- Create `tests/test_planner.py`: clarity and loop-spec generation behavior.
- Create `tests/test_runner.py`: run lifecycle and event behavior.
- Create `tests/test_api.py`: end-to-end API behavior.

## Task 1: Project Scaffold

**Files:**
- Create: `pyproject.toml`
- Create: `api/loopforge/__init__.py`
- Create: `tests/conftest.py`
- Create: `tests/test_smoke.py`

- [ ] **Step 1: Write the initial pytest fixture file**

Create `tests/conftest.py`:

```python
import pytest


@pytest.fixture
def clear_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LOOPFORGE_LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LOOPFORGE_LLM_API_KEY", raising=False)
```

- [ ] **Step 2: Add project metadata and test configuration**

Create `pyproject.toml`:

```toml
[project]
name = "loopforge"
version = "0.1.0"
description = "Generic agent-loop creation and management platform"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115,<1.0",
  "pydantic>=2.8,<3.0",
  "uvicorn>=0.30,<1.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.2,<9.0",
  "httpx>=0.27,<1.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["."]
addopts = "-q"
```

- [ ] **Step 3: Add package marker**

Create `api/loopforge/__init__.py`:

```python
__version__ = "0.1.0"
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
python3 -m venv .venv
```

Expected: `.venv` exists in the project root.

- [ ] **Step 5: Install dependencies**

Run:

```bash
./.venv/bin/python -m pip install -e ".[dev]"
```

Expected: dependencies install successfully.

- [ ] **Step 6: Add package import smoke test**

Create `tests/test_smoke.py`:

```python
import api.loopforge


def test_package_imports() -> None:
    assert api.loopforge.__version__ == "0.1.0"
```

- [ ] **Step 7: Run pytest smoke check**

Run:

```bash
./.venv/bin/python -m pytest
```

Expected: PASS with one smoke test.

- [ ] **Step 8: Commit**

```bash
git add pyproject.toml api/loopforge/__init__.py tests/conftest.py tests/test_smoke.py
git commit -m "chore: scaffold backend package"
```

## Task 2: Domain Models

**Files:**
- Create: `api/loopforge/domain.py`
- Create: `tests/test_domain.py`

- [ ] **Step 1: Write failing domain model tests**

Create `tests/test_domain.py`:

```python
from api.loopforge.domain import (
    Budget,
    GoalCreate,
    GoalMode,
    GoalToggles,
    LoopSpec,
    LoopSpecAgent,
    RunStatus,
    ToolPermission,
)


def test_goal_create_defaults_to_offline_local() -> None:
    goal = GoalCreate(text="Research competitors and draft a launch plan")

    assert goal.mode == GoalMode.OFFLINE_LOCAL
    assert goal.toggles.internet is False
    assert goal.toggles.code_sandbox is True
    assert goal.budget.max_steps == 12


def test_loop_spec_records_agents_tools_and_success_criteria() -> None:
    spec = LoopSpec(
        goal_id="goal_1",
        version=1,
        agents=[
            LoopSpecAgent(
                name="Planner",
                role="Break down the goal",
                system_prompt="Create a plan and delegate work.",
                tools=["local_workspace"],
            )
        ],
        tool_permissions=[
            ToolPermission(tool_name="local_workspace", enabled=True, reason="Store artifacts")
        ],
        handoffs=[{"from": "Planner", "to": "Executor", "condition": "plan approved"}],
        success_criteria=["User receives an actionable plan"],
        failure_criteria=["Goal remains unclear"],
        gates=["before_run"],
        context_policy={"max_context_tokens": 4000},
        improvement_strategy="Review failed steps and revise prompts within budget.",
    )

    assert spec.status == "draft"
    assert spec.agents[0].name == "Planner"
    assert spec.tool_permissions[0].enabled is True


def test_run_status_includes_context_overflow() -> None:
    assert RunStatus.CONTEXT_OVERFLOW.value == "context_overflow"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_domain.py -q
```

Expected: FAIL with `ModuleNotFoundError` or missing names from `api.loopforge.domain`.

- [ ] **Step 3: Implement domain models**

Create `api/loopforge/domain.py`:

```python
from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class GoalMode(StrEnum):
    OFFLINE_LOCAL = "offline_local"
    ONLINE_ENABLED = "online_enabled"


class RunStatus(StrEnum):
    COMPLETED = "completed"
    NEEDS_CLARIFICATION = "needs_clarification"
    BLOCKED = "blocked"
    BUDGET_EXHAUSTED = "budget_exhausted"
    FAILED = "failed"
    CANCELLED = "cancelled"
    UNSAFE_REQUEST = "unsafe_request"
    CONTEXT_OVERFLOW = "context_overflow"
    RUNNING = "running"
    PENDING_APPROVAL = "pending_approval"


class GateStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class GoalToggles(BaseModel):
    internet: bool = False
    code_sandbox: bool = True
    local_connectors: bool = True


class Budget(BaseModel):
    max_steps: int = Field(default=12, ge=1)
    max_llm_calls: int = Field(default=20, ge=0)
    max_context_tokens: int = Field(default=8000, ge=512)


class GoalCreate(BaseModel):
    text: str = Field(min_length=3)
    mode: GoalMode = GoalMode.OFFLINE_LOCAL
    toggles: GoalToggles = Field(default_factory=GoalToggles)
    constraints: dict[str, Any] = Field(default_factory=dict)
    budget: Budget = Field(default_factory=Budget)


class Goal(GoalCreate):
    id: str = Field(default_factory=lambda: new_id("goal"))
    status: RunStatus = RunStatus.NEEDS_CLARIFICATION
    created_at: datetime = Field(default_factory=now_utc)


class ClarificationQuestion(BaseModel):
    id: str = Field(default_factory=lambda: new_id("question"))
    question: str
    missing_requirement: str


class ClarificationSession(BaseModel):
    id: str = Field(default_factory=lambda: new_id("clarification"))
    goal_id: str
    questions: list[ClarificationQuestion] = Field(default_factory=list)
    answers: list[dict[str, str]] = Field(default_factory=list)
    missing_requirements: list[str] = Field(default_factory=list)
    clarity_score: float = Field(default=0.0, ge=0.0, le=1.0)


class ToolPermission(BaseModel):
    tool_name: str
    enabled: bool
    reason: str


class LoopSpecAgent(BaseModel):
    name: str
    role: str
    system_prompt: str
    tools: list[str] = Field(default_factory=list)


class LoopSpec(BaseModel):
    id: str = Field(default_factory=lambda: new_id("spec"))
    goal_id: str
    version: int = Field(ge=1)
    agents: list[LoopSpecAgent]
    tool_permissions: list[ToolPermission] = Field(default_factory=list)
    handoffs: list[dict[str, str]]
    success_criteria: list[str]
    failure_criteria: list[str]
    gates: list[str]
    context_policy: dict[str, Any]
    improvement_strategy: str
    status: Literal["draft", "approved", "rejected"] = "draft"
    created_at: datetime = Field(default_factory=now_utc)


class Run(BaseModel):
    id: str = Field(default_factory=lambda: new_id("run"))
    goal_id: str
    loop_spec_id: str
    status: RunStatus = RunStatus.PENDING_APPROVAL
    spent_steps: int = 0
    spent_llm_calls: int = 0
    result_summary: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None


class RunEvent(BaseModel):
    id: str = Field(default_factory=lambda: new_id("event"))
    run_id: str
    seq: int
    type: str
    message: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=now_utc)


class ContextEntry(BaseModel):
    id: str = Field(default_factory=lambda: new_id("ctx"))
    run_id: str
    kind: str
    text: str
    tags: list[str] = Field(default_factory=list)
    source_event_id: str | None = None
    token_count: int = 0
    created_at: datetime = Field(default_factory=now_utc)


class ContextPack(BaseModel):
    entries: list[ContextEntry]
    summary: str
    token_count: int
    overflow: bool = False


class Gate(BaseModel):
    id: str = Field(default_factory=lambda: new_id("gate"))
    run_id: str
    gate_type: str
    status: GateStatus = GateStatus.PENDING
    context: dict[str, Any] = Field(default_factory=dict)
    note: str | None = None
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./.venv/bin/python -m pytest tests/test_domain.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/loopforge/domain.py tests/test_domain.py
git commit -m "feat: add core domain models"
```

## Task 3: Context Manager

**Files:**
- Create: `api/loopforge/context.py`
- Create: `tests/test_context.py`

- [ ] **Step 1: Write failing context tests**

Create `tests/test_context.py`:

```python
from api.loopforge.context import ContextManager, estimate_tokens
from api.loopforge.domain import ContextEntry, RunStatus


def test_estimate_tokens_uses_conservative_word_based_fallback() -> None:
    assert estimate_tokens("one two three four") == 6


def test_context_pack_prefers_recent_and_tagged_entries() -> None:
    manager = ContextManager(max_tokens=20)
    entries = [
        ContextEntry(run_id="run_1", kind="message", text="old planning note", tags=["plan"]),
        ContextEntry(run_id="run_1", kind="artifact", text="important result details", tags=["result"]),
        ContextEntry(run_id="run_1", kind="message", text="latest executor update", tags=["execution"]),
    ]

    pack = manager.build_pack(entries, task="summarize result", required_tags=["result"])

    assert pack.overflow is False
    assert "important result details" in [entry.text for entry in pack.entries]
    assert pack.token_count <= 20


def test_context_pack_overflows_when_required_entry_cannot_fit() -> None:
    manager = ContextManager(max_tokens=3)
    entries = [
        ContextEntry(run_id="run_1", kind="artifact", text="critical requirement cannot fit", tags=["required"])
    ]

    pack = manager.build_pack(entries, task="use requirement", required_tags=["required"])

    assert pack.overflow is True
    assert pack.summary == RunStatus.CONTEXT_OVERFLOW.value
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_context.py -q
```

Expected: FAIL with `ModuleNotFoundError` or missing `ContextManager`.

- [ ] **Step 3: Implement context manager**

Create `api/loopforge/context.py`:

```python
from __future__ import annotations

from collections.abc import Iterable

from api.loopforge.domain import ContextEntry, ContextPack, RunStatus


def estimate_tokens(text: str) -> int:
    words = [word for word in text.replace("\n", " ").split(" ") if word]
    return max(1, int(len(words) * 1.5))


class ContextManager:
    def __init__(self, max_tokens: int) -> None:
        self.max_tokens = max_tokens

    def build_pack(
        self,
        entries: Iterable[ContextEntry],
        task: str,
        required_tags: list[str] | None = None,
    ) -> ContextPack:
        required_tags = required_tags or []
        prepared = [self._with_tokens(entry) for entry in entries]
        required = [
            entry
            for entry in prepared
            if any(tag in entry.tags for tag in required_tags)
        ]
        selected: list[ContextEntry] = []
        used = estimate_tokens(task)

        for entry in required:
            if used + entry.token_count > self.max_tokens:
                return ContextPack(entries=[], summary=RunStatus.CONTEXT_OVERFLOW.value, token_count=used, overflow=True)
            selected.append(entry)
            used += entry.token_count

        for entry in reversed(prepared):
            if entry in selected:
                continue
            if used + entry.token_count <= self.max_tokens:
                selected.append(entry)
                used += entry.token_count

        selected.reverse()
        summary = self.compact([entry for entry in prepared if entry not in selected])
        return ContextPack(entries=selected, summary=summary, token_count=used, overflow=False)

    def compact(self, entries: Iterable[ContextEntry]) -> str:
        items = list(entries)
        if not items:
            return ""
        decisions = [entry.text for entry in items if "decision" in entry.tags]
        if decisions:
            return "Compacted decisions: " + " | ".join(decisions)
        return f"Compacted {len(items)} older context entries."

    def _with_tokens(self, entry: ContextEntry) -> ContextEntry:
        if entry.token_count > 0:
            return entry
        return entry.model_copy(update={"token_count": estimate_tokens(entry.text)})
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./.venv/bin/python -m pytest tests/test_context.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/loopforge/context.py tests/test_context.py
git commit -m "feat: add context manager"
```

## Task 4: Tool Registry and Permissions

**Files:**
- Create: `api/loopforge/tools.py`
- Create: `tests/test_tools.py`

- [ ] **Step 1: Write failing tool permission tests**

Create `tests/test_tools.py`:

```python
import pytest

from api.loopforge.domain import GoalMode, GoalToggles
from api.loopforge.tools import ToolRegistry, ToolSpec, ToolUnavailableError


def test_offline_mode_blocks_internet_tool() -> None:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="web_search", requires_internet=True))

    with pytest.raises(ToolUnavailableError, match="internet"):
        registry.require_available(
            "web_search",
            mode=GoalMode.OFFLINE_LOCAL,
            toggles=GoalToggles(internet=False),
            allowed_tools=["web_search"],
        )


def test_goal_toggle_allows_online_tool_when_spec_allows_it() -> None:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="web_search", requires_internet=True))

    tool = registry.require_available(
        "web_search",
        mode=GoalMode.ONLINE_ENABLED,
        toggles=GoalToggles(internet=True),
        allowed_tools=["web_search"],
    )

    assert tool.name == "web_search"


def test_loop_spec_allowlist_blocks_unlisted_tool() -> None:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="code_sandbox", requires_sandbox=True))

    with pytest.raises(ToolUnavailableError, match="not allowed"):
        registry.require_available(
            "code_sandbox",
            mode=GoalMode.OFFLINE_LOCAL,
            toggles=GoalToggles(code_sandbox=True),
            allowed_tools=[],
        )
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_tools.py -q
```

Expected: FAIL with missing `api.loopforge.tools`.

- [ ] **Step 3: Implement tool registry**

Create `api/loopforge/tools.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

from api.loopforge.domain import GoalMode, GoalToggles


class ToolUnavailableError(ValueError):
    pass


@dataclass(frozen=True)
class ToolSpec:
    name: str
    requires_internet: bool = False
    requires_sandbox: bool = False
    description: str = ""


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolSpec] = {}

    def register(self, tool: ToolSpec) -> None:
        self._tools[tool.name] = tool

    def require_available(
        self,
        name: str,
        *,
        mode: GoalMode,
        toggles: GoalToggles,
        allowed_tools: list[str],
    ) -> ToolSpec:
        if name not in self._tools:
            raise ToolUnavailableError(f"Tool {name} is not registered")
        if name not in allowed_tools:
            raise ToolUnavailableError(f"Tool {name} is not allowed by the loop spec")

        tool = self._tools[name]
        if tool.requires_internet and (mode != GoalMode.ONLINE_ENABLED or not toggles.internet):
            raise ToolUnavailableError(f"Tool {name} requires internet access")
        if tool.requires_sandbox and not toggles.code_sandbox:
            raise ToolUnavailableError(f"Tool {name} requires code sandbox access")
        return tool


def default_tool_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(ToolSpec(name="local_workspace", description="Read and write managed workspace files"))
    registry.register(ToolSpec(name="code_sandbox", requires_sandbox=True, description="Run code in gVisor sandbox"))
    registry.register(ToolSpec(name="web_search", requires_internet=True, description="Search the web when enabled"))
    return registry
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./.venv/bin/python -m pytest tests/test_tools.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/loopforge/tools.py tests/test_tools.py
git commit -m "feat: add permissioned tool registry"
```

## Task 5: Providers

**Files:**
- Create: `api/loopforge/providers.py`
- Create: `tests/test_providers.py`

- [ ] **Step 1: Write failing provider tests**

Create `tests/test_providers.py`:

```python
from api.loopforge.providers import FakeLLMProvider, FakeSandboxProvider


def test_fake_llm_provider_returns_deterministic_response() -> None:
    provider = FakeLLMProvider()

    response = provider.complete(system="planner", prompt="Create a loop")

    assert response.text.startswith("FAKE_RESPONSE")
    assert response.tokens_used > 0


def test_fake_sandbox_provider_records_code_without_host_execution() -> None:
    provider = FakeSandboxProvider()

    result = provider.run_code("print('hello')", timeout_seconds=3)

    assert result.exit_code == 0
    assert result.stdout == "sandbox execution simulated"
    assert provider.executions == ["print('hello')"]
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_providers.py -q
```

Expected: FAIL with missing `api.loopforge.providers`.

- [ ] **Step 3: Implement provider interfaces and fakes**

Create `api/loopforge/providers.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from api.loopforge.context import estimate_tokens


@dataclass(frozen=True)
class LLMResponse:
    text: str
    tokens_used: int


class LLMProvider(Protocol):
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        raise NotImplementedError


class FakeLLMProvider:
    def complete(self, *, system: str, prompt: str) -> LLMResponse:
        text = f"FAKE_RESPONSE system={system} prompt={prompt[:80]}"
        return LLMResponse(text=text, tokens_used=estimate_tokens(system) + estimate_tokens(prompt))


@dataclass(frozen=True)
class SandboxResult:
    exit_code: int
    stdout: str
    stderr: str = ""


class SandboxProvider(Protocol):
    def run_code(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        raise NotImplementedError


@dataclass
class FakeSandboxProvider:
    executions: list[str] = field(default_factory=list)

    def run_code(self, code: str, *, timeout_seconds: int) -> SandboxResult:
        self.executions.append(code)
        return SandboxResult(exit_code=0, stdout="sandbox execution simulated")
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./.venv/bin/python -m pytest tests/test_providers.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/loopforge/providers.py tests/test_providers.py
git commit -m "feat: add deterministic runtime providers"
```

## Task 6: Loop Planner

**Files:**
- Create: `api/loopforge/planner.py`
- Create: `tests/test_planner.py`

- [ ] **Step 1: Write failing planner tests**

Create `tests/test_planner.py`:

```python
from api.loopforge.domain import Goal, GoalMode, GoalToggles, RunStatus
from api.loopforge.planner import LoopPlanner
from api.loopforge.providers import FakeLLMProvider


def test_planner_requests_clarification_for_vague_goal() -> None:
    planner = LoopPlanner(llm=FakeLLMProvider())
    goal = Goal(text="make it better")

    result = planner.check_clarity(goal)

    assert result.status == RunStatus.NEEDS_CLARIFICATION
    assert result.session is not None
    assert result.session.missing_requirements == ["desired outcome", "success criteria"]
    assert result.session.questions[0].question.endswith("?")


def test_planner_generates_loop_spec_for_clear_offline_goal() -> None:
    planner = LoopPlanner(llm=FakeLLMProvider())
    goal = Goal(
        text="Create a three-step launch checklist for a local-only developer tool and save the result",
        mode=GoalMode.OFFLINE_LOCAL,
        toggles=GoalToggles(internet=False, code_sandbox=True),
    )

    result = planner.check_clarity(goal)
    spec = planner.generate_spec(goal)

    assert result.status == RunStatus.PENDING_APPROVAL
    assert spec.goal_id == goal.id
    assert spec.agents[0].name == "Loop Planner"
    assert "web_search" not in [permission.tool_name for permission in spec.tool_permissions if permission.enabled]
    assert "before_run" in spec.gates


def test_planner_includes_web_tool_when_internet_toggle_is_enabled() -> None:
    planner = LoopPlanner(llm=FakeLLMProvider())
    goal = Goal(
        text="Research current pricing pages online and summarize positioning",
        mode=GoalMode.ONLINE_ENABLED,
        toggles=GoalToggles(internet=True),
    )

    spec = planner.generate_spec(goal)

    enabled_tools = [permission.tool_name for permission in spec.tool_permissions if permission.enabled]
    assert "web_search" in enabled_tools
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_planner.py -q
```

Expected: FAIL with missing `api.loopforge.planner`.

- [ ] **Step 3: Implement loop planner**

Create `api/loopforge/planner.py`:

```python
from __future__ import annotations

from dataclasses import dataclass

from api.loopforge.domain import (
    ClarificationQuestion,
    ClarificationSession,
    Goal,
    GoalMode,
    LoopSpec,
    LoopSpecAgent,
    RunStatus,
    ToolPermission,
)
from api.loopforge.providers import LLMProvider


@dataclass(frozen=True)
class ClarityResult:
    status: RunStatus
    session: ClarificationSession | None = None


class LoopPlanner:
    def __init__(self, llm: LLMProvider) -> None:
        self.llm = llm

    def check_clarity(self, goal: Goal) -> ClarityResult:
        missing = self._missing_requirements(goal.text)
        if missing:
            questions = [
                ClarificationQuestion(
                    question="What specific outcome should the loop produce?",
                    missing_requirement=missing[0],
                )
            ]
            session = ClarificationSession(
                goal_id=goal.id,
                questions=questions,
                missing_requirements=missing,
                clarity_score=0.35,
            )
            return ClarityResult(status=RunStatus.NEEDS_CLARIFICATION, session=session)
        return ClarityResult(status=RunStatus.PENDING_APPROVAL)

    def generate_spec(self, goal: Goal) -> LoopSpec:
        self.llm.complete(system="loop-planner", prompt=goal.text)
        permissions = [
            ToolPermission(tool_name="local_workspace", enabled=True, reason="Store run artifacts"),
            ToolPermission(tool_name="code_sandbox", enabled=goal.toggles.code_sandbox, reason="Run generated code safely"),
        ]
        if goal.mode == GoalMode.ONLINE_ENABLED and goal.toggles.internet:
            permissions.append(ToolPermission(tool_name="web_search", enabled=True, reason="Internet toggle enabled"))
        else:
            permissions.append(ToolPermission(tool_name="web_search", enabled=False, reason="Internet disabled for this goal"))

        allowed_tools = [permission.tool_name for permission in permissions if permission.enabled]
        return LoopSpec(
            goal_id=goal.id,
            version=1,
            agents=[
                LoopSpecAgent(
                    name="Loop Planner",
                    role="Maintain the plan, validate progress, and coordinate agents.",
                    system_prompt="You convert the approved goal into small executable steps and keep the run aligned with constraints.",
                    tools=["local_workspace"],
                ),
                LoopSpecAgent(
                    name="Executor",
                    role="Use approved tools to produce artifacts that satisfy the goal.",
                    system_prompt="You execute only approved steps with approved tools and report blockers honestly.",
                    tools=allowed_tools,
                ),
                LoopSpecAgent(
                    name="Reviewer",
                    role="Check whether the output satisfies the success criteria.",
                    system_prompt="You compare outputs against success and failure criteria, then recommend improve or finalize.",
                    tools=["local_workspace"],
                ),
            ],
            tool_permissions=permissions,
            handoffs=[
                {"from": "Loop Planner", "to": "Executor", "condition": "plan ready"},
                {"from": "Executor", "to": "Reviewer", "condition": "artifact produced"},
            ],
            success_criteria=[f"Produce a result that directly satisfies: {goal.text}"],
            failure_criteria=["Required permission is missing", "Goal cannot be achieved within budget"],
            gates=["before_run"],
            context_policy={"max_context_tokens": goal.budget.max_context_tokens},
            improvement_strategy="If review fails, revise the plan once within budget and retry the weakest step.",
        )

    def _missing_requirements(self, text: str) -> list[str]:
        normalized = text.strip().lower()
        vague_phrases = {"make it better", "help me", "do the thing", "improve this"}
        if normalized in vague_phrases or len(normalized.split()) < 6:
            return ["desired outcome", "success criteria"]
        return []
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./.venv/bin/python -m pytest tests/test_planner.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/loopforge/planner.py tests/test_planner.py
git commit -m "feat: add goal clarity loop planner"
```

## Task 7: In-Memory Store

**Files:**
- Create: `api/loopforge/store.py`
- Create: `tests/test_store.py`

- [ ] **Step 1: Write failing store tests**

Create `tests/test_store.py`:

```python
from api.loopforge.domain import Goal, LoopSpec, LoopSpecAgent, Run, RunEvent
from api.loopforge.store import InMemoryStore


def test_store_persists_goal_spec_run_and_ordered_events() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a release checklist for the CLI"))
    spec = store.save_loop_spec(
        LoopSpec(
            goal_id=goal.id,
            version=1,
            agents=[LoopSpecAgent(name="Planner", role="Plan", system_prompt="Plan", tools=[])],
            handoffs=[],
            success_criteria=["Checklist exists"],
            failure_criteria=["No checklist"],
            gates=["before_run"],
            context_policy={"max_context_tokens": 1000},
            improvement_strategy="Revise once",
        )
    )
    run = store.save_run(Run(goal_id=goal.id, loop_spec_id=spec.id))
    first = store.append_event(RunEvent(run_id=run.id, seq=0, type="start", message="started"))
    second = store.append_event(RunEvent(run_id=run.id, seq=0, type="end", message="ended"))

    assert store.get_goal(goal.id).id == goal.id
    assert store.get_loop_spec(spec.id).id == spec.id
    assert store.get_run(run.id).id == run.id
    assert [event.seq for event in store.list_events(run.id)] == [1, 2]
    assert first.seq == 1
    assert second.seq == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_store.py -q
```

Expected: FAIL with missing `api.loopforge.store`.

- [ ] **Step 3: Implement in-memory store**

Create `api/loopforge/store.py`:

```python
from __future__ import annotations

from api.loopforge.domain import ContextEntry, Gate, Goal, LoopSpec, Run, RunEvent


class InMemoryStore:
    def __init__(self) -> None:
        self.goals: dict[str, Goal] = {}
        self.loop_specs: dict[str, LoopSpec] = {}
        self.runs: dict[str, Run] = {}
        self.events: dict[str, list[RunEvent]] = {}
        self.context_entries: dict[str, list[ContextEntry]] = {}
        self.gates: dict[str, Gate] = {}

    def save_goal(self, goal: Goal) -> Goal:
        self.goals[goal.id] = goal
        return goal

    def get_goal(self, goal_id: str) -> Goal:
        return self.goals[goal_id]

    def save_loop_spec(self, spec: LoopSpec) -> LoopSpec:
        self.loop_specs[spec.id] = spec
        return spec

    def get_loop_spec(self, spec_id: str) -> LoopSpec:
        return self.loop_specs[spec_id]

    def save_run(self, run: Run) -> Run:
        self.runs[run.id] = run
        return run

    def get_run(self, run_id: str) -> Run:
        return self.runs[run_id]

    def append_event(self, event: RunEvent) -> RunEvent:
        events = self.events.setdefault(event.run_id, [])
        stored = event.model_copy(update={"seq": len(events) + 1})
        events.append(stored)
        return stored

    def list_events(self, run_id: str) -> list[RunEvent]:
        return list(self.events.get(run_id, []))

    def append_context(self, entry: ContextEntry) -> ContextEntry:
        self.context_entries.setdefault(entry.run_id, []).append(entry)
        return entry

    def list_context(self, run_id: str) -> list[ContextEntry]:
        return list(self.context_entries.get(run_id, []))

    def save_gate(self, gate: Gate) -> Gate:
        self.gates[gate.id] = gate
        return gate
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./.venv/bin/python -m pytest tests/test_store.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/loopforge/store.py tests/test_store.py
git commit -m "feat: add in-memory runtime store"
```

## Task 8: Loop Runner

**Files:**
- Create: `api/loopforge/runner.py`
- Create: `tests/test_runner.py`

- [ ] **Step 1: Write failing runner tests**

Create `tests/test_runner.py`:

```python
from api.loopforge.domain import Budget, Goal, LoopSpec, LoopSpecAgent, RunStatus, ToolPermission
from api.loopforge.providers import FakeLLMProvider, FakeSandboxProvider
from api.loopforge.runner import LoopRunner
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import default_tool_registry


def make_spec(goal_id: str) -> LoopSpec:
    return LoopSpec(
        goal_id=goal_id,
        version=1,
        agents=[LoopSpecAgent(name="Executor", role="Execute", system_prompt="Do the work", tools=["local_workspace"])],
        tool_permissions=[ToolPermission(tool_name="local_workspace", enabled=True, reason="Store artifacts")],
        handoffs=[],
        success_criteria=["Result exists"],
        failure_criteria=["No result"],
        gates=["before_run"],
        context_policy={"max_context_tokens": 1000},
        improvement_strategy="Revise once",
        status="approved",
    )


def test_runner_completes_approved_loop_and_records_events() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a release checklist for the CLI"))
    spec = store.save_loop_spec(make_spec(goal.id))
    runner = LoopRunner(
        store=store,
        llm=FakeLLMProvider(),
        sandbox=FakeSandboxProvider(),
        tools=default_tool_registry(),
    )

    run = runner.start(goal, spec)

    assert run.status == RunStatus.COMPLETED
    assert run.result_summary == "Loop completed with deterministic fake providers."
    assert [event.type for event in store.list_events(run.id)] == [
        "run_started",
        "context_pack",
        "agent_step",
        "review",
        "run_completed",
    ]


def test_runner_stops_when_step_budget_is_exhausted() -> None:
    store = InMemoryStore()
    goal = store.save_goal(Goal(text="Create a release checklist for the CLI", budget=Budget(max_steps=1)))
    spec = store.save_loop_spec(make_spec(goal.id))
    runner = LoopRunner(
        store=store,
        llm=FakeLLMProvider(),
        sandbox=FakeSandboxProvider(),
        tools=default_tool_registry(),
    )

    run = runner.start(goal, spec)

    assert run.status == RunStatus.BUDGET_EXHAUSTED
    assert store.list_events(run.id)[-1].type == "budget_exhausted"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_runner.py -q
```

Expected: FAIL with missing `api.loopforge.runner`.

- [ ] **Step 3: Implement loop runner**

Create `api/loopforge/runner.py`:

```python
from __future__ import annotations

from api.loopforge.context import ContextManager
from api.loopforge.domain import ContextEntry, Goal, LoopSpec, Run, RunEvent, RunStatus, now_utc
from api.loopforge.providers import LLMProvider, SandboxProvider
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import ToolRegistry


class LoopRunner:
    def __init__(
        self,
        *,
        store: InMemoryStore,
        llm: LLMProvider,
        sandbox: SandboxProvider,
        tools: ToolRegistry,
    ) -> None:
        self.store = store
        self.llm = llm
        self.sandbox = sandbox
        self.tools = tools

    def start(self, goal: Goal, spec: LoopSpec) -> Run:
        run = self.store.save_run(
            Run(
                goal_id=goal.id,
                loop_spec_id=spec.id,
                status=RunStatus.RUNNING,
                started_at=now_utc(),
            )
        )
        self._event(run, "run_started", "Run started")

        if not self._consume_step(run, goal):
            return self._budget_exhausted(run)

        context_manager = ContextManager(max_tokens=goal.budget.max_context_tokens)
        self.store.append_context(ContextEntry(run_id=run.id, kind="goal", text=goal.text, tags=["goal", "required"]))
        pack = context_manager.build_pack(self.store.list_context(run.id), task="execute approved loop", required_tags=["required"])
        if pack.overflow:
            run = run.model_copy(update={"status": RunStatus.CONTEXT_OVERFLOW, "ended_at": now_utc()})
            self.store.save_run(run)
            self._event(run, "context_overflow", "Context pack could not fit within budget")
            return run
        self._event(run, "context_pack", "Context pack built", {"tokens": pack.token_count})

        if not self._consume_step(run, goal):
            return self._budget_exhausted(run)
        response = self.llm.complete(system=spec.agents[0].system_prompt, prompt=goal.text)
        run = run.model_copy(update={"spent_llm_calls": run.spent_llm_calls + 1})
        self.store.save_run(run)
        self._event(run, "agent_step", "Executor produced an artifact", {"tokens": response.tokens_used})

        if not self._consume_step(run, goal):
            return self._budget_exhausted(run)
        self._event(run, "review", "Reviewer accepted deterministic result")

        completed = run.model_copy(
            update={
                "status": RunStatus.COMPLETED,
                "result_summary": "Loop completed with deterministic fake providers.",
                "ended_at": now_utc(),
            }
        )
        self.store.save_run(completed)
        self._event(completed, "run_completed", "Run completed")
        return completed

    def _consume_step(self, run: Run, goal: Goal) -> bool:
        if run.spent_steps >= goal.budget.max_steps:
            return False
        updated = run.model_copy(update={"spent_steps": run.spent_steps + 1})
        self.store.save_run(updated)
        run.spent_steps = updated.spent_steps
        return True

    def _budget_exhausted(self, run: Run) -> Run:
        exhausted = run.model_copy(update={"status": RunStatus.BUDGET_EXHAUSTED, "ended_at": now_utc()})
        self.store.save_run(exhausted)
        self._event(exhausted, "budget_exhausted", "Step budget exhausted")
        return exhausted

    def _event(self, run: Run, event_type: str, message: str, payload: dict[str, object] | None = None) -> None:
        self.store.append_event(
            RunEvent(
                run_id=run.id,
                seq=0,
                type=event_type,
                message=message,
                payload=payload or {},
            )
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./.venv/bin/python -m pytest tests/test_runner.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/loopforge/runner.py tests/test_runner.py
git commit -m "feat: add deterministic loop runner"
```

## Task 9: FastAPI App

**Files:**
- Create: `api/loopforge/app.py`
- Create: `tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

Create `tests/test_api.py`:

```python
from fastapi.testclient import TestClient

from api.loopforge.app import create_app


def test_goal_creation_returns_clarification_for_vague_goal() -> None:
    client = TestClient(create_app())

    response = client.post("/api/goals", json={"text": "make it better"})

    assert response.status_code == 201
    body = response.json()
    assert body["goal"]["status"] == "needs_clarification"
    assert body["clarification"]["missing_requirements"] == ["desired outcome", "success criteria"]


def test_clear_goal_generates_loop_spec_and_run_completes_after_approval() -> None:
    client = TestClient(create_app())

    created = client.post(
        "/api/goals",
        json={
            "text": "Create a three-step launch checklist for a local-only developer tool and save the result",
            "toggles": {"internet": False, "code_sandbox": True, "local_connectors": True},
        },
    ).json()
    goal_id = created["goal"]["id"]
    spec_id = created["loop_spec"]["id"]

    approval = client.post(f"/api/loop-specs/{spec_id}/approve")
    assert approval.status_code == 200
    assert approval.json()["status"] == "approved"

    run_response = client.post(f"/api/goals/{goal_id}/runs", json={"loop_spec_id": spec_id})
    assert run_response.status_code == 201
    run = run_response.json()
    assert run["status"] == "completed"

    events = client.get(f"/api/runs/{run['id']}/events").json()
    assert [event["type"] for event in events][-1] == "run_completed"
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
./.venv/bin/python -m pytest tests/test_api.py -q
```

Expected: FAIL with missing `api.loopforge.app`.

- [ ] **Step 3: Implement FastAPI app**

Create `api/loopforge/app.py`:

```python
from __future__ import annotations

from fastapi import FastAPI, HTTPException

from api.loopforge.domain import Goal, GoalCreate, LoopSpec, Run
from api.loopforge.planner import LoopPlanner
from api.loopforge.providers import FakeLLMProvider, FakeSandboxProvider
from api.loopforge.runner import LoopRunner
from api.loopforge.store import InMemoryStore
from api.loopforge.tools import default_tool_registry


def create_app() -> FastAPI:
    app = FastAPI(title="LoopForge")
    store = InMemoryStore()
    llm = FakeLLMProvider()
    planner = LoopPlanner(llm=llm)
    sandbox = FakeSandboxProvider()
    tools = default_tool_registry()

    @app.post("/api/goals", status_code=201)
    def create_goal(payload: GoalCreate) -> dict[str, object]:
        goal = store.save_goal(Goal(**payload.model_dump()))
        clarity = planner.check_clarity(goal)
        goal = goal.model_copy(update={"status": clarity.status})
        store.save_goal(goal)
        response: dict[str, object] = {"goal": goal}
        if clarity.session is not None:
            response["clarification"] = clarity.session
            return response

        spec = store.save_loop_spec(planner.generate_spec(goal))
        response["loop_spec"] = spec
        return response

    @app.post("/api/loop-specs/{spec_id}/approve")
    def approve_loop_spec(spec_id: str) -> LoopSpec:
        try:
            spec = store.get_loop_spec(spec_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Loop spec not found") from exc
        approved = spec.model_copy(update={"status": "approved"})
        return store.save_loop_spec(approved)

    @app.post("/api/goals/{goal_id}/runs", status_code=201)
    def start_run(goal_id: str, payload: dict[str, str]) -> Run:
        try:
            goal = store.get_goal(goal_id)
            spec = store.get_loop_spec(payload["loop_spec_id"])
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Goal or loop spec not found") from exc
        if spec.status != "approved":
            raise HTTPException(status_code=409, detail="Loop spec must be approved before running")
        runner = LoopRunner(store=store, llm=llm, sandbox=sandbox, tools=tools)
        return runner.start(goal, spec)

    @app.get("/api/runs/{run_id}/events")
    def list_run_events(run_id: str) -> list[dict[str, object]]:
        return [event.model_dump(mode="json") for event in store.list_events(run_id)]

    return app


app = create_app()
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
./.venv/bin/python -m pytest tests/test_api.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/loopforge/app.py tests/test_api.py
git commit -m "feat: expose core loop API"
```

## Task 10: Full Verification and Baseline Documentation

**Files:**
- Create: `README.md`

- [ ] **Step 1: Add README for the first backend slice**

Create `README.md`:

````markdown
# LoopForge

LoopForge is a generic agent-loop creation and management platform. The first backend slice supports goal creation, clarity checks, generated loop specs, approval before run, deterministic run execution, permissioned tools, and bounded context packs.

## First Backend Slice

Run tests:

```bash
./.venv/bin/python -m pytest
```

Run the API locally:

```bash
./.venv/bin/python -m uvicorn api.loopforge.app:app --reload
```

The first implementation uses deterministic fake providers. Follow-up implementation plans replace those providers with durable storage, a worker, Docker plus gVisor sandbox execution, and local OpenAI-compatible LLM calls.
````

- [ ] **Step 2: Run all tests**

Run:

```bash
./.venv/bin/python -m pytest
```

Expected: PASS for all tests.

- [ ] **Step 3: Inspect git status**

Run:

```bash
git status --short
```

Expected: only `README.md` is uncommitted.

- [ ] **Step 4: Commit README**

```bash
git add README.md
git commit -m "docs: document backend foundation slice"
```

## Plan Self-Review Checklist

- Spec coverage: this plan covers goal creation, clarity checks, hybrid clarification data, loop-spec generation, user approval, deterministic run execution, context packing, token estimation, compaction, permissioned tools, offline/online toggles, event traces, and explicit statuses. Follow-up plans are required for frontend, durable storage, Celery, real gVisor provider, real OpenAI-compatible provider, online browser/search tools, and Docker compose.
- Red-flag scan: no unresolved task markers are present outside executable checkbox syntax.
- Type consistency: `Goal`, `LoopSpec`, `Run`, `RunEvent`, `ContextEntry`, `ToolPermission`, `GoalMode`, and `RunStatus` are defined before use and reused consistently across tasks.
