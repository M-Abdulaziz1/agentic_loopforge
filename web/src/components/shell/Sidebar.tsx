import { Link } from "react-router-dom";
import { NAV_GROUPS } from "../../app/nav";
import { cn } from "../../lib/cn";
import { useThemeStore } from "../../store/theme";
import { BrandMark } from "../brand/BrandMark";

export function Sidebar({ pathname }: { pathname: string }) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  return (
    <aside className="relative flex w-[250px] flex-col gap-0.5 border-r border-[var(--line)] bg-[var(--canvas-soft)] px-4 pb-4 pt-5">
      {/* brand lockup */}
      <Link
        to="/goals"
        className="mb-6 flex items-center gap-3 rounded-xl px-1 py-1 transition hover:opacity-80"
      >
        <BrandMark size={38} />
        <div className="leading-none">
          <div className="font-display text-[19px] tracking-tight text-ink">
            Loop<span className="text-violet">Forge</span>
          </div>
          <div className="lf-eyebrow mt-1.5">Guarded autonomy</div>
        </div>
      </Link>

      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <div className="lf-eyebrow mb-1 mt-5 px-3">{group.heading}</div>
          {group.items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition",
                  active
                    ? "bg-[var(--surface)] text-ink shadow-[inset_0_0_0_1px_var(--line)]"
                    : "text-mut hover:bg-[var(--glass2)] hover:text-ink",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent" />
                ) : null}
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-md text-[14px] transition",
                    active ? "text-ink" : "text-mut group-hover:text-ink",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
                {item.badge ? (
                  <span className="ml-auto rounded-full bg-bad px-2 text-[11px] font-semibold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}

      {/* theme toggle — segmented Light / Dark */}
      <div className="mt-auto mb-2 flex items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--surface)] p-1">
        {(["light", "dark"] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={theme === t}
            onClick={() => theme !== t && toggle()}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-[5px] py-1.5 text-[12px] font-medium capitalize transition",
              theme === t
                ? "bg-[var(--canvas-soft)] text-ink shadow-[inset_0_0_0_1px_var(--line)]"
                : "text-mut hover:text-ink",
            )}
          >
            <span aria-hidden>{t === "light" ? "☀" : "☾"}</span>
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink2">
          <span className="size-1.5 rounded-full bg-ok" />
          Sandbox armed
        </div>
        <div className="mt-1 text-[10.5px] leading-snug text-mut">
          gVisor · read-only data · budget caps
        </div>
      </div>
    </aside>
  );
}
