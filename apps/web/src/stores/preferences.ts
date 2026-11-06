import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light";
export type Experience3D = "auto" | "off";

export interface PreferencesState {
  theme: ThemeMode;
  /** true = kurangi animasi walaupun sistem tidak memintanya. */
  reducedMotion: boolean;
  experience3D: Experience3D;
  arabicFontSize: number;
  translationFontSize: number;
  translationEnabled: boolean;
  editionId: string | null;
  qariId: string | null;
  audioSpeed: number;
  notificationsEnabled: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  set: (patch: Partial<Omit<PreferencesState, "set" | "setTheme" | "toggleTheme">>) => void;
}

export const ARABIC_FONT_RANGE = { min: 22, max: 56, step: 2 } as const;
export const TRANSLATION_FONT_RANGE = { min: 14, max: 24, step: 1 } as const;

/** Preferensi tampilan (bukan data sensitif) disimpan di localStorage. */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: "dark",
      reducedMotion: false,
      experience3D: "auto",
      arabicFontSize: 32,
      translationFontSize: 17,
      translationEnabled: true,
      editionId: null,
      qariId: null,
      audioSpeed: 1,
      notificationsEnabled: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      set: (patch) => set(patch),
    }),
    { name: "nur-preferences", version: 1 },
  ),
);
