import { Link } from "react-router-dom";
import { NAV_GROUPS } from "../../app/nav";
import { cn } from "../../lib/cn";

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="flex w-[250px] flex-col gap-1 border-r border-[var(--line)] p-4">
      <div className="mb-6 flex items-center gap-3 px-1">
        <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet to-teal font-extrabold shadow-[0_0_24px_rgba(138,108,255,.55)]">
          ◆
        </div>
        <b className="text-lg">LoopForge</b>
      </div>
      {NAV_GROUPS.map((group) => (
        <div key={group.heading}>
          <div className="mt-3 mb-1 px-2 text-[10px] font-bold tracking-[1.7px] text-mut">
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
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                  active
                    ? "border border-[rgba(184,166,255,.45)] bg-gradient-to-br from-[rgba(138,108,255,.26)] to-[rgba(74,214,255,.14)] text-white"
                    : "border border-transparent text-mut hover:bg-[var(--glass)] hover:text-ink",
                )}
              >
                <span className="w-[18px] text-center">{item.icon}</span>
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
    </aside>
  );
}
