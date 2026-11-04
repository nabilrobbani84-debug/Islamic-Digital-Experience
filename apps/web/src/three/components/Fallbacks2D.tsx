import { cn } from "@/lib/cn";

/** Fallback 2D hero: siluet masjid SVG + langit gradient. Dipakai saat WebGL tidak tersedia atau 3D dimatikan. */
export function HeroFallback2D({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[radial-gradient(120%_80%_at_50%_100%,#14324a_0%,#0b1a2e_35%,#03060d_80%)]", className)} data-testid="hero-fallback">
      <div className="nur-pattern absolute inset-0 opacity-60" />
      <div className="absolute top-[12%] left-[18%] size-16 rounded-full bg-[#f6eed3] shadow-[0_0_80px_30px_rgb(232_214_165/0.25)]" />
      <svg viewBox="0 0 800 400" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[62%] w-full" aria-hidden>
        <defs>
          <linearGradient id="nur-dome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E8D6A5" />
            <stop offset="1" stopColor="#B48A3C" />
          </linearGradient>
          <linearGradient id="nur-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2c44" />
            <stop offset="1" stopColor="#0b1324" />
          </linearGradient>
        </defs>
        <g fill="url(#nur-wall)">
          <rect x="120" y="120" width="22" height="260" />
          <rect x="658" y="120" width="22" height="260" />
          <rect x="230" y="250" width="340" height="130" />
          <rect x="160" y="290" width="90" height="90" />
          <rect x="550" y="290" width="90" height="90" />
        </g>
        <g fill="url(#nur-dome)">
          <path d="M131 70 l14 50 h-28 z" />
          <path d="M669 70 l14 50 h-28 z" />
          <path d="M290 250 C290 170 340 130 400 96 C460 130 510 170 510 250 Z" />
          <path d="M175 290 C175 262 190 248 205 238 C220 248 235 262 235 290 Z" />
          <path d="M565 290 C565 262 580 248 595 238 C610 248 625 262 625 290 Z" />
        </g>
        <g fill="#ffcf7a" opacity="0.85">
          {[300, 350, 400, 450, 500].map((x) => (
            <path key={x} d={`M${x - 14} 380 v-50 q14 -26 28 0 v50 z`} />
          ))}
        </g>
        <rect x="0" y="380" width="800" height="20" fill="#0b1526" />
      </svg>
    </div>
  );
}

export function SceneLoadingHalo({ className }: { className?: string }) {
  return (
    <div className={cn("grid h-full w-full place-items-center", className)} aria-hidden>
      <svg viewBox="0 0 100 100" className="size-24 animate-[spin_12s_linear_infinite] text-gold/70" fill="none" stroke="currentColor" strokeWidth="1.2">
        <rect x="25" y="25" width="50" height="50" />
        <rect x="25" y="25" width="50" height="50" transform="rotate(45 50 50)" />
        <circle cx="50" cy="50" r="12" />
      </svg>
    </div>
  );
}
