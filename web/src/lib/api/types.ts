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

export type Goal = {
  id: string;
  text: string;
  mode: "offline_local" | "online_enabled";
  status: RunStatus;
  created_at: string;
};
