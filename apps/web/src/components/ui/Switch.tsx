import { useId } from "react";
import { cn } from "@/lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-fg">
          {label}
        </label>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-40 pointer-coarse:h-8 pointer-coarse:w-14 before:absolute before:-inset-2 before:content-['']",
          checked ? "border-emerald-nur bg-emerald-nur" : "border-line bg-surface-2",
        )}
      >
        <span
          aria-hidden
          className={cn("inline-block size-5 rounded-full bg-ivory shadow transition-transform duration-200 ease-nur", checked ? "translate-x-6" : "translate-x-1")}
        />
      </button>
    </div>
  );
}
