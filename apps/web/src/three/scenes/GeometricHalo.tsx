import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EdgesGeometry, ExtrudeGeometry, IcosahedronGeometry, type Group } from "three";
import type { RenderTier } from "@/lib/device";
import { createStarShape } from "../lib/geometry";
import { PALETTE } from "../materials/palette";

function Halo({ animated }: { animated: boolean }) {
  const group = useRef<Group>(null);
  const edges = useMemo(() => new EdgesGeometry(new IcosahedronGeometry(1.6, 1)), []);
  const star = useMemo(() => new ExtrudeGeometry(createStarShape(8, 0.9, 0.68), { depth: 0.08, bevelEnabled: false }), []);
  useFrame((_, delta) => {
    if (!animated || !group.current) return;
    group.current.rotation.y += Math.min(delta, 0.05) * 0.15;
    group.current.rotation.x += Math.min(delta, 0.05) * 0.05;
  });
  return (
    <group ref={group}>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={PALETTE.gold} transparent opacity={0.55} />
      </lineSegments>
      <mesh geometry={star} position={[0, 0, -0.04]}>
        <meshStandardMaterial color={PALETTE.gold} metalness={0.9} roughness={0.22} emissive={PALETTE.goldDeep} emissiveIntensity={0.35} />
      </mesh>
    </group>
  );
}

export interface GeometricHaloProps {
  tier: Exclude<RenderTier, "none">;
  reducedMotion: boolean;
  active: boolean;
}

/** Visual geometris ringan (Asmaul Husna, header modul). Satu canvas kecil, < 200 draw call. */
export default function GeometricHalo({ tier, reducedMotion, active }: GeometricHaloProps) {
  return (
    <Canvas dpr={[1, tier === "high" ? 2 : 1.5]} frameloop={active && !reducedMotion ? "always" : "demand"} gl={{ antialias: tier !== "low", alpha: true }} camera={{ position: [0, 0, 5], fov: 40 }} style={{ width: "100%", height: "100%" }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 3, 4]} intensity={1.4} />
      <pointLight position={[-2, -1, 3]} intensity={5} color={PALETTE.emerald} />
      <Halo animated={!reducedMotion} />
    </Canvas>
  );
}
