import { Link } from "react-router";
import { cn } from "@/lib/cn";

export function NurMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id="nur-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#E8D6A5" />
          <stop offset="1" stopColor="#B48A3C" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#nur-mark)" strokeWidth="1.8" strokeLinejoin="round">
        <rect x="10" y="10" width="20" height="20" rx="1" />
        <rect x="10" y="10" width="20" height="20" rx="1" transform="rotate(45 20 20)" />
      </g>
      <circle cx="20" cy="20" r="4.2" fill="#E8D6A5" />
    </svg>
  );
}

export function NurLogo({ to = "/", className, compact = false }: { to?: string; className?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn("group inline-flex items-center gap-2.5 rounded-xl", className)} aria-label="NUR — beranda">
      <NurMark className="transition-transform duration-500 ease-nur group-hover:rotate-45" />
      {!compact && (
        <span className="leading-none">
          <span className="block text-lg font-bold tracking-[0.28em] text-fg">NUR</span>
          <span className="block text-[10px] tracking-[0.18em] text-muted uppercase">Islamic Digital Experience</span>
        </span>
      )}
    </Link>
  );
}
