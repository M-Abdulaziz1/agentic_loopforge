import { Link } from "react-router-dom";
import { NAV_GROUPS } from "../../app/nav";
import { cn } from "../../lib/cn";
import { BrandMark } from "../brand/BrandMark";
import { Icon } from "../ui/Icon";
import { useThemeStore } from "../../store/theme";

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="relative flex w-[250px] flex-col gap-1 border-r border-[var(--line)] bg-[var(--canvas-soft)] p-4">
      {/* brand lockup */}
      <Link
        to="/goals"
        className="mb-7 mt-1 flex items-center gap-3 rounded-2xl px-1 py-1 transition hover:opacity-90"
      >
        <BrandMark size={42} />
        <div className="leading-none">
          <div className="font-display text-[19px] font-extrabold tracking-tight text-ink">
            Loop<span className="bg-[var(--accent)] bg-clip-text text-transparent">Forge</span>
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
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-mut hover:bg-[var(--glass2)] hover:text-ink",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--accent)]" />
                ) : null}
                <span
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-lg transition",
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--glass)] text-ink2 group-hover:text-ink",
                  )}
                >
                  <Icon name={item.icon} size={17} />
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

      <div className="mt-auto flex flex-col gap-3">
        <ThemeToggle />
        <div className="rounded-xl border border-[var(--line)] bg-[var(--glass)] px-3 py-2.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-ink2">
            <span className="size-2 rounded-full bg-ok shadow-[0_0_8px_var(--ok)]" />
            Sandbox armed
          </div>
          <div className="mt-1 text-[10.5px] leading-snug text-mut">
            gVisor · read-only data · budget caps
          </div>
        </div>
      </div>
    </aside>
  );
}

function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
      className="flex items-center gap-2.5 rounded-xl border border-[var(--line)] bg-[var(--glass)] px-3 py-2 text-[12px] font-semibold text-ink2 transition hover:border-[var(--line2)] hover:text-ink"
    >
      <span className="grid size-6 place-items-center rounded-lg bg-[var(--glass2)]">
        {dark ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </span>
      {dark ? "Dark" : "Light"} theme
    </button>
  );
}
