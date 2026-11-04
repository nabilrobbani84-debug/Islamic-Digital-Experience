import { useMemo } from "react";
import { Float } from "@react-three/drei";
import { ExtrudeGeometry } from "three";
import { createStarShape, seededRandom } from "../lib/geometry";
import { PALETTE } from "../materials/palette";

export interface FloatingGeometryProps {
  count: number;
  animated?: boolean;
  radius?: number;
  height?: [number, number];
}

/** Ornamen bintang delapan (Rub el Hizb) yang melayang halus di sekitar scene. */
export function FloatingGeometry({ count, animated = true, radius = 11, height = [4, 10] }: FloatingGeometryProps) {
  const geometry = useMemo(
    () => new ExtrudeGeometry(createStarShape(8, 0.5, 0.38), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }),
    [],
  );
  const items = useMemo(() => {
    const random = seededRandom(42);
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + random() * 0.5;
      const r = radius * (0.7 + random() * 0.4);
      return {
        position: [Math.cos(angle) * r, height[0] + random() * (height[1] - height[0]), Math.sin(angle) * r * 0.6 - 2] as [number, number, number],
        scale: 0.5 + random() * 0.9,
        rotation: [random() * Math.PI, random() * Math.PI, 0] as [number, number, number],
        speed: 0.6 + random() * 0.8,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dibandingkan per nilai
  }, [count, radius, height[0], height[1]]);

  return (
    <group>
      {items.map((item, i) => (
        <Float key={i} speed={animated ? item.speed : 0} rotationIntensity={animated ? 0.6 : 0} floatIntensity={animated ? 0.8 : 0}>
          <mesh geometry={geometry} position={item.position} rotation={item.rotation} scale={item.scale}>
            <meshStandardMaterial color={PALETTE.gold} metalness={0.9} roughness={0.25} emissive={PALETTE.goldDeep} emissiveIntensity={0.25} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}
