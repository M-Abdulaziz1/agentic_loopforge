import type { IconName } from "../components/ui/Icon";

export type NavItem = { label: string; to: string; icon: IconName; badge?: number };
export type NavGroup = { heading: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: "BUILD",
    items: [
      { label: "Goals", to: "/goals", icon: "goals" },
      { label: "Datasets", to: "/datasets", icon: "datasets" },
      { label: "Evaluators", to: "/evaluators", icon: "evaluators" },
      { label: "Loop Specs", to: "/specs", icon: "specs" },
      { label: "Templates", to: "/templates", icon: "templates" },
    ],
  },
  {
    heading: "OPERATE",
    items: [
      { label: "Runs", to: "/runs", icon: "runs" },
      { label: "Gate Inbox", to: "/gates", icon: "gates" },
      { label: "Results", to: "/results", icon: "results" },
      { label: "Context & Memory", to: "/context", icon: "context" },
    ],
  },
  {
    heading: "SYSTEM",
    items: [{ label: "Settings", to: "/settings", icon: "settings" }],
  },
];
