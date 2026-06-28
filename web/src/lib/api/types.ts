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
};

export type Goal = GoalCreate & {
  id: string;
  status: RunStatus;
  created_at: string;
};

export type ClarificationQuestion = {
  id: string;
  question: string;
  missing_requirement: string;
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
