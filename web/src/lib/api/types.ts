// Mirrors docs/contract/openapi.yaml — the shared FE/BE contract.
// Do not drift from the contract without a renegotiation (see docs/contract/README.md).

export type RunStatus =
  | "completed"
  | "needs_clarification"
  | "blocked"
  | "budget_exhausted"
  | "failed"
  | "cancelled"
  | "unsafe_request"
  | "context_overflow"
  | "running"
  | "pending_approval";

export type GoalMode = "offline_local" | "online_enabled";

export type AutonomyLevel = "manual" | "checkpointed" | "supervised" | "autonomous";

export type GoalToggles = {
  internet: boolean;
  code_sandbox: boolean;
  local_connectors: boolean;
};

export type Budget = {
  max_steps: number;
  max_llm_calls: number;
  max_context_tokens: number;
};

export type GoalCreate = {
  text: string;
  mode: GoalMode;
  toggles: GoalToggles;
  constraints: Record<string, unknown>;
  budget: Budget;
  llm_provider_id?: string | null;
  dataset_id?: string | null;
  evaluator_id?: string | null;
  autonomy?: AutonomyLevel;
};

export type EvaluatorKind =
  | "statistical_insight"
  | "ml_baseline"
  | "custom_metric"
  | "llm_rubric";

export type EvaluatorDirection = "minimize" | "maximize";

export type Evaluator = {
  id: string;
  name: string;
  kind: EvaluatorKind;
  metric_name: string | null;
  direction: EvaluatorDirection | null;
  target: number | null;
  config: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
};

export type EvaluatorCreate = {
  name: string;
  kind: EvaluatorKind;
  metric_name?: string;
  direction?: EvaluatorDirection;
  target?: number;
  config?: Record<string, unknown>;
  is_default?: boolean;
};

export type EvaluatorUpdate = Partial<Omit<EvaluatorCreate, "kind">>;

export type DatasetKind = "csv" | "parquet";
export type DatasetStatus = "uploaded" | "profiling" | "ready" | "failed";

export type DatasetColumn = {
  name: string;
  dtype: string;
  null_count: number;
  unique_count: number;
  sample: string[]; // PII-masked sample values
  pii_masked: boolean;
};

export type DatasetProfile = {
  row_count: number;
  column_count: number;
  columns: DatasetColumn[];
};

export type Dataset = {
  id: string;
  name: string;
  filename: string;
  kind: DatasetKind;
  size_bytes: number;
  status: DatasetStatus;
  profile: DatasetProfile | null;
  detail: string | null;
  created_at: string;
};

export type LLMProviderKind = "openai_compatible" | "anthropic";

export type LLMProvider = {
  id: string;
  name: string;
  kind: LLMProviderKind;
  base_url: string | null;
  model: string;
  timeout_seconds: number;
  is_default: boolean;
  has_api_key: boolean;
  created_at: string;
};

export type LLMProviderCreate = {
  name: string;
  kind: LLMProviderKind;
  base_url?: string;
  model: string;
  api_key?: string;
  timeout_seconds?: number;
  is_default?: boolean;
};

export type LLMProviderUpdate = Partial<Omit<LLMProviderCreate, "kind">>;

export type LLMTestResult = { ok: boolean; detail?: string | null; model?: string | null };

export type Goal = GoalCreate & {
  id: string;
  status: RunStatus;
  created_at: string;
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  missing_requirement: string;
  options: string[];
};

export type ClarificationSession = {
  id: string;
  goal_id: string;
  questions: ClarificationQuestion[];
  answers: Array<Record<string, string>>;
  missing_requirements: string[];
  clarity_score: number;
  status: "open" | "ready";
};

export type ClarificationAnswer = { question_id: string; answer: string };

export type ToolPermission = { tool_name: string; enabled: boolean; reason: string };

export type LoopSpecAgent = {
  name: string;
  role: string;
  system_prompt: string;
  tools: string[];
};

export type LoopSpec = {
  id: string;
  goal_id: string;
  version: number;
  agents: LoopSpecAgent[];
  tool_permissions: ToolPermission[];
  handoffs: Array<Record<string, string>>;
  success_criteria: string[];
  failure_criteria: string[];
  gates: string[];
  context_policy: Record<string, unknown>;
  improvement_strategy: string;
  status: "draft" | "approved" | "rejected";
  created_at: string;
};

export type GoalCreateResult = {
  goal: Goal;
  clarification: ClarificationSession | null;
  loop_spec: LoopSpec | null;
};

export type ClarificationResult = {
  clarification: ClarificationSession;
  loop_spec: LoopSpec | null;
};

export type Run = {
  id: string;
  goal_id: string;
  loop_spec_id: string;
  status: RunStatus;
  spent_steps: number;
  spent_llm_calls: number;
  spent_usd: number | null;
  result_summary: string | null;
  started_at: string | null;
  ended_at: string | null;
};

export type RunEventType =
  | "node_start"
  | "node_end"
  | "tool_call"
  | "llm_call"
  | "cost_update"
  | "gate_pending"
  | "run_status";

export type RunEvent = {
  id: string;
  run_id: string;
  seq: number;
  type: RunEventType;
  message: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type Gate = {
  id: string;
  run_id: string;
  gate_type: string;
  status: "pending" | "approved" | "rejected";
  context: Record<string, unknown>;
  note: string | null;
};

export type GateDecision = { decision: "approve" | "reject"; note?: string };

export type Artifact = {
  id: string;
  run_id: string;
  kind: "insight" | "model" | "code" | "plot" | "report";
  metadata: Record<string, unknown>;
  storage_ref: string | null;
  created_at: string;
};

export type InsightResult = {
  id: string;
  rank: number;
  claim: string;
  passed: boolean;
  test: string;
  p_value: number;
  effect_name: string;
  effect_value: number;
  n: number;
  correction: string | null;
  plot_ref: string | null;
};

export type ModelResult = {
  id: string;
  name: string;
  metric_name: string;
  metric_value: number;
  baseline_name: string;
  baseline_value: number;
  beats_baseline: boolean;
  leakage_ok: boolean;
};

export type Results = {
  run_id: string;
  status: RunStatus;
  summary: {
    validated: number;
    rejected: number;
    cost_usd: number | null;
    duration_s: number | null;
  };
  insights: InsightResult[];
  models: ModelResult[];
};

export type ContextEntry = {
  id: string;
  run_id: string;
  kind: string;
  text: string;
  tags: string[];
  source_event_id: string | null;
  token_count: number;
  created_at: string;
};

export type ContextPack = {
  entries: ContextEntry[];
  summary: string;
  token_count: number;
  overflow: boolean;
};

export type RunContext = { ledger: ContextEntry[]; pack: ContextPack };

export type ArtifactContent = {
  artifact_id: string;
  filename: string | null;
  language: string | null;
  content: string;
};

export type LoopTemplate = {
  id: string;
  name: string;
  description: string | null;
  agents: LoopSpecAgent[];
  tool_permissions: ToolPermission[];
  handoffs: Array<Record<string, string>>;
  success_criteria: string[];
  failure_criteria: string[];
  gates: string[];
  context_policy: Record<string, unknown>;
  improvement_strategy: string;
  created_at: string;
};

export type LoopTemplateCreate = { name: string; description?: string; spec_id: string };

export type LoopSpecUpdate = Partial<
  Pick<
    LoopSpec,
    | "agents"
    | "tool_permissions"
    | "handoffs"
    | "success_criteria"
    | "failure_criteria"
    | "gates"
    | "context_policy"
    | "improvement_strategy"
  >
>;
