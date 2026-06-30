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


class AutonomyLevel(StrEnum):
    MANUAL = "manual"
    CHECKPOINTED = "checkpointed"
    SUPERVISED = "supervised"
    AUTONOMOUS = "autonomous"


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


class ClarificationStatus(StrEnum):
    OPEN = "open"
    READY = "ready"


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
    llm_provider_id: str | None = None
    dataset_id: str | None = None
    evaluator_id: str | None = None
    autonomy: AutonomyLevel = AutonomyLevel.CHECKPOINTED


class Goal(GoalCreate):
    id: str = Field(default_factory=lambda: new_id("goal"))
    status: RunStatus = RunStatus.NEEDS_CLARIFICATION
    created_at: datetime = Field(default_factory=now_utc)


class ClarificationQuestion(BaseModel):
    id: str = Field(default_factory=lambda: new_id("question"))
    question: str
    missing_requirement: str
    options: list[str] = Field(default_factory=list)


class ClarificationSession(BaseModel):
    id: str = Field(default_factory=lambda: new_id("clarification"))
    goal_id: str
    questions: list[ClarificationQuestion] = Field(default_factory=list)
    answers: list[dict[str, str]] = Field(default_factory=list)
    missing_requirements: list[str] = Field(default_factory=list)
    clarity_score: float = Field(default=0.0, ge=0.0, le=1.0)
    status: ClarificationStatus = ClarificationStatus.OPEN


class ClarificationAnswer(BaseModel):
    question_id: str
    answer: str


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


class LoopSpecUpdate(BaseModel):
    agents: list[LoopSpecAgent] | None = None
    tool_permissions: list[ToolPermission] | None = None
    handoffs: list[dict[str, str]] | None = None
    success_criteria: list[str] | None = None
    failure_criteria: list[str] | None = None
    gates: list[str] | None = None
    context_policy: dict[str, Any] | None = None
    improvement_strategy: str | None = None


class LoopTemplateCreate(BaseModel):
    name: str
    description: str | None = None
    spec_id: str


class LoopTemplateInstantiate(BaseModel):
    goal_id: str


class LoopTemplate(BaseModel):
    id: str = Field(default_factory=lambda: new_id("template"))
    name: str
    description: str | None = None
    agents: list[LoopSpecAgent]
    tool_permissions: list[ToolPermission] = Field(default_factory=list)
    handoffs: list[dict[str, str]]
    success_criteria: list[str]
    failure_criteria: list[str]
    gates: list[str]
    context_policy: dict[str, Any]
    improvement_strategy: str
    created_at: datetime = Field(default_factory=now_utc)


class LLMProviderKind(StrEnum):
    OPENAI_COMPATIBLE = "openai_compatible"
    ANTHROPIC = "anthropic"


class LLMProviderCreate(BaseModel):
    name: str
    kind: LLMProviderKind
    base_url: str | None = None
    model: str
    api_key: str | None = None
    timeout_seconds: float = Field(default=60.0, gt=0)
    is_default: bool = False


class LLMProviderUpdate(BaseModel):
    name: str | None = None
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = None
    timeout_seconds: float | None = Field(default=None, gt=0)
    is_default: bool | None = None


class StoredLLMProvider(BaseModel):
    id: str = Field(default_factory=lambda: new_id("llm_provider"))
    name: str
    kind: LLMProviderKind
    base_url: str | None = None
    model: str
    encrypted_api_key: str | None = None
    timeout_seconds: float = Field(default=60.0, gt=0)
    is_default: bool = False
    created_at: datetime = Field(default_factory=now_utc)


class LLMProvider(BaseModel):
    id: str
    name: str
    kind: LLMProviderKind
    base_url: str | None = None
    model: str
    timeout_seconds: float
    is_default: bool
    has_api_key: bool
    created_at: datetime


class LLMTestResult(BaseModel):
    ok: bool
    detail: str | None = None
    model: str | None = None


class EvaluatorKind(StrEnum):
    STATISTICAL_INSIGHT = "statistical_insight"
    ML_BASELINE = "ml_baseline"
    CUSTOM_METRIC = "custom_metric"
    LLM_RUBRIC = "llm_rubric"


class EvaluatorDirection(StrEnum):
    MINIMIZE = "minimize"
    MAXIMIZE = "maximize"


