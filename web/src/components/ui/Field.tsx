import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";

/*
 * Shared form-control primitives. One control surface — white, 1px hairline,
 * 6px radius, Vercel-blue focus ring — so inputs, selects, and textareas read
 * as one system.
 */
const CONTROL =
  "w-full rounded-md border border-[var(--line2)] bg-[var(--surface)] text-ink placeholder:text-[var(--mut-soft)] " +
  "outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--accent)_25%,transparent)] " +
  "disabled:opacity-50";

/** Label + optional hint wrapper for a control. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="mb-1.5 block font-mono text-[12px] font-medium uppercase tracking-[.02em] text-mut"
        >
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <div className="mt-1.5 text-[12px] text-mut">{hint}</div> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, "h-11 px-3.5 text-[14px]", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(CONTROL, "resize-y px-3.5 py-3 text-[14px] leading-relaxed", className)}
        {...props}
      />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL, "h-11 px-3.5 text-[14px]", className)} {...props}>
        {children}
      </select>
    );
  },
);
