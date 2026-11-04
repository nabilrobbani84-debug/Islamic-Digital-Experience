import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "surface" | "glass" | "accent";
  padded?: boolean;
}

const TONES = {
  surface: "nur-surface",
  glass: "nur-glass",
  accent:
    "border border-gold/20 bg-[radial-gradient(120%_120%_at_0%_0%,rgb(8_127_91/0.35),transparent_55%),var(--nur-surface)] shadow-layer",
} as const;

export function Card({ tone = "surface", padded = true, className, ...rest }: CardProps) {
  return <div className={cn("relative overflow-hidden rounded-3xl", TONES[tone], padded && "p-5 sm:p-6", className)} {...rest} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  as: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  as?: "h2" | "h3";
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-nur/15 text-accent">{icon}</span>}
        <div className="min-w-0">
          <Heading className="text-base font-semibold text-fg">{title}</Heading>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
