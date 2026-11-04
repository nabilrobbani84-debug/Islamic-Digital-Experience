import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor, Stars } from "@react-three/drei";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import type { RenderTier } from "@/lib/device";
import { tierConfig } from "../hooks/useRenderTier";
import { MosqueEnvironment } from "../components/MosqueEnvironment";
import { GoldParticles } from "../components/GoldParticles";
import { FloatingGeometry } from "../components/FloatingGeometry";
import { Moon, ReflectiveFloor, SkyDome } from "../components/Atmosphere";
import { ScrollCameraController, type CameraKeyframe, type ScrollProgressSource } from "../controllers/ScrollCameraController";
import { PALETTE } from "../materials/palette";

/** Jalur kamera sinematik: wide establishing → mendekati fasad → naik ke kubah → menara. */
export const HERO_KEYFRAMES: readonly CameraKeyframe[] = [
  { position: [0, 3.4, 22], target: [0, 4, 0] },
  { position: [6.5, 2.4, 11], target: [0, 2.6, 1] },
  { position: [-5, 9, 9], target: [0, 6.5, -0.4] },
  { position: [-11, 4.5, 6], target: [-7, 6, 3] },
  { position: [0, 13, 18], target: [0, 4, 0] },
];

export interface IslamicHeroSceneProps {
  tier: Exclude<RenderTier, "none">;
  progress: ScrollProgressSource | null;
  reducedMotion: boolean;
  active: boolean;
}

/** Scene utama landing: masjid procedural, langit malam, partikel emas, lantai reflektif. */
export default function IslamicHeroScene({ tier, progress, reducedMotion, active }: IslamicHeroSceneProps) {
  const config = tierConfig(tier);
  const [dpr, setDpr] = useState(config.dpr[1]);
  const animated = !reducedMotion;

  return (
    <Canvas
      dpr={dpr}
      shadows={config.shadows}
      frameloop={active ? "always" : "never"}
      gl={{ antialias: config.antialias, powerPreference: "high-performance", alpha: false, stencil: false }}
      camera={{ position: [0, 3.4, 22], fov: 42, near: 0.1, far: 260 }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.outputColorSpace = SRGBColorSpace;
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <PerformanceMonitor
        bounds={() => (tier === "high" ? [50, 60] : [28, 45])}
        onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(config.dpr[1], d + 0.25))}
        flipflops={3}
        onFallback={() => setDpr(0.75)}
      />
      <color attach="background" args={[PALETTE.night]} />
      <fog attach="fog" args={[PALETTE.night, 28, 95]} />
      <SkyDome />
      <Stars radius={90} depth={30} count={tier === "low" ? 900 : 2600} factor={3} saturation={0} fade speed={animated ? 0.4 : 0} />
      <Moon />

      <hemisphereLight args={["#2b4a6b", "#0a0f1a", 0.55]} />
      <directionalLight
        position={[-14, 22, 10]}
        intensity={1.25}
        color="#cfdcff"
        castShadow={config.shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0004}
      />
      <pointLight position={[0, 12, 6]} intensity={30} distance={40} color={PALETTE.gold} decay={2} />

      <MosqueEnvironment segments={config.segments} shadows={config.shadows} />
      <ReflectiveFloor reflections={config.reflections} />
      <GoldParticles count={config.particles} animated={animated} />
      <FloatingGeometry count={config.floating} animated={animated} />

      <ScrollCameraController keyframes={HERO_KEYFRAMES} progress={progress} parallax={animated} idle={animated} damping={reducedMotion ? 6 : 2.2} />
    </Canvas>
  );
}
