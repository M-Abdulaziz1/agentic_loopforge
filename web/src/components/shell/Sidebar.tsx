import { Link } from "react-router-dom";
import { NAV_GROUPS } from "../../app/nav";
import { cn } from "../../lib/cn";
import { BrandMark } from "../brand/BrandMark";

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="relative flex w-[250px] flex-col gap-1 border-r border-[var(--line)] bg-[rgba(10,10,26,0.5)] p-4 backdrop-blur-xl">
      {/* brand lockup */}
      <Link
        to="/goals"
        className="mb-7 mt-1 flex items-center gap-3 rounded-2xl px-1 py-1 transition hover:opacity-90"
      >
        <BrandMark size={42} />
        <div className="leading-none">
          <div className="font-display text-[19px] font-extrabold tracking-tight text-ink">
            Loop<span className="bg-gradient-to-r from-violet to-teal bg-clip-text text-transparent">Forge</span>
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[2px] text-mut">
            Guarded autonomy
          </div>
        </div>
      </Link>

      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <div className="mb-1 mt-4 px-3 text-[10px] font-bold tracking-[2px] text-mut">
            {group.heading}
          </div>
          {group.items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition",
                  active
                    ? "bg-gradient-to-r from-[rgba(138,108,255,.22)] to-[rgba(74,214,255,.08)] text-white"
                    : "text-mut hover:bg-[var(--glass)] hover:text-ink",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-violet to-teal shadow-[0_0_10px_rgba(138,108,255,.8)]" />
                ) : null}
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg text-[15px] transition",
                    active
                      ? "bg-[rgba(138,108,255,.25)] text-white shadow-[inset_0_0_0_1px_rgba(184,166,255,.35)]"
                      : "bg-[var(--glass)] text-mut group-hover:text-ink",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-bad px-2 text-[11px] font-extrabold text-[#220812]">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto rounded-xl border border-[var(--line)] bg-[var(--glass)] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink2">
          <span className="size-2 rounded-full bg-ok shadow-[0_0_8px_var(--ok)]" />
          Sandbox armed
        </div>
        <div className="mt-1 text-[10.5px] leading-snug text-mut">
          gVisor · read-only data · budget caps
        </div>
      </div>
    </aside>
  );
}
