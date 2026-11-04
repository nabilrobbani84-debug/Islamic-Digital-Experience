import { Component, Suspense, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import type { RenderTier } from "@/lib/device";

interface BoundaryState {
  failed: boolean;
}

class SceneErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode; onError?: () => void }, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.warn("[NUR 3D] scene gagal, memakai fallback 2D", error, info.componentStack);
    this.props.onError?.();
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export interface SceneBoundaryProps {
  tier: RenderTier;
  /** Tampilan 2D yang dipakai saat WebGL tidak tersedia, gagal, atau sedang memuat. */
  fallback: ReactNode;
  /** Render scene. `active` false saat scene di luar viewport (render loop dihentikan). */
  children: (active: boolean) => ReactNode;
  className?: string;
  /** Deskripsi untuk dokumentasi; scene 3D selalu aria-hidden karena konten utama ada di DOM, fallback 2D membawa label sendiri. */
  label?: string;
}

/**
 * Pembungkus setiap scene 3D:
 * - lazy loading lewat Suspense (fallback 2D saat chunk three.js dimuat),
 * - error boundary + webglcontextlost → fallback 2D,
 * - IntersectionObserver untuk menghentikan render loop saat tidak terlihat.
 */
export function SceneBoundary({ tier, fallback, children, className }: SceneBoundaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setActive(entry?.isIntersecting ?? true), { rootMargin: "120px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onLost = (e: Event): void => {
      e.preventDefault();
      setLost(true);
    };
    el.addEventListener("webglcontextlost", onLost, true);
    return () => el.removeEventListener("webglcontextlost", onLost, true);
  }, []);

  const use3D = tier !== "none" && !lost;

  return (
    <div ref={ref} className={className} aria-hidden={use3D ? true : undefined} data-scene-mode={use3D ? "3d" : "2d"}>
      {use3D ? (
        <SceneErrorBoundary fallback={fallback} onError={() => setLost(true)}>
          <Suspense fallback={fallback}>{children(active)}</Suspense>
        </SceneErrorBoundary>
      ) : (
        fallback
      )}
    </div>
  );
}
