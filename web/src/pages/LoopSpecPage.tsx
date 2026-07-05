import { useNavigate, useParams } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { cn } from "../lib/cn";
import { useApproveLoopSpec, useLoopSpec } from "../lib/api/loopspecs";
import { useGoal } from "../lib/api/goals";
import { useStartRun } from "../lib/api/runs";

export function LoopSpecPage() {
  const { specId = "" } = useParams();
  const navigate = useNavigate();
  const { data: spec, isLoading } = useLoopSpec(specId);
  const approve = useApproveLoopSpec(specId);
  const { data: goal } = useGoal(spec?.goal_id ?? "");
  const startRun = useStartRun(spec?.goal_id ?? "");

  if (isLoading || !spec) {
    return <div className="p-8 text-mut">Loading loop spec…</div>;
  }

  const denied = spec.tool_permissions.filter((p) => !p.enabled);
  const isApproved = spec.status === "approved";
  const loopSpecId = spec.id;

  async function approveSpec() {
    await approve.mutateAsync();
  }

  async function startRunNow() {
    const run = await startRun.mutateAsync(loopSpecId);
    navigate(`/runs/${run.id}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-7 py-4 text-sm text-mut">
        Loop Specs / <b className="text-ink">Review</b>{" "}
        <span className="font-mono text-mut">spec v{spec.version}</span>
        <span
          className={cn(
            "ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold",
            spec.status === "approved"
              ? "border border-[rgba(70,227,173,.35)] bg-[rgba(70,227,173,.12)] text-[#9af3d4]"
              : "border border-[rgba(255,209,102,.35)] bg-[rgba(255,209,102,.15)] text-[#ffe2a0]",
          )}
        >
          {spec.status === "approved" ? "APPROVED" : "DRAFT · awaiting your review"}
        </span>
      </div>

      <div className="flex-1 overflow-auto px-7 pb-28 pt-6">
        <h1 className="text-[22px] font-extrabold tracking-tight">Review the generated loop</h1>
        {goal ? (
          <p className="mb-5 mt-1.5 max-w-[760px] text-sm leading-relaxed text-mut">
            From your goal: <i>“{goal.text}”</i>
          </p>
        ) : null}

        <div className="grid grid-cols-[1fr_320px] items-start gap-[22px]">
          <div>
            <GlassCard className="mb-[18px]">
              <SectionTitle>Control flow &amp; handoffs</SectionTitle>
              <div className="flex flex-wrap items-center gap-1 py-1">
                {spec.agents.map((a, i) => (
                  <div key={a.name} className="flex items-center gap-1">
                    <div className="flex min-w-[88px] flex-col items-center gap-1.5">
                      <div className="grid size-[52px] place-items-center rounded-2xl border border-[var(--line2)] bg-[var(--accent-soft)] text-lg">
                        {glyph(a.name)}
                      </div>
                      <small className="text-[11.5px] text-ink2">{a.name}</small>
                    </div>
                    {i < spec.agents.length - 1 ? (
                      <div className="h-0.5 w-7 bg-[var(--accent)] opacity-60" />
                    ) : null}
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard>
              <SectionTitle>Agents</SectionTitle>
              <div className="grid grid-cols-2 gap-3.5">
                {spec.agents.map((a) => (
                  <div
                    key={a.name}
                    className="rounded-2xl border border-[var(--line2)] bg-white/[0.025] p-3.5"
                  >
                    <div className="mb-2.5 flex items-center gap-2.5">
                      <div className="grid size-9 place-items-center rounded-xl bg-[var(--accent)] text-base">
                        {glyph(a.name)}
                      </div>
                      <div>
                        <div className="text-sm font-bold">{a.name}</div>
                        <div className="text-[11.5px] text-mut">{a.role}</div>
                      </div>
                    </div>
                    <div className="mb-2.5 rounded-[10px] border border-[var(--line)] bg-[var(--glass)] px-2.5 py-2 text-[12.5px] leading-relaxed text-ink2">
                      “{a.system_prompt}”
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {a.tools.map((t) => (
                        <Chip key={t}>{t}</Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          <div>
            <RailCard title="Success criteria">
              {spec.success_criteria.map((c) => (
                <Li key={c} tone="ok">
                  {c}
                </Li>
              ))}
            </RailCard>
            <RailCard title="Failure / honest-empty">
              {spec.failure_criteria.map((c) => (
                <Li key={c} tone="bad">
                  {c}
                </Li>
              ))}
            </RailCard>
            <RailCard title="Approval gates">
              {spec.gates.map((g) => (
                <div key={g} className="flex items-center gap-2.5 py-2 text-[13px]">
                  <span className="grid size-[26px] place-items-center rounded-lg border border-[rgba(255,209,102,.3)] bg-[rgba(255,209,102,.13)] text-warn">
                    ⛬
                  </span>
                  {g}
                  <span className="ml-auto text-xs text-mut">human sign-off</span>
                </div>
              ))}
            </RailCard>
            {denied.length ? (
              <RailCard title="Denied tools">
                <div className="flex flex-wrap gap-1.5">
                  {denied.map((p) => (
                    <span
                      key={p.tool_name}
                      title={p.reason}
                      className="rounded-md border border-[rgba(255,107,154,.3)] bg-[rgba(255,107,154,.12)] px-2 py-0.5 text-[11px] text-[#ffb9d2] line-through"
                    >
                      {p.tool_name}
                    </span>
                  ))}
                </div>
              </RailCard>
            ) : null}
            <RailCard title="Improvement strategy">
              <p className="text-[12.5px] leading-relaxed text-ink2">
                {spec.improvement_strategy}
              </p>
            </RailCard>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-[250px] right-0 flex items-center gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-7 py-4 backdrop-blur">
        <div className="text-[12.5px] text-mut">
          {isApproved
            ? "Spec approved. Start the run to execute the loop."
            : "Approve to enable the run. You can edit any section first."}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => navigate("/goals")}
          className="rounded-xl border border-[rgba(255,107,154,.35)] bg-[rgba(255,107,154,.12)] px-[18px] py-2.5 text-sm font-semibold text-[#ffd0e0]"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => navigate(`/specs/${spec.id}/edit`)}
          className="rounded-xl border border-[var(--line2)] bg-[var(--glass2)] px-[18px] py-2.5 text-sm font-semibold"
        >
          ✎ Edit in builder
        </button>
        {isApproved ? (
          <button
            type="button"
            onClick={startRunNow}
            disabled={startRun.isPending}
            className="rounded-xl bg-[var(--accent)] px-[22px] py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {startRun.isPending ? "Starting…" : "▶ Start run"}
          </button>
        ) : (
          <button
            type="button"
            onClick={approveSpec}
            disabled={approve.isPending}
            className="rounded-xl bg-gradient-to-br from-ok to-[#28c596] px-[22px] py-2.5 text-sm font-bold text-[#04231a] shadow-[0_8px_24px_rgba(70,227,173,.3)] disabled:opacity-50"
          >
            {approve.isPending ? "Approving…" : "✓ Approve & enable run"}
          </button>
        )}
      </div>
    </div>
  );
}

function glyph(name: string): string {
  const map: Record<string, string> = {
    planner: "◈",
    analyst: "⚗",
    validator: "✺",
    reporter: "▤",
  };
  return map[name] ?? "◆";
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 text-[11px] font-bold uppercase tracking-wide text-mut">
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] text-[var(--accent)]">
      {children}
    </span>
  );
}

function RailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard className="mb-4 p-[18px]">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </GlassCard>
  );
}

function Li({ tone, children }: { tone: "ok" | "bad"; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 py-1.5 text-[13px] text-ink2">
      <span className={tone === "ok" ? "text-ok" : "text-bad"}>
        {tone === "ok" ? "✓" : "✕"}
      </span>
      <span>{children}</span>
    </div>
  );
}
