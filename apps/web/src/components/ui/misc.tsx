import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn("skeleton rounded-xl", className)} {...rest} />;
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "gold" | "emerald" | "warning" | "danger"; className?: string }) {
  const tones = {
    neutral: "bg-surface-2 text-muted border-line",
    gold: "bg-gold/10 text-gold-text border-gold/30",
    emerald: "bg-emerald-nur/12 text-accent border-emerald-nur/30",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30",
    danger: "bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30",
  } as const;
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export interface ProgressRingProps {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  children?: ReactNode;
  className?: string;
}

export function ProgressRing({ value, size = 120, stroke = 8, label, children, className }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="nur-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E8D6A5" />
            <stop offset="100%" stopColor="#087F5B" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--nur-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#nur-ring-gradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ transition: "stroke-dashoffset 400ms cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(clamped * 100)} className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div className="h-full rounded-full bg-gradient-to-r from-emerald-nur to-gold transition-[width] duration-500 ease-nur" style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function GeometricDivider({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-gold/60", className)} aria-hidden>
      <span className="nur-gold-line flex-1" />
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="6" y="6" width="12" height="12" />
        <rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" />
      </svg>
      <span className="nur-gold-line flex-1" />
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, arabic }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode; arabic?: string }) {
  return (
    <header className="relative mb-8 flex flex-col gap-5 sm:mb-10 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-xs font-semibold tracking-[0.22em] text-gold-text uppercase">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-base text-muted">{description}</p>}
      </div>
      {arabic && (
        <p lang="ar" className="hidden text-4xl text-gold-text/80 md:block" aria-hidden>
          {arabic}
        </p>
      )}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
