import { useMemo } from "react";
import { DoubleSide, ExtrudeGeometry, LatheGeometry } from "three";
import { createArchFillShape, createArchShape, onionDomeProfile } from "../lib/geometry";
import { GOLD_MATERIAL, PALETTE, STONE_MATERIAL } from "../materials/palette";

interface MosqueProps {
  segments: number;
  shadows: boolean;
}

function Minaret({ position, segments, shadows, height = 7 }: { position: [number, number, number]; segments: number; shadows: boolean; height?: number }) {
  const seg = Math.max(12, Math.floor(segments / 2));
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow={shadows} receiveShadow={shadows}>
        <cylinderGeometry args={[0.46, 0.5, 0.7, seg]} />
        <meshStandardMaterial {...STONE_MATERIAL} color={PALETTE.stoneShade} />
      </mesh>
      <mesh position={[0, 0.7 + height / 2, 0]} castShadow={shadows}>
        <cylinderGeometry args={[0.26, 0.32, height, seg]} />
        <meshStandardMaterial {...STONE_MATERIAL} />
      </mesh>
      {[0.45, 0.78].map((f) => (
        <mesh key={f} position={[0, 0.7 + height * f, 0]} castShadow={shadows}>
          <cylinderGeometry args={[0.44, 0.36, 0.16, seg]} />
          <meshStandardMaterial {...GOLD_MATERIAL} />
        </mesh>
      ))}
      <mesh position={[0, 0.7 + height + 0.55, 0]} castShadow={shadows}>
        <coneGeometry args={[0.32, 1.1, seg]} />
        <meshStandardMaterial {...GOLD_MATERIAL} />
      </mesh>
      <mesh position={[0, 0.7 + height + 1.2, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={PALETTE.goldSoft} emissive={PALETTE.gold} emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function Dome({ radius, height, position, segments, shadows }: { radius: number; height: number; position: [number, number, number]; segments: number; shadows: boolean }) {
  const geometry = useMemo(() => new LatheGeometry(onionDomeProfile(radius, height), segments), [radius, height, segments]);
  return (
    <group position={position}>
      <mesh geometry={geometry} castShadow={shadows}>
        <meshStandardMaterial {...GOLD_MATERIAL} side={DoubleSide} />
      </mesh>
      <mesh position={[0, height + 0.32, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.64, 8]} />
        <meshStandardMaterial {...GOLD_MATERIAL} />
      </mesh>
      <mesh position={[0, height + 0.75, 0]} rotation={[0, 0, Math.PI / 2.4]}>
        <torusGeometry args={[0.16, 0.035, 8, 24, Math.PI * 1.4]} />
        <meshStandardMaterial color={PALETTE.goldSoft} emissive={PALETTE.gold} emissiveIntensity={0.6} metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

function ArchRow({ count, width, height, z, y, spacing }: { count: number; width: number; height: number; z: number; y: number; spacing: number }) {
  const frame = useMemo(() => new ExtrudeGeometry(createArchShape(width, height, 0.08), { depth: 0.12, bevelEnabled: false }), [width, height]);
  const fill = useMemo(() => new ExtrudeGeometry(createArchFillShape(width, height), { depth: 0.02, bevelEnabled: false }), [width, height]);
  const start = -((count - 1) * spacing) / 2;
  return (
    <group position={[0, y, z]}>
      {Array.from({ length: count }, (_, i) => (
        <group key={i} position={[start + i * spacing, 0, 0]}>
          <mesh geometry={frame}>
            <meshStandardMaterial {...GOLD_MATERIAL} roughness={0.4} />
          </mesh>
          <mesh geometry={fill} position={[0, 0, -0.04]}>
            <meshStandardMaterial color={PALETTE.windowGlow} emissive={PALETTE.windowGlow} emissiveIntensity={i === Math.floor(count / 2) ? 1.6 : 0.9} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Arsitektur masjid procedural (tanpa aset eksternal), skala dunia ~16 unit. */
export function MosqueEnvironment({ segments, shadows }: MosqueProps) {
  return (
    <group position={[0, 0, 0]}>
      {/* Pelataran bertingkat */}
      <mesh position={[0, 0.15, 0]} receiveShadow={shadows} castShadow={shadows}>
        <boxGeometry args={[17, 0.3, 12]} />
        <meshStandardMaterial {...STONE_MATERIAL} color={PALETTE.stoneShade} />
      </mesh>
      <mesh position={[0, 0.42, 0.2]} receiveShadow={shadows} castShadow={shadows}>
        <boxGeometry args={[14, 0.24, 9]} />
        <meshStandardMaterial {...STONE_MATERIAL} />
      </mesh>

      {/* Ruang utama */}
      <mesh position={[0, 2.04, -0.4]} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[8, 3.0, 5.6]} />
        <meshStandardMaterial {...STONE_MATERIAL} />
      </mesh>
      {/* Lis emas atap */}
      <mesh position={[0, 3.6, -0.4]}>
        <boxGeometry args={[8.2, 0.12, 5.8]} />
        <meshStandardMaterial {...GOLD_MATERIAL} />
      </mesh>
      {/* Drum kubah */}
      <mesh position={[0, 4.05, -0.4]} castShadow={shadows}>
        <cylinderGeometry args={[2.05, 2.15, 0.8, segments]} />
        <meshStandardMaterial {...STONE_MATERIAL} />
      </mesh>
      <ArchRow count={5} width={0.62} height={1.1} z={2.42} y={0.8} spacing={1.35} />
      <ArchRow count={8} width={0.26} height={0.42} z={1.72} y={3.82} spacing={0.5} />
      <Dome radius={2.05} height={3.1} position={[0, 4.45, -0.4]} segments={segments} shadows={shadows} />

      {/* Sayap samping dengan kubah kecil */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 5.3, 0, 0]}>
          <mesh position={[0, 1.55, -0.2]} castShadow={shadows} receiveShadow={shadows}>
            <boxGeometry args={[2.6, 2.0, 4.2]} />
            <meshStandardMaterial {...STONE_MATERIAL} />
          </mesh>
          <ArchRow count={2} width={0.5} height={0.9} z={1.92} y={0.6} spacing={1.1} />
          <Dome radius={0.95} height={1.4} position={[0, 2.55, -0.2]} segments={Math.max(16, segments / 2)} shadows={shadows} />
        </group>
      ))}

      {/* Empat menara */}
      <Minaret position={[-7.4, 0.3, 4.2]} segments={segments} shadows={shadows} />
      <Minaret position={[7.4, 0.3, 4.2]} segments={segments} shadows={shadows} />
      <Minaret position={[-7.4, 0.3, -4.6]} segments={segments} shadows={shadows} height={6.2} />
      <Minaret position={[7.4, 0.3, -4.6]} segments={segments} shadows={shadows} height={6.2} />

      {/* Cahaya hangat dari dalam masjid */}
      <pointLight position={[0, 2, 3.2]} intensity={6} distance={9} color={PALETTE.windowGlow} decay={2} />
    </group>
  );
}
