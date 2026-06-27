import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--line)] bg-[var(--glass)] p-5 backdrop-blur-md",
        className,
      )}
      {...props}
    />
  );
}
