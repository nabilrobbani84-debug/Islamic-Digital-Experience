import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const CONTROL =
  "w-full rounded-xl border border-line bg-surface-2 px-4 text-fg placeholder:text-muted/70 transition-colors focus:border-gold/60 focus:outline-none focus-visible:outline-2 focus-visible:outline-ring aria-[invalid=true]:border-red-500";

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  id: string;
  children: ReactNode;
  hideLabel?: boolean;
}

export function FieldShell({ label, hint, error, id, children, hideLabel }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={cn("block text-sm font-medium text-fg", hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-500 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  hideLabel?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, hideLabel, leading, trailing, className, id, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={inputId} hideLabel={hideLabel}>
      <div className="relative">
        {leading && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted">{leading}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cn(CONTROL, "h-12", leading && "pl-11", trailing && "pr-12", className)}
          {...rest}
        />
        {trailing && <span className="absolute top-1/2 right-1.5 -translate-y-1/2">{trailing}</span>}
      </div>
    </FieldShell>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  hideLabel?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, hideLabel, className, id, children, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={selectId} hideLabel={hideLabel}>
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, "h-12 cursor-pointer appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23A7B2C2' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, className, id, ...rest }, ref) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={areaId}>
      <textarea ref={ref} id={areaId} aria-invalid={error ? true : undefined} className={cn(CONTROL, "min-h-28 py-3", className)} {...rest} />
    </FieldShell>
  );
});
