import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils, Vector3 } from "three";

export interface CameraKeyframe {
  position: [number, number, number];
  target: [number, number, number];
}

export interface ScrollProgressSource {
  get(): number;
}

export interface ScrollCameraControllerProps {
  keyframes: readonly CameraKeyframe[];
  /** Sumber progres 0..1 (MotionValue dari useScroll, atau objek {get}). */
  progress: ScrollProgressSource | null;
  /** Parallax mengikuti pointer/touch (dinonaktifkan saat reduced motion). */
  parallax?: boolean;
  /** Semakin besar semakin cepat kamera mengejar target (detik^-1). */
  damping?: number;
  /** Ayunan kamera idle yang sangat halus. */
  idle?: boolean;
  /** Animasi pembukaan sinematik (kamera turun dan mendekat) selama beberapa detik pertama. */
  intro?: boolean;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const INTRO_SECONDS = 3.2;

/**
 * Menggerakkan kamera di sepanjang keyframe berdasarkan progres scroll,
 * dengan damping agar tidak pernah bergerak terlalu cepat.
 */
export function ScrollCameraController({ keyframes, progress, parallax = true, damping = 2.2, idle = true, intro = false }: ScrollCameraControllerProps) {
  const camera = useThree((s) => s.camera);
  const desiredPos = useRef(new Vector3());
  const desiredTarget = useRef(new Vector3());
  const lookAt = useRef(new Vector3(...(keyframes[0]?.target ?? [0, 0, 0])));
  const tmpA = useRef(new Vector3());
  const tmpB = useRef(new Vector3());

  const introStart = useRef<number | null>(null);

  useFrame((state, delta) => {
    if (keyframes.length === 0) return;
    const p = MathUtils.clamp(progress?.get() ?? 0, 0, 1);
    const scaled = p * (keyframes.length - 1);
    const index = Math.min(Math.floor(scaled), keyframes.length - 2);
    const local = keyframes.length > 1 ? smooth(scaled - Math.max(0, index)) : 0;
    const a = keyframes[Math.max(0, index)] ?? keyframes[0]!;
    const b = keyframes[Math.max(0, index) + 1] ?? a;

    desiredPos.current.lerpVectors(tmpA.current.set(...a.position), tmpB.current.set(...b.position), local);
    desiredTarget.current.lerpVectors(tmpA.current.set(...a.target), tmpB.current.set(...b.target), local);

    if (parallax) {
      desiredPos.current.x += state.pointer.x * 0.9;
      desiredPos.current.y += state.pointer.y * 0.45;
    }
    if (idle) {
      const t = state.clock.elapsedTime;
      desiredPos.current.y += Math.sin(t * 0.25) * 0.08;
      desiredPos.current.x += Math.cos(t * 0.18) * 0.1;
    }

    if (intro) {
      introStart.current ??= state.clock.elapsedTime;
      const t = Math.min(1, (state.clock.elapsedTime - introStart.current) / INTRO_SECONDS);
      const remaining = (1 - t) ** 3;
      desiredPos.current.y += remaining * 7;
      desiredPos.current.z += remaining * 16;
    }

    const d = Math.min(delta, 0.1);
    camera.position.x = MathUtils.damp(camera.position.x, desiredPos.current.x, damping, d);
    camera.position.y = MathUtils.damp(camera.position.y, desiredPos.current.y, damping, d);
    camera.position.z = MathUtils.damp(camera.position.z, desiredPos.current.z, damping, d);
    lookAt.current.x = MathUtils.damp(lookAt.current.x, desiredTarget.current.x, damping, d);
    lookAt.current.y = MathUtils.damp(lookAt.current.y, desiredTarget.current.y, damping, d);
    lookAt.current.z = MathUtils.damp(lookAt.current.z, desiredTarget.current.z, damping, d);
    camera.lookAt(lookAt.current);
  });

  return null;
}
