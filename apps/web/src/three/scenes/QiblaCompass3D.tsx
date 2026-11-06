import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MathUtils, Object3D, type Group, type InstancedMesh } from "three";
import type { RenderTier } from "@/lib/device";
import { PALETTE } from "../materials/palette";

export interface QiblaCompass3DProps {
  tier: Exclude<RenderTier, "none">;
  /** Azimut kiblat dari utara sejati (derajat). */
  bearing: number;
  /** Heading perangkat (derajat) atau null jika sensor tidak aktif. */
  heading: number | null;
  reducedMotion: boolean;
  active: boolean;
}

const TICKS = 72;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

function shortestAngle(from: number, to: number): number {
  const diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  return from + (diff < -Math.PI ? diff + Math.PI * 2 : diff);
}

function Dial({ bearing, heading, reducedMotion }: { bearing: number; heading: number | null; reducedMotion: boolean }) {
  const dial = useRef<Group>(null);
  const ticks = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  // Matriks tick diisi sekali pada frame pertama setelah instancedMesh tersedia.
  useFrame((_, delta) => {
    if (ticks.current && ticks.current.userData.ready !== true) {
      for (let i = 0; i < TICKS; i++) {
        const a = (i / TICKS) * Math.PI * 2;
        const major = i % 9 === 0;
        dummy.position.set(Math.sin(a) * 2.25, 0.06, -Math.cos(a) * 2.25);
        dummy.rotation.set(0, -a, 0);
        dummy.scale.set(1, 1, major ? 2.2 : 1);
        dummy.updateMatrix();
        ticks.current.setMatrixAt(i, dummy.matrix);
      }
      ticks.current.instanceMatrix.needsUpdate = true;
      ticks.current.userData.ready = true;
    }
    if (!dial.current) return;
    // Dial berputar berlawanan heading agar "U" selalu menunjuk utara sebenarnya.
    const target = heading === null ? 0 : -toRad(heading);
    const current = dial.current.rotation.y;
    const goal = shortestAngle(current, target);
    dial.current.rotation.y = reducedMotion ? goal : MathUtils.damp(current, goal, 5, Math.min(delta, 0.1));
  });

  return (
    <group ref={dial}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.5, 96]} />
        <meshStandardMaterial color={PALETTE.navy} metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.42, 2.52, 96]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.9} roughness={0.25} />
      </mesh>
      <instancedMesh ref={ticks} args={[undefined, undefined, TICKS]}>
        <boxGeometry args={[0.025, 0.02, 0.12]} />
        <meshStandardMaterial color={PALETTE.goldSoft} emissive={PALETTE.gold} emissiveIntensity={0.3} />
      </instancedMesh>
      {/* Penanda utara */}
      <mesh position={[0, 0.08, -1.95]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.14, 0.34, 3]} />
        <meshStandardMaterial color="#e5484d" emissive="#e5484d" emissiveIntensity={0.5} />
      </mesh>
      {/* Jarum kiblat + Ka'bah pada azimut kiblat */}
      <group rotation={[0, -toRad(bearing), 0]}>
        <mesh position={[0, 0.12, -0.95]} rotation={[-Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.07, 1.9, 0.04]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.85} roughness={0.25} emissive={PALETTE.goldDeep} emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, 0.3, -2.0]}>
          <boxGeometry args={[0.36, 0.42, 0.36]} />
          <meshStandardMaterial color="#111111" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.42, -2.0]}>
          <boxGeometry args={[0.37, 0.05, 0.37]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.9} roughness={0.2} emissive={PALETTE.gold} emissiveIntensity={0.4} />
        </mesh>
      </group>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.08, 24]} />
        <meshStandardMaterial color={PALETTE.goldSoft} metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}

/** Kompas kiblat 3D. Arah pandang perangkat ditandai segitiga tetap di atas layar. */
export default function QiblaCompass3D({ tier, bearing, heading, reducedMotion, active }: QiblaCompass3DProps) {
  return (
    <Canvas dpr={tier === "high" ? [1, 2] : [1, 1.5]} frameloop={active ? "always" : "demand"} gl={{ antialias: tier !== "low", alpha: true }} camera={{ position: [0, 7.6, 3.6], fov: 40 }} onCreated={({ camera }) => camera.lookAt(0, 0, -0.5)} style={{ width: "100%", height: "100%" }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 6, 3]} intensity={1.3} />
      <pointLight position={[0, 2, 0]} intensity={6} distance={6} color={PALETTE.gold} />
      <Dial bearing={bearing} heading={heading} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
