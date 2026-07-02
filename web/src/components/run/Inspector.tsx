import { Button } from "../ui/Button";
import type { LoopSpecAgent, RunEvent } from "../../lib/api/types";
import type { AgentStatus } from "../../lib/runEvents";

export type InspectorGate = {
  gateType: string;
  context: Record<string, unknown>;
};

type InspectorProps = {
  agent?: LoopSpecAgent;
  agentStatus?: AgentStatus;
  incoming: string[];
  outgoing: string[];
  recent: RunEvent[];
  gate?: InspectorGate | null;
  onApprove: () => void;
  onReject: () => void;
  deciding?: boolean;
};

export function Inspector({
  agent,
  agentStatus,
  incoming,
  outgoing,
  recent,
  gate,
  onApprove,
  onReject,
  deciding,
}: InspectorProps) {
  return (
    <aside className="flex h-full flex-col overflow-auto border-l border-[var(--line)] bg-[var(--canvas-soft)]">
      <div className="border-b border-[var(--line)] p-4">
        <h3 className="lf-eyebrow">Inspector</h3>
      </div>
      <div className="flex-1 p-4">
        {agent ? (
          <div className="space-y-4">
            <div>
              <div className="font-display text-[18px] text-ink">{agent.name}</div>
              <div className="text-[12px] text-mut">
                {agent.role}
                {agentStatus ? ` · ${agentStatus}` : ""}
              </div>
            </div>
            <Field label="SYSTEM PROMPT">
              <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-[13px] leading-relaxed text-ink2">
                “{agent.system_prompt}”
              </div>
            </Field>
            <Field label="TOOLS">
              <div className="flex flex-wrap gap-1.5">
                {agent.tools.map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-[var(--line)] bg-[var(--glass2)] px-2 py-0.5 font-mono text-[11px] text-ink2"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Field>
            <Field label="HANDOFFS">
              <div className="text-[13px] text-ink2">
                {incoming.length ? `← ${incoming.join(", ")}` : "← —"}
                {"   "}
                {outgoing.length ? `→ ${outgoing.join(", ")}` : "→ —"}
              </div>
            </Field>
            <Field label="RECENT ACTIVITY">
              <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                {recent.length ? (
                  recent.slice(-6).map((e) => (
                    <div
                      key={e.id}
                      className="flex gap-2.5 border-b border-[var(--line)] px-3 py-2 text-[12px] last:border-0"
                    >
                      <span className="font-mono text-[10.5px] text-mut">
                        {e.created_at.slice(11, 19)}
                      </span>
                      <span className="text-ink2">{e.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-[12px] text-mut">No activity yet.</div>
                )}
              </div>
            </Field>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--line2)] bg-[var(--surface)] px-5 py-10 text-center">
            <div className="grid size-11 place-items-center rounded-xl border border-[var(--line)] bg-[var(--canvas-soft)] text-lg text-mut">
              ◎
            </div>
            <div className="text-[13px] font-semibold text-ink2">Nothing selected</div>
            <p className="max-w-[220px] text-[12px] leading-relaxed text-mut">
              Pick an agent in the pipeline to inspect its system prompt, tools, handoffs, and live
              activity.
            </p>
          </div>
        )}

        {gate ? (
          <div className="mt-5 rounded-xl border border-[color-mix(in_srgb,var(--tl-done)_55%,var(--line))] bg-[color-mix(in_srgb,var(--tl-done)_12%,var(--surface))] p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              ⛬ {gate.gateType}
            </div>
            <p className="my-2.5 text-[12.5px] leading-relaxed text-ink2">
              {gateSummary(gate.context)}
            </p>
            <div className="flex gap-2.5">
              <Button variant="success" className="flex-1" loading={deciding} onClick={onApprove}>
                Approve
              </Button>
              <Button variant="danger" className="flex-1" disabled={deciding} onClick={onReject}>
                Reject
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-bold tracking-[.7px] text-mut">{label}</div>
      {children}
    </div>
  );
}

function gateSummary(ctx: Record<string, unknown>): string {
  const insights = ctx.validated_insights;
  const cost = ctx.est_cost_usd;
  const parts: string[] = [];
  if (typeof insights === "number") parts.push(`${insights} validated insights ready`);
  if (typeof cost === "number") parts.push(`est. cost to finish $${cost.toFixed(2)}`);
  return parts.length ? `${parts.join(" · ")}.` : "Human sign-off required to continue.";
}
