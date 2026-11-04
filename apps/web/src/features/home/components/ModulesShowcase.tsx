import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { ALL_NAV } from "@/app/navigation";
import { SceneBoundary } from "@/three/components/SceneBoundary";
import { SceneLoadingHalo } from "@/three/components/Fallbacks2D";
import { LazyIslamicPortalScene } from "@/three/scenes";
import { useRenderTier } from "@/three/hooks/useRenderTier";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/cn";

const PORTAL_COLORS = ["#087F5B", "#0E9F75", "#D6B56D", "#2B6CB0", "#7C5CBF", "#B48A3C", "#0F766E", "#C2410C", "#E8D6A5", "#15803D"];

const MODULES = ALL_NAV.filter((n) => n.to !== "/dashboard");

/** Portal 3D modul + daftar DOM yang setara (untuk keyboard/screen reader). */
export function ModulesShowcase() {
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const tier = useRenderTier();
  const reducedMotion = useReducedMotion();
  const items = MODULES.map((m, i) => ({ key: m.to, label: m.label, color: PORTAL_COLORS[i % PORTAL_COLORS.length] ?? "#087F5B" }));

  return (
    <section id="modules" className="relative px-5 py-24 sm:px-8 sm:py-32" aria-labelledby="modules-title">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.24em] text-gold-text uppercase">Jelajahi</p>
          <h2 id="modules-title" className="mt-3 text-3xl font-bold sm:text-5xl">
            Satu dunia, banyak pintu.
          </h2>
          <p className="mt-4 text-lg text-muted">Setiap portal membuka satu modul ibadah. Arahkan kursor atau pilih dari daftar.</p>
        </div>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          {tier !== "none" ? (
            <SceneBoundary tier={tier} className="relative h-[340px] sm:h-[440px]" fallback={<SceneLoadingHalo />}>
              {(isActive) =>
                tier !== "none" && (
                  <LazyIslamicPortalScene
                    tier={tier}
                    items={items}
                    activeIndex={active}
                    onHover={setActive}
                    onSelect={(i) => navigate(MODULES[i]?.to ?? "/dashboard")}
                    reducedMotion={reducedMotion}
                    active={isActive}
                  />
                )
              }
            </SceneBoundary>
          ) : null}

          <ul className={cn("grid gap-2 sm:grid-cols-2", tier === "none" && "lg:col-span-2 lg:grid-cols-3")}>
            {MODULES.map((m, i) => (
              <li key={m.to}>
                <Link
                  to={m.to}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={cn(
                    "group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 transition-colors",
                    active === i ? "border-gold/50 bg-surface" : "border-line bg-surface/40 hover:border-gold/30",
                  )}
                >
                  {active === i && <motion.span layoutId="module-active" className="absolute inset-y-2 left-0 w-1 rounded-full bg-gold" />}
                  <m.icon className="size-5 shrink-0 text-gold-text" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-fg">{m.label}</span>
                    <span className="block truncate text-xs text-muted">{m.description}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
