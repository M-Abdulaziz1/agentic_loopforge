import { cn } from "../../lib/cn";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Field";

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
    <div className="mb-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[.88px] text-mut">Agent config</h3>
        <span className="font-mono text-[12px] text-ink2">{name}</span>
        <Button variant="danger" size="sm" className="ml-auto h-7 px-2.5 text-[11px]" onClick={onDelete}>
          Delete
        </Button>
      </div>

      <Label>Role</Label>
      <Input
        aria-label="Role"
        value={role}
        onChange={(e) => onRole(e.target.value)}
        className="mb-3 h-10 text-[13px]"
      />

      <Label>System prompt</Label>
      <Textarea
        aria-label="System prompt"
        value={systemPrompt}
        onChange={(e) => onPrompt(e.target.value)}
        className="mb-3 min-h-[88px] text-[13px]"
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
                "rounded-md border px-2 py-1 text-[11px] font-medium transition",
                on
                  ? "border-[color-mix(in_srgb,var(--violet)_45%,var(--line))] bg-[color-mix(in_srgb,var(--violet)_12%,var(--surface))] text-violet"
                  : "border-[var(--line2)] bg-[var(--surface)] text-mut hover:border-[var(--mut)] hover:text-ink",
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
  return <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">{children}</div>;
}