class EvaluatorCreate(BaseModel):
    name: str
    kind: EvaluatorKind
    metric_name: str | None = None
    direction: EvaluatorDirection | None = None
    target: float | None = None
    config: dict[str, Any] = Field(default_factory=dict)
    is_default: bool = False


class EvaluatorUpdate(BaseModel):
    name: str | None = None
    metric_name: str | None = None
    direction: EvaluatorDirection | None = None
    target: float | None = None
    config: dict[str, Any] | None = None
    is_default: bool | None = None


class Evaluator(EvaluatorCreate):
    id: str = Field(default_factory=lambda: new_id("evaluator"))
    created_at: datetime = Field(default_factory=now_utc)


class EvaluationResult(BaseModel):
    passed: bool
    score: float | None = None
    metric_name: str | None = None
    direction: EvaluatorDirection | None = None
    detail: str | None = None


class ArtifactContent(BaseModel):
    artifact_id: str
    filename: str | None = None
    language: str | None = None
    content: str


class DatasetKind(StrEnum):
    CSV = "csv"
    PARQUET = "parquet"


class DatasetStatus(StrEnum):
    UPLOADED = "uploaded"
    PROFILING = "profiling"
    READY = "ready"
    FAILED = "failed"


class DatasetColumn(BaseModel):
    name: str
    dtype: str
    null_count: int
    unique_count: int
    sample: list[str]
    pii_masked: bool


class DatasetProfile(BaseModel):
    row_count: int
    column_count: int
    columns: list[DatasetColumn]


class Dataset(BaseModel):
    id: str = Field(default_factory=lambda: new_id("dataset"))
    name: str
    filename: str
    kind: DatasetKind
    size_bytes: int
    status: DatasetStatus = DatasetStatus.UPLOADED
    profile: DatasetProfile | None = None
    detail: str | None = None
    created_at: datetime = Field(default_factory=now_utc)


class StoredDataset(Dataset):
    storage_path: str


class GoalCreateResult(BaseModel):
    goal: Goal
    clarification: ClarificationSession | None = None
    loop_spec: LoopSpec | None = None


class ClarificationResult(BaseModel):
    clarification: ClarificationSession
    loop_spec: LoopSpec | None = None


class Run(BaseModel):
    id: str = Field(default_factory=lambda: new_id("run"))
    goal_id: str
    loop_spec_id: str
    status: RunStatus = RunStatus.PENDING_APPROVAL
    spent_steps: int = 0
    spent_llm_calls: int = 0
    spent_usd: float | None = None
    result_summary: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None


class RunStartRequest(BaseModel):
    loop_spec_id: str


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


class Artifact(BaseModel):
    id: str = Field(default_factory=lambda: new_id("artifact"))
    run_id: str
    kind: Literal["insight", "model", "code", "plot", "report"]
    metadata: dict[str, Any] = Field(default_factory=dict)
    storage_ref: str | None = None
    created_at: datetime = Field(default_factory=now_utc)


class InsightResult(BaseModel):
    id: str
    rank: int
    claim: str
    passed: bool
    test: str
    p_value: float
    effect_name: str
    effect_value: float
    n: int
    correction: str | None = None
    plot_ref: str | None = None


class ModelResult(BaseModel):
    id: str
    name: str
    metric_name: str
    metric_value: float
    baseline_name: str
    baseline_value: float
    beats_baseline: bool
    leakage_ok: bool


class ResultsSummary(BaseModel):
    validated: int
    rejected: int
    cost_usd: float | None = None
    duration_s: float | None = None


class Results(BaseModel):
    run_id: str
    status: RunStatus
    summary: ResultsSummary
    insights: list[InsightResult] = Field(default_factory=list)
    models: list[ModelResult] = Field(default_factory=list)


class RunContext(BaseModel):
    ledger: list[ContextEntry]
    pack: ContextPack


class Gate(BaseModel):
    id: str = Field(default_factory=lambda: new_id("gate"))
    run_id: str
    gate_type: str
    status: GateStatus = GateStatus.PENDING
    context: dict[str, Any] = Field(default_factory=dict)
    note: str | None = None


class GateDecision(BaseModel):
    decision: Literal["approve", "reject"]
    note: str | None = None


class AuditEvent(BaseModel):
    id: str = Field(default_factory=lambda: new_id("audit"))
    action: str
    subject_type: str
    subject_id: str
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=now_utc)
