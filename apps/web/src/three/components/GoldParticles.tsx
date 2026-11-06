import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, type Points } from "three";
import { seededRandom } from "../lib/geometry";
import { PALETTE } from "../materials/palette";

export interface GoldParticlesProps {
  count: number;
  /** Ukuran volume sebaran [x, y, z]. */
  spread?: [number, number, number];
  center?: [number, number, number];
  size?: number;
  animated?: boolean;
}

/** Partikel cahaya keemasan yang melayang perlahan. Satu draw call. */
export function GoldParticles({ count, spread = [30, 12, 24], center = [0, 5, 0], size = 0.06, animated = true }: GoldParticlesProps) {
  const ref = useRef<Points>(null);
  const { geometry, speeds } = useMemo(() => {
    const random = seededRandom(7);
    const positions = new Float32Array(count * 3);
    const speedArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = center[0] + (random() - 0.5) * spread[0];
      positions[i * 3 + 1] = center[1] + (random() - 0.5) * spread[1];
      positions[i * 3 + 2] = center[2] + (random() - 0.5) * spread[2];
      speedArr[i] = 0.15 + random() * 0.35;
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    return { geometry: geo, speeds: speedArr };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dibandingkan per nilai agar array literal tidak memicu rebuild
  }, [count, spread[0], spread[1], spread[2], center[0], center[1], center[2]]);

  useFrame((_, delta) => {
    if (!animated || !ref.current) return;
    const attr = ref.current.geometry.getAttribute("position") as BufferAttribute;
    const arr = attr.array as Float32Array;
    const top = center[1] + spread[1] / 2;
    const bottom = center[1] - spread[1] / 2;
    const d = Math.min(delta, 0.05);
    for (let i = 0; i < count; i++) {
      const yi = i * 3 + 1;
      let y = (arr[yi] ?? 0) + (speeds[i] ?? 0.2) * d;
      if (y > top) y = bottom;
      arr[yi] = y;
    }
    attr.needsUpdate = true;
    ref.current.rotation.y += d * 0.01;
  });

  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={size} color={PALETTE.goldSoft} transparent opacity={0.85} depthWrite={false} sizeAttenuation blending={AdditiveBlending} />
    </points>
  );
}
