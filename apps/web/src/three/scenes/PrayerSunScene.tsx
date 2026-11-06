import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { BufferGeometry, Color, Line, LineDashedMaterial, MathUtils, Vector3, type Mesh, type MeshBasicMaterial } from "three";
import type { RenderTier } from "@/lib/device";
import { PALETTE } from "../materials/palette";

export interface PrayerSunSceneProps {
  tier: Exclude<RenderTier, "none">;
  /** Posisi matahari 0 (terbit) .. 1 (terbenam); <0 atau >1 = malam. */
  dayProgress: number;
  markers: { key: string; t: number }[];
  reducedMotion: boolean;
  active: boolean;
}

const ARC_RADIUS = 4;
const pointOnArc = (t: number): Vector3 => {
  const a = Math.PI * (1 - MathUtils.clamp(t, 0, 1));
  return new Vector3(Math.cos(a) * ARC_RADIUS, Math.sin(a) * ARC_RADIUS * 0.75 - 1.2, 0);
};

function Sun({ dayProgress, reducedMotion }: { dayProgress: number; reducedMotion: boolean }) {
  const ref = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const target = pointOnArc(dayProgress);
    const d = Math.min(delta, 0.1);
    ref.current.position.x = reducedMotion ? target.x : MathUtils.damp(ref.current.position.x, target.x, 3, d);
    ref.current.position.y = reducedMotion ? target.y : MathUtils.damp(ref.current.position.y, target.y, 3, d);
    halo.current?.position.copy(ref.current.position);
    const night = dayProgress < 0 || dayProgress > 1;
    (ref.current.material as MeshBasicMaterial).color.lerp(new Color(night ? PALETTE.moon : "#ffd27a"), 0.1);
  });
  return (
    <>
      <mesh ref={ref} position={pointOnArc(dayProgress)}>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      <mesh ref={halo}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshBasicMaterial color={PALETTE.gold} transparent opacity={0.15} depthWrite={false} />
      </mesh>
    </>
  );
}

/** Lintasan matahari dari terbit ke terbenam dengan penanda waktu sholat. */
export default function PrayerSunScene({ tier, dayProgress, markers, reducedMotion, active }: PrayerSunSceneProps) {
  const arc = useMemo(() => {
    const geometry = new BufferGeometry().setFromPoints(Array.from({ length: 65 }, (_, i) => pointOnArc(i / 64)));
    const line = new Line(geometry, new LineDashedMaterial({ color: PALETTE.gold, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity: 0.5 }));
    line.computeLineDistances();
    return line;
  }, []);
  const night = dayProgress < 0 || dayProgress > 1;
  return (
    <Canvas dpr={tier === "high" ? [1, 2] : [1, 1.5]} frameloop={active ? "always" : "never"} gl={{ antialias: tier !== "low", alpha: true }} camera={{ position: [0, 0.4, 7.4], fov: 45 }} style={{ width: "100%", height: "100%" }}>
      {night && <Stars radius={20} depth={8} count={500} factor={2} fade speed={reducedMotion ? 0 : 0.3} />}
      <primitive object={arc} />
      <mesh position={[0, -1.25, 0]}>
        <boxGeometry args={[10, 0.015, 0.015]} />
        <meshBasicMaterial color={PALETTE.goldSoft} transparent opacity={0.4} />
      </mesh>
      {markers.map((m) => (
        <mesh key={m.key} position={pointOnArc(m.t)}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial color={PALETTE.goldSoft} />
        </mesh>
      ))}
      <Sun dayProgress={dayProgress} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
