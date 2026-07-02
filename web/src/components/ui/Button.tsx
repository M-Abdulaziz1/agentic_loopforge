import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

/*
 * The single button primitive. Every CTA in the app routes through here so
 * weight, radius, padding, hover/active/focus/disabled states stay identical —
 * the Cursor system's discipline (8px radius, medium weight, hairline depth,
 * one orange voltage) enforced in one place instead of 58 inline variations.
 */
const BASE =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium " +
  "transition duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45";

const VARIANT: Record<Variant, string> = {
  primary: "bg-violet text-white hover:bg-[var(--teal)]",
  secondary:
    "border border-[var(--line2)] bg-[var(--surface)] text-ink hover:border-[var(--mut)] hover:bg-[var(--canvas-soft)]",
  ghost: "text-ink2 hover:bg-[var(--glass2)] hover:text-ink",
  danger:
    "border border-[color-mix(in_srgb,var(--bad)_38%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_10%,var(--surface))] " +
    "text-bad hover:bg-[color-mix(in_srgb,var(--bad)_17%,var(--surface))]",
  success: "bg-ok text-white hover:brightness-[0.94]",
};

const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px]",
  md: "h-10 px-[18px] text-[14px]",
  lg: "h-11 px-5 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
});

function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
