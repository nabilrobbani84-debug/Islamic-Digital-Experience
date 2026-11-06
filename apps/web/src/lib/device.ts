export type RenderTier = "high" | "medium" | "low" | "none";

interface NavigatorWithHints extends Navigator {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
}

let webglCache: { webgl2: boolean; webgl: boolean } | null = null;

export function detectWebGL(): { webgl2: boolean; webgl: boolean } {
  if (webglCache) return webglCache;
  if (typeof document === "undefined") return { webgl2: false, webgl: false };
  try {
    const canvas = document.createElement("canvas");
    const webgl2 = !!canvas.getContext("webgl2");
    const webgl = webgl2 || !!canvas.getContext("webgl");
    webglCache = { webgl2, webgl };
  } catch {
    webglCache = { webgl2: false, webgl: false };
  }
  return webglCache;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Menentukan tingkat rendering 3D berdasarkan kemampuan perangkat.
 * "none" berarti memakai fallback 2D.
 */
export function detectRenderTier(): RenderTier {
  if (typeof window === "undefined") return "none";
  const { webgl, webgl2 } = detectWebGL();
  if (!webgl) return "none";
  const nav = navigator as NavigatorWithHints;
  if (nav.connection?.saveData) return "low";
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const narrow = window.matchMedia?.("(max-width: 767px)").matches ?? false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (!webgl2) return "low";
  if (narrow || coarse) return cores >= 6 && memory >= 4 ? "medium" : "low";
  if (cores >= 8 && memory >= 8) return "high";
  return "medium";
}
