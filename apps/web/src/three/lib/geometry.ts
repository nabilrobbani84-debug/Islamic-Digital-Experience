import { Shape, Vector2 } from "three";

/** Bintang bersudut `points` (8 = motif Rub el Hizb) sebagai Shape untuk ExtrudeGeometry. */
export function createStarShape(points = 8, outer = 1, inner = 0.72): Shape {
  const shape = new Shape();
  const total = points * 2;
  for (let i = 0; i <= total; i++) {
    const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

/** Profil kubah bawang (onion dome) untuk LatheGeometry. */
export function onionDomeProfile(radius = 2, height = 3): Vector2[] {
  const pts: [number, number][] = [
    [0, 0],
    [1, 0],
    [1.07, 0.16],
    [1.04, 0.38],
    [0.86, 0.6],
    [0.56, 0.8],
    [0.26, 0.93],
    [0.08, 0.99],
    [0, 1],
  ];
  return pts.map(([x, y]) => new Vector2(x * radius, y * height));
}

/** Lengkung pintu (pointed arch) dengan lubang, untuk portal dan fasad. */
export function createArchShape(width = 1, height = 1.6, thickness = 0.12): Shape {
  const half = width / 2;
  const spring = height * 0.62;
  const outer = new Shape();
  outer.moveTo(-half - thickness, 0);
  outer.lineTo(-half - thickness, spring);
  outer.quadraticCurveTo(-half - thickness, height + thickness * 0.6, 0, height + thickness);
  outer.quadraticCurveTo(half + thickness, height + thickness * 0.6, half + thickness, spring);
  outer.lineTo(half + thickness, 0);
  outer.lineTo(half, 0);
  outer.lineTo(half, spring);
  outer.quadraticCurveTo(half, height - thickness * 0.4, 0, height);
  outer.quadraticCurveTo(-half, height - thickness * 0.4, -half, spring);
  outer.lineTo(-half, 0);
  outer.closePath();
  return outer;
}

/** Bidang isi lengkung (untuk cahaya di dalam portal/jendela). */
export function createArchFillShape(width = 1, height = 1.6): Shape {
  const half = width / 2;
  const spring = height * 0.62;
  const s = new Shape();
  s.moveTo(-half, 0);
  s.lineTo(-half, spring);
  s.quadraticCurveTo(-half, height, 0, height);
  s.quadraticCurveTo(half, height, half, spring);
  s.lineTo(half, 0);
  s.closePath();
  return s;
}

/** Bilangan acak deterministik agar layout partikel stabil antar render. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
