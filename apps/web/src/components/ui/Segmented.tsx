import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}

/** Kontrol pilihan tunggal (radiogroup) dengan indikator aktif beranimasi dan navigasi panah. */
export function Segmented<T extends string>({ options, value, onChange, label, className, size = "md" }: SegmentedProps<T>) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    const option = options[next];
    if (option) {
      onChange(option.value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full overflow-x-auto rounded-2xl border border-line bg-surface-2 p-1 scrollbar-none", className)}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, index)}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative shrink-0 rounded-xl font-medium whitespace-nowrap transition-colors",
              size === "md" ? "h-10 px-4 text-sm pointer-coarse:h-11" : "h-8 px-3 text-xs pointer-coarse:h-10",
              active ? "text-ivory" : "text-muted hover:text-fg",
            )}
          >
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-xl bg-emerald-nur" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
