import { usePreferences } from "@/stores/preferences";
import { useMediaQuery } from "./useMediaQuery";

/** true jika sistem ATAU pengaturan aplikasi meminta animasi dikurangi. */
export function useReducedMotion(): boolean {
  const system = useMediaQuery("(prefers-reduced-motion: reduce)");
  const preference = usePreferences((s) => s.reducedMotion);
  return system || preference;
}
