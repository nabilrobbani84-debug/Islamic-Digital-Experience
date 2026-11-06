import { useState } from "react";
import { detectRenderTier, type RenderTier } from "@/lib/device";
import { usePreferences } from "@/stores/preferences";

function forcedOff(): boolean {
  if (typeof window === "undefined") return true;
  return new URLSearchParams(window.location.search).get("3d") === "off";
}

/**
 * Tingkat rendering 3D yang dipakai. "none" = fallback 2D.
 * Pengguna dapat mematikan 3D di Pengaturan, dan `?3d=off` memaksa fallback (untuk pengujian).
 */
export function useRenderTier(): RenderTier {
  const preference = usePreferences((s) => s.experience3D);
  const [detected] = useState<RenderTier>(() => (forcedOff() ? "none" : detectRenderTier()));
  return preference === "off" ? "none" : detected;
}

export interface TierConfig {
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  particles: number;
  segments: number;
  reflections: boolean;
  floating: number;
}

export function tierConfig(tier: Exclude<RenderTier, "none">): TierConfig {
  switch (tier) {
    case "high":
      return { dpr: [1, 2], antialias: true, shadows: true, particles: 900, segments: 64, reflections: true, floating: 9 };
    case "medium":
      return { dpr: [1, 1.5], antialias: true, shadows: false, particles: 500, segments: 40, reflections: false, floating: 6 };
    case "low":
      return { dpr: [1, 1], antialias: false, shadows: false, particles: 180, segments: 24, reflections: false, floating: 3 };
  }
}
