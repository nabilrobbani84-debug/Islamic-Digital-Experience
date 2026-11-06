import { useMemo } from "react";
import { MeshReflectorMaterial } from "@react-three/drei";
import { BackSide, Color } from "three";
import { PALETTE } from "../materials/palette";

/** Kubah langit gradient atmosfer malam (shader ringan, tanpa tekstur). */
export function SkyDome() {
  const uniforms = useMemo(
    () => ({
      topColor: { value: new Color("#03060d") },
      midColor: { value: new Color("#0b1a2e") },
      horizonColor: { value: new Color(PALETTE.horizon) },
      glowColor: { value: new Color("#3a3a2a") },
    }),
    [],
  );
  return (
    <mesh scale={[1, 1, 1]} renderOrder={-1}>
      <sphereGeometry args={[110, 32, 16]} />
      <shaderMaterial
        side={BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vWorld;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xyz;
            gl_Position = projectionMatrix * viewMatrix * world;
          }
        `}
        fragmentShader={`
          uniform vec3 topColor;
          uniform vec3 midColor;
          uniform vec3 horizonColor;
          uniform vec3 glowColor;
          varying vec3 vWorld;
          void main() {
            float h = normalize(vWorld).y;
            vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.25, h));
            col = mix(col, topColor, smoothstep(0.25, 0.85, h));
            float glow = exp(-abs(h) * 9.0) * 0.55;
            col += glowColor * glow;
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
}

export function Moon() {
  return (
    <group position={[-22, 26, -60]}>
      <mesh>
        <sphereGeometry args={[2.6, 32, 32]} />
        <meshBasicMaterial color={PALETTE.moon} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[4.2, 32, 32]} />
        <meshBasicMaterial color={PALETTE.goldSoft} transparent opacity={0.08} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function ReflectiveFloor({ reflections }: { reflections: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[160, 160]} />
      {reflections ? (
        <MeshReflectorMaterial
          resolution={512}
          mirror={0.45}
          blur={[320, 90]}
          mixBlur={1}
          mixStrength={1.6}
          roughness={0.85}
          depthScale={0.9}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#0a1322"
          metalness={0.55}
        />
      ) : (
        <meshStandardMaterial color="#0b1526" roughness={0.55} metalness={0.35} />
      )}
    </mesh>
  );
}
