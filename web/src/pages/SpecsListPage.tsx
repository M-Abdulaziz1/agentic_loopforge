import { Link } from "react-router-dom";
import { GlassCard } from "../components/ui/GlassCard";
import { useLoopSpecs } from "../lib/api/loopspecs";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-[rgba(255,209,102,.15)] text-[#ffe2a0]",
  approved: "bg-[rgba(70,227,173,.14)] text-[#9af3d4]",
  rejected: "bg-[rgba(255,107,154,.14)] text-[#ffb9d2]",
};

export function SpecsListPage() {
  const { data: specs = [], isLoading } = useLoopSpecs();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center gap-4 border-b border-[var(--line)] px-7 py-4">
        <h1 className="text-base font-bold text-ink">Loop Specs</h1>
      </div>
      <div className="flex-1 overflow-auto p-7">
        {isLoading ? (
          <div className="text-mut">Loading specs…</div>
        ) : specs.length === 0 ? (
          <div className="text-mut">
            No loop specs yet. Create a goal — once it's clear, a spec is generated for review.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {specs.map((s) => (
              <Link key={s.id} to={`/specs/${s.id}`}>
                <GlassCard className="transition hover:border-[var(--line2)]">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="font-mono text-[12px] text-mut">{s.id}</span>
                    <span
                      className={`ml-auto rounded-md px-2 py-0.5 text-[11px] font-bold ${
                        STATUS_STYLE[s.status] ?? "bg-[var(--glass2)] text-ink2"
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="text-[13px] text-ink2">
                    v{s.version} · {s.agents.length} agents · {s.gates.length} gates
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.agents.map((a) => (
                      <span
                        key={a.name}
                        className="rounded-md border border-[var(--line)] bg-[var(--glass2)] px-2 py-0.5 text-[11px] text-ink2"
                      >
                        {a.name}
                      </span>
                    ))}
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
