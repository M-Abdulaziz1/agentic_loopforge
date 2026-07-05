import { cn } from "../../lib/cn";

export const AVAILABLE_TOOLS = [
  "sandbox.exec",
  "workspace.read",
  "workspace.write",
  "mcp.schema",
  "internet",
] as const;

type Props = {
  name: string;
  role: string;
  systemPrompt: string;
  tools: string[];
  /** false in offline_local mode — internet stays locked off (guardrail) */
  internetAllowed: boolean;
  onRole: (v: string) => void;
  onPrompt: (v: string) => void;
  onToggleTool: (tool: string) => void;
  onDelete: () => void;
};

export function NodeConfigPanel({
  name,
  role,
  systemPrompt,
  tools,
  internetAllowed,
  onRole,
  onPrompt,
  onToggleTool,
  onDelete,
}: Props) {
  return (
    <div className="mb-5 rounded-2xl border border-[var(--line2)] bg-[var(--glass)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mut">Agent config</h3>
        <span className="font-mono text-[12px] text-ink2">{name}</span>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded-md border border-[rgba(255,107,154,.35)] bg-[rgba(255,107,154,.12)] px-2 py-0.5 text-[11px] font-semibold text-[#ffd0e0]"
        >
          Delete
        </button>
      </div>

      <Label>Role</Label>
      <input
        aria-label="Role"
        value={role}
        onChange={(e) => onRole(e.target.value)}
        className="mb-3 w-full rounded-lg border border-[var(--line2)] bg-white/[0.03] px-3 py-2 text-[13px] text-ink outline-none focus:border-[var(--accent)]"
      />

      <Label>System prompt</Label>
      <textarea
        aria-label="System prompt"
        value={systemPrompt}
        onChange={(e) => onPrompt(e.target.value)}
        className="mb-3 min-h-[88px] w-full resize-y rounded-lg border border-[var(--line2)] bg-white/[0.03] px-3 py-2 text-[13px] leading-relaxed text-ink outline-none focus:border-[var(--accent)]"
      />

      <Label>Tools</Label>
      <div className="flex flex-wrap gap-1.5">
        {AVAILABLE_TOOLS.map((t) => {
          const on = tools.includes(t);
          const locked = t === "internet" && !internetAllowed;
          return (
            <button
              key={t}
              type="button"
              disabled={locked}
              onClick={() => onToggleTool(t)}
              title={locked ? "Internet is disabled in Offline-Local mode" : undefined}
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] font-semibold transition",
                on
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--line2)] bg-[var(--glass2)] text-mut hover:text-ink",
                locked && "cursor-not-allowed opacity-40",
              )}
            >
              {on ? "✓ " : ""}
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[10px] font-bold tracking-[.6px] text-mut">{children}</div>;
}
