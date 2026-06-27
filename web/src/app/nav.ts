export type NavItem = { label: string; to: string; icon: string; badge?: number };
export type NavGroup = { heading: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    heading: "BUILD",
    items: [
      { label: "Goals", to: "/goals", icon: "✦" },
      { label: "Loop Specs", to: "/specs", icon: "❖" },
    ],
  },
  {
    heading: "OPERATE",
    items: [
      { label: "Runs", to: "/runs", icon: "◉" },
      { label: "Gate Inbox", to: "/gates", icon: "⛬" },
      { label: "Results", to: "/results", icon: "▤" },
      { label: "Context & Memory", to: "/context", icon: "⌬" },
    ],
  },
  {
    heading: "SYSTEM",
    items: [{ label: "Settings", to: "/settings", icon: "⚙" }],
  },
];
