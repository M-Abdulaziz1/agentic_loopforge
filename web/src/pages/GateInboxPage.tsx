import { useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import { useGates, useDecideGate } from "../lib/api/gates";
import type { Gate } from "../lib/api/types";

export function GateInboxPage() {
  const { data: gates = [], isLoading } = useGates("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const selected = gates.find((g) => g.id === selectedId) ?? gates[0];
  const decide = useDecideGate(selected?.id ?? "", selected?.run_id ?? "");

  function act(decision: "approve" | "reject") {
    if (!selected) return;
    decide.mutate({ decision, note: note || undefined });
    setNote("");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <div className="text-sm text-mut">Gate Inbox</div>
        <div className="ml-auto text-[12.5px] text-mut">
          {gates.length} pending
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-mut">Loading gates…</div>
      ) : gates.length === 0 ? (
        <div className="grid flex-1 place-items-center text-mut">No pending approvals. 🎉</div>
      ) : (
        <div className="grid flex-1 grid-cols-[330px_1fr] overflow-hidden">
          <div className="overflow-auto border-r border-[var(--line)] p-3.5">
            {gates.map((g) => (
              <GateRow
                key={g.id}
                gate={g}
                active={selected?.id === g.id}
                onClick={() => setSelectedId(g.id)}
              />
            ))}
          </div>
          {selected ? (
            <div className="overflow-auto p-7">
              <div className="mb-1.5 flex items-center gap-3">
                <h1 className="font-display text-[24px] leading-none text-ink">Run {selected.run_id}</h1>
                <span className="rounded-lg border border-[color-mix(in_srgb,var(--warn)_32%,var(--line))] bg-[color-mix(in_srgb,var(--warn)_14%,var(--surface))] px-2.5 py-1 text-[11px] font-extrabold text-warn">
                  ⛬ {selected.gate_type.toUpperCase()}
                </span>
              </div>
              <p className="mb-5 text-[13px] text-mut">
                Human sign-off required before the loop continues.
              </p>

              <div className="mb-5 grid grid-cols-2 gap-4">
                <Card title="What happens next">
                  <p className="text-sm leading-relaxed text-ink2">
                    {String(selected.context.next ??
                      "Approving resumes the loop; rejecting ends or redirects it per gate type.")}
                  </p>
                </Card>
                <Card title="Cost & budget">
                  <Kv k="Est. to finish" v={fmtUsd(selected.context.est_cost_usd)} />
                  <Kv k="Spent so far" v={fmtUsd(selected.context.spent_usd)} />
                </Card>
              </div>

              {typeof selected.context.validated_insights === "number" ? (
                <Card title={`Found so far · ${selected.context.validated_insights} validated`}>
                  <p className="text-sm text-ink2">
                    {selected.context.validated_insights} insights passed statistical
                    validation and are ready to compile.
                  </p>
                </Card>
              ) : null}

              <div className="mt-5 flex items-center gap-3">
                <Input
                  aria-label="Note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note…"
                  className="flex-1"
                />
                <Button variant="danger" size="lg" onClick={() => act("reject")} disabled={decide.isPending}>
                  Reject
                </Button>
                <Button variant="success" size="lg" onClick={() => act("approve")} loading={decide.isPending}>
                  Approve
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function GateRow({
  gate,
  active,
  onClick,
}: {
  gate: Gate;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mb-2.5 block w-full rounded-xl border p-3.5 text-left",
        active
          ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_10%,var(--surface))]"
          : "border-[var(--line)] bg-[var(--glass)] hover:border-[var(--line2)]",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="rounded-md border border-[color-mix(in_srgb,var(--warn)_32%,var(--line))] bg-[color-mix(in_srgb,var(--warn)_14%,var(--surface))] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[.4px] text-warn">
          {gate.gate_type.toUpperCase()}
        </span>
      </div>
      <div className="font-mono text-[13px] font-bold">{gate.run_id}</div>
    </button>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--glass)] p-[18px]">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[.88px] text-mut">{title}</h3>
      {children}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--line)] py-2 text-[13px] last:border-0">
      <span className="text-mut">{k}</span>
      <span className="font-mono font-semibold">{v}</span>
    </div>
  );
}

function fmtUsd(v: unknown): string {
  return typeof v === "number" ? `$${v.toFixed(2)}` : "—";
}
