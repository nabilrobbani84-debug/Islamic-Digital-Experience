import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_METHOD_CODE, type AsrMadhhab, type PrayerKey } from "@nur/islamic-calculations";

export interface SavedLocation {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  /** Zona waktu IANA lokasi (dikonfirmasi pengguna). */
  timezone: string;
  source: "preset" | "geolocation" | "manual";
}

export interface PrayerSettingsState {
  location: SavedLocation | null;
  methodCode: string;
  asrMadhhab: AsrMadhhab;
  adjustments: Partial<Record<PrayerKey, number>>;
  hijriAdjustment: number;
  reminders: Partial<Record<PrayerKey, boolean>>;
  setLocation: (location: SavedLocation) => void;
  setMethod: (code: string) => void;
  setAsrMadhhab: (m: AsrMadhhab) => void;
  setAdjustment: (key: PrayerKey, minutes: number) => void;
  setHijriAdjustment: (days: number) => void;
  setReminder: (key: PrayerKey, on: boolean) => void;
}

export const usePrayerSettings = create<PrayerSettingsState>()(
  persist(
    (set) => ({
      location: null,
      methodCode: DEFAULT_METHOD_CODE,
      asrMadhhab: "STANDARD",
      adjustments: {},
      hijriAdjustment: 0,
      reminders: {},
      setLocation: (location) => set({ location }),
      setMethod: (methodCode) => set({ methodCode }),
      setAsrMadhhab: (asrMadhhab) => set({ asrMadhhab }),
      setAdjustment: (key, minutes) =>
        set((s) => ({ adjustments: { ...s.adjustments, [key]: Math.max(-30, Math.min(30, Math.round(minutes))) } })),
      setHijriAdjustment: (days) => set({ hijriAdjustment: Math.max(-2, Math.min(2, Math.round(days))) }),
      setReminder: (key, on) => set((s) => ({ reminders: { ...s.reminders, [key]: on } })),
    }),
    { name: "nur-prayer-settings", version: 1 },
  ),
);
