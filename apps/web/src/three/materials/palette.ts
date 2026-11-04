/** Palet material 3D NUR, selaras dengan design token. */
export const PALETTE = {
  night: "#070c16",
  navy: "#0b1324",
  horizon: "#14324a",
  stone: "#e7dfcb",
  stoneShade: "#cfc4aa",
  gold: "#d6b56d",
  goldSoft: "#e8d6a5",
  goldDeep: "#b48a3c",
  emerald: "#087f5b",
  emeraldDeep: "#064e3b",
  windowGlow: "#ffcf7a",
  moon: "#f6eed3",
} as const;

export const GOLD_MATERIAL = { color: PALETTE.gold, metalness: 0.78, roughness: 0.28 } as const;
export const STONE_MATERIAL = { color: PALETTE.stone, metalness: 0.02, roughness: 0.86 } as const;
