import type { AutonomyLevel } from "./api/types";

// Karpathy's autonomy slider, expressed as LoopForge HITL gates. The planner inserts
// these gates server-side; this mapping is the single source of truth the UI previews
// from and tests against. Security guardrails (sandbox, budget, read-only DB) are NOT
// part of the slider — they always apply, at every level.
export const AUTONOMY_LEVELS: AutonomyLevel[] = [
  "manual",
  "checkpointed",
  "supervised",
  "autonomous",
];

export const DEFAULT_AUTONOMY: AutonomyLevel = "checkpointed";

type AutonomyMeta = { label: string; leash: string; blurb: string };

export const AUTONOMY_META: Record<AutonomyLevel, AutonomyMeta> = {
  manual: {
    label: "Manual",
    leash: "Shortest leash",
    blurb: "You approve every stage. Maximum oversight, slowest.",
  },
  checkpointed: {
    label: "Checkpointed",
    leash: "Short leash",
    blurb: "Approve before training and before finalize. The default.",
  },
  supervised: {
    label: "Supervised",
    leash: "Long leash",
    blurb: "Runs freely; you only sign off before results are finalized.",
  },
  autonomous: {
    label: "Autonomous",
    leash: "Off the leash",
    blurb: "No gates — runs until it wins the metric or hits the budget cap.",
  },
};

export function gatesForAutonomy(level: AutonomyLevel): string[] {
  switch (level) {
    case "manual":
      return ["before_plan", "before_training", "before_finalize"];
    case "checkpointed":
      return ["before_training", "before_finalize"];
    case "supervised":
      return ["before_finalize"];
    case "autonomous":
      return [];
  }
}
