/**
 * LoopForge icon system — a cohesive set of stroke-based glyphs drawn on a 24×24
 * grid, inheriting `currentColor` so nav/hover/active states colour them for free.
 * Replaces the ad-hoc Unicode glyphs that rendered inconsistently across platforms.
 */
import type { ReactElement, SVGProps } from "react";

export type IconName =
  | "goals"
  | "datasets"
  | "evaluators"
  | "specs"
  | "templates"
  | "runs"
  | "gates"
  | "results"
  | "context"
  | "settings";

const PATHS: Record<IconName, ReactElement> = {
  // bullseye — a goal to hit
  goals: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  // database cylinder — stored data
  datasets: (
    <>
      <ellipse cx="12" cy="5.5" rx="7" ry="2.8" />
      <path d="M5 5.5v13c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-13" />
      <path d="M5 12c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8" />
    </>
  ),
  // gauge — a validated metric
  evaluators: (
    <>
      <path d="M3.5 17a8.5 8.5 0 1 1 17 0" />
      <path d="M12 17l3.8-4" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // connected nodes — the agent graph
  specs: (
    <>
      <circle cx="6" cy="6.5" r="2.3" />
      <circle cx="18" cy="6.5" r="2.3" />
      <circle cx="12" cy="18" r="2.3" />
      <path d="M8.3 6.5h7.4M7.4 8.2l3.4 7.6M16.6 8.2l-3.4 7.6" />
    </>
  ),
  // copy/layers — reusable blueprints
  templates: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.4" />
      <path d="M15.5 8.5v-1.5A2.5 2.5 0 0 0 13 4.5H7A2.5 2.5 0 0 0 4.5 7v6A2.5 2.5 0 0 0 7 15.5h1.5" />
    </>
  ),
  // play in a circle — execution
  runs: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 8.6l5.4 3.4-5.4 3.4z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" />
    </>
  ),
  // shield-check — a human approval gate
  gates: (
    <>
      <path d="M12 3l7 2.6v5.1c0 4.3-2.95 7.15-7 8.7-4.05-1.55-7-4.4-7-8.7V5.6z" />
      <path d="M8.8 11.8l2.2 2.2 4.2-4.4" />
    </>
  ),
  // bar chart — validated findings
  results: (
    <>
      <path d="M4 20h16" />
      <rect x="5.5" y="11" width="3.4" height="6.5" rx="1" />
      <rect x="10.3" y="6.5" width="3.4" height="11" rx="1" />
      <rect x="15.1" y="13.5" width="3.4" height="4" rx="1" />
    </>
  ),
  // memory chip — compacted run context
  context: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="2.2" />
      <rect x="10" y="10" width="4" height="4" rx="0.8" />
      <path d="M9.2 3.2v3.3M14.8 3.2v3.3M9.2 17.5v3.3M14.8 17.5v3.3M3.2 9.2h3.3M3.2 14.8h3.3M17.5 9.2h3.3M17.5 14.8h3.3" />
    </>
  ),
  // gear — system settings
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82z" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  ...props
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[name]}
    </svg>
  );
}
