import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ExtrudeGeometry, MathUtils, ShapeGeometry, type Group, type Mesh, type MeshStandardMaterial } from "three";
import type { RenderTier } from "@/lib/device";
import { createArchFillShape, createArchShape } from "../lib/geometry";
import { GoldParticles } from "../components/GoldParticles";
import { PALETTE } from "../materials/palette";

export interface PortalItem {
  key: string;
  label: string;
  color: string;
}

export interface IslamicPortalSceneProps {
  tier: Exclude<RenderTier, "none">;
  items: readonly PortalItem[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
  reducedMotion: boolean;
  active: boolean;
}

function Portal({ item, index, total, activeIndex, onHover, onSelect, animated }: { item: PortalItem; index: number; total: number; activeIndex: number; onHover: (i: number) => void; onSelect: (i: number) => void; animated: boolean }) {
  const group = useRef<Group>(null);
  const fillRef = useRef<Mesh>(null);
  const frame = useMemo(() => new ExtrudeGeometry(createArchShape(1.1, 1.9, 0.12), { depth: 0.16, bevelEnabled: false }), []);
  const fill = useMemo(() => new ShapeGeometry(createArchFillShape(1.1, 1.9)), []);
  const angle = ((index - (total - 1) / 2) / total) * Math.PI * 0.95;
  const radius = 6.2;

  useFrame((state, delta) => {
    if (!group.current || !fillRef.current) return;
    const isActive = index === activeIndex;
    const target = isActive ? 1.16 : 1;
    const d = Math.min(delta, 0.1);
    const s = MathUtils.damp(group.current.scale.x, target, 6, d);
    group.current.scale.setScalar(s);
    const material = fillRef.current.material as MeshStandardMaterial;
    material.emissiveIntensity = MathUtils.damp(material.emissiveIntensity, isActive ? 1.8 : 0.55, 5, d);
    if (animated) group.current.position.y = Math.sin(state.clock.elapsedTime * 0.8 + index) * 0.06;
  });

  return (
    <group position={[Math.sin(angle) * radius, 0, -Math.cos(angle) * radius + radius - 1.5]} rotation={[0, -angle, 0]}>
      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(index);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
      >
        <mesh geometry={frame} position={[0, -0.95, -0.08]}>
          <meshStandardMaterial color={PALETTE.gold} metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh ref={fillRef} geometry={fill} position={[0, -0.95, 0]}>
          <meshStandardMaterial color={item.color} emissive={item.color} emissiveIntensity={0.55} transparent opacity={0.92} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/** Lengkung portal 3D interaktif menuju modul-modul NUR. Navigasi utama tetap tersedia di DOM. */
export default function IslamicPortalScene({ tier, items, activeIndex, onHover, onSelect, reducedMotion, active }: IslamicPortalSceneProps) {
  return (
    <Canvas
      dpr={tier === "high" ? [1, 2] : [1, 1.5]}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: tier !== "low", alpha: true }}
      camera={{ position: [0, 0.6, 8.5], fov: 45 }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 6, 6]} intensity={1.2} />
      <pointLight position={[0, 2, 3]} intensity={12} distance={14} color={PALETTE.gold} />
      {items.map((item, i) => (
        <Portal key={item.key} item={item} index={i} total={items.length} activeIndex={activeIndex} onHover={onHover} onSelect={onSelect} animated={!reducedMotion} />
      ))}
      <GoldParticles count={tier === "low" ? 80 : 220} spread={[16, 6, 6]} center={[0, 0.5, 1]} size={0.045} animated={!reducedMotion} />
    </Canvas>
  );
}
