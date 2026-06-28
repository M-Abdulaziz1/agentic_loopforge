import type { GoalMode, GoalToggles } from "./api/types";

/**
 * Enforce the guardrail that internet tools are unavailable in offline_local mode.
 * The server also enforces this; the client mirrors it so the UI can't even request it.
 */
export function lockTogglesForMode(toggles: GoalToggles, mode: GoalMode): GoalToggles {
  if (mode === "offline_local") return { ...toggles, internet: false };
  return toggles;
}
