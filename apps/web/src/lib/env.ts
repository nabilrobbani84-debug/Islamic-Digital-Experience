export type ApiMode = "http" | "mock";

/**
 * Mode mock hanya bisa aktif di luar build production. Pada `vite build` (mode production)
 * ekspresi ini menjadi konstanta false sehingga adapter mock ikut terbuang dari bundle.
 */
const mockAllowed = import.meta.env.MODE !== "production";

export const env = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? "/api/v1").replace(/\/+$/, ""),
  apiMode: (mockAllowed && import.meta.env.VITE_API_MODE === "mock" ? "mock" : "http") as ApiMode,
  isProduction: import.meta.env.PROD,
} as const;
