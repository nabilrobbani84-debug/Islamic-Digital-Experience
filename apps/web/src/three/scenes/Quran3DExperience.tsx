import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { DoubleSide, MathUtils, PlaneGeometry, type Group } from "three";
import type { RenderTier } from "@/lib/device";
import { GoldParticles } from "../components/GoldParticles";
import { PALETTE } from "../materials/palette";

/** Halaman melengkung (vertex dibengkokkan di sumbu X) agar mushaf terlihat terbuka alami. */
function usePageGeometry(): PlaneGeometry {
  return useMemo(() => {
    const geo = new PlaneGeometry(1.5, 2.1, 24, 1);
    const pos = geo.attributes.position;
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const t = (x + 0.75) / 1.5;
        pos.setZ(i, Math.sin(t * Math.PI) * 0.12 - t * 0.05);
      }
      pos.needsUpdate = true;
    }
    geo.computeVertexNormals();
    geo.translate(0.75, 0, 0);
    return geo;
  }, []);
}

function OpenMushaf({ animated }: { animated: boolean }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const page = usePageGeometry();

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    const open = 0.18;
    if (left.current) left.current.rotation.y = animated ? MathUtils.damp(left.current.rotation.y, Math.PI - open, 2.2, d) : Math.PI - open;
    if (right.current) right.current.rotation.y = animated ? MathUtils.damp(right.current.rotation.y, open, 2.2, d) : open;
  });

  return (
    <group rotation={[-0.55, 0, 0]} position={[0, 0.2, 0]}>
      {/* Rehal (penyangga mushaf) */}
      <mesh position={[0, -0.9, -0.25]} rotation={[0.6, 0, 0]}>
        <boxGeometry args={[3.4, 0.06, 1.6]} />
        <meshStandardMaterial color="#5b3b22" roughness={0.6} />
      </mesh>
      {/* Sampul */}
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[3.2, 2.25, 0.04]} />
        <meshStandardMaterial color={PALETTE.emeraldDeep} roughness={0.5} metalness={0.2} />
      </mesh>
      <group ref={left} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={page}>
          <meshStandardMaterial color="#f4ecd8" roughness={0.9} side={DoubleSide} />
        </mesh>
      </group>
      <group ref={right} rotation={[0, Math.PI / 2, 0]}>
        <mesh geometry={page}>
          <meshStandardMaterial color="#f7f0de" roughness={0.9} side={DoubleSide} />
        </mesh>
      </group>
      {/* Bingkai emas di halaman */}
      {[-0.82, 0.82].map((x) => (
        <mesh key={x} position={[x, 0, 0.1]}>
          <torusGeometry args={[0.42, 0.012, 6, 48]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.9} roughness={0.2} emissive={PALETTE.goldDeep} emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

export interface Quran3DExperienceProps {
  tier: Exclude<RenderTier, "none">;
  reducedMotion: boolean;
  active: boolean;
}

/** Mushaf 3D dengan animasi pembukaan lembut untuk header halaman Al-Qur'an. */
export default function Quran3DExperience({ tier, reducedMotion, active }: Quran3DExperienceProps) {
  return (
    <Canvas dpr={tier === "high" ? [1, 2] : [1, 1.5]} frameloop={active ? "always" : "never"} gl={{ antialias: tier !== "low", alpha: true }} camera={{ position: [0, 0.6, 5.2], fov: 40 }} style={{ width: "100%", height: "100%" }}>
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 5]} intensity={1.4} color="#fff5e0" />
      <pointLight position={[0, 1.2, 1.6]} intensity={6} distance={6} color={PALETTE.gold} />
      <Float speed={reducedMotion ? 0 : 1.2} rotationIntensity={reducedMotion ? 0 : 0.18} floatIntensity={reducedMotion ? 0 : 0.35}>
        <OpenMushaf animated={!reducedMotion} />
      </Float>
      <GoldParticles count={tier === "low" ? 60 : 160} spread={[6, 3.5, 3]} center={[0, 0.6, 0]} size={0.035} animated={!reducedMotion} />
    </Canvas>
  );
}
