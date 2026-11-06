import { useCallback, useState, type MouseEvent } from "react";
import { motion } from "framer-motion";
import { ProgressRing } from "@/components/ui/misc";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/cn";

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export interface DhikrCounterProps {
  count: number;
  target: number;
  label: string;
  onIncrement: () => void;
  size?: number;
}

/** Tombol hitung besar dengan progress ring, efek ripple, dan getaran halus (jika didukung). */
export function DhikrCounter({ count, target, label, onIncrement, size = 280 }: DhikrCounterProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const reduced = useReducedMotion();
  const done = count >= target;

  const press = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      onIncrement();
      navigator.vibrate?.(count + 1 === target ? [30, 60, 30] : 8);
      // detail 0 = aktivasi keyboard/pembaca layar: tanpa ripple posisi pointer.
      if (reduced || e.detail === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ripple = { id: Date.now() + Math.random(), x: e.clientX - rect.left, y: e.clientY - rect.top };
      setRipples((r) => [...r.slice(-4), ripple]);
      window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== ripple.id)), 650);
    },
    [count, onIncrement, reduced, target],
  );

  return (
    <ProgressRing value={target > 0 ? Math.min(1, count / target) : 0} size={size} stroke={10} label={`Progres ${label}`}>
      <motion.button
        type="button"
        whileTap={reduced ? undefined : { scale: 0.96 }}
        onClick={(e) => press(e)}
        onKeyDown={(e) => {
          // Cegah hitungan berulang otomatis saat tombol keyboard ditahan.
          if (e.repeat && (e.key === " " || e.key === "Enter")) e.preventDefault();
        }}
        aria-label={`Tambah hitungan. ${count} dari ${target}`}
        aria-describedby="dhikr-count"
        className={cn(
          "relative grid place-items-center overflow-hidden rounded-full border select-none touch-manipulation",
          done ? "border-gold/60 bg-gradient-to-b from-gold/25 to-emerald-deep/40" : "border-emerald-nur/40 bg-gradient-to-b from-emerald-nur/30 to-emerald-deep/30",
        )}
        style={{ width: size - 44, height: size - 44 }}
      >
        {ripples.map((r) => (
          <span key={r.id} aria-hidden className="pointer-events-none absolute size-24 rounded-full bg-gold-soft/40" style={{ left: r.x - 48, top: r.y - 48, animation: "nur-ripple 650ms ease-out forwards" }} />
        ))}
        <span className="relative text-center">
          <span id="dhikr-count" className="block text-6xl font-bold text-fg tabular-nums sm:text-7xl" aria-live="polite" aria-atomic="true">
            {count}
          </span>
          <span className="mt-1 block text-sm text-muted">dari {target}</span>
        </span>
      </motion.button>
    </ProgressRing>
  );
}
