import { useEffect } from "react";
import { addDaysIso, calculatePrayerTimes, OBLIGATORY_PRAYERS, todayInTimeZone } from "@nur/islamic-calculations";
import { usePrayerSettings } from "@/stores/prayer-settings";
import { usePreferences } from "@/stores/preferences";
import { PRAYER_LABELS } from "./usePrayerTimes";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Penjadwal pengingat sholat selama aplikasi terbuka (Notification API, tanpa server push).
 * Keterbatasan: pengingat tidak berbunyi jika tab/aplikasi ditutup.
 */
export function PrayerReminderScheduler() {
  const { location, methodCode, asrMadhhab, adjustments, reminders } = usePrayerSettings();
  const enabled = usePreferences((s) => s.notificationsEnabled);

  useEffect(() => {
    if (!enabled || !location || !notificationsSupported() || Notification.permission !== "granted") return;
    const keys = OBLIGATORY_PRAYERS.filter((k) => reminders[k]);
    if (keys.length === 0) return;
    const timers: number[] = [];
    const today = todayInTimeZone(location.timezone);
    for (const date of [today, addDaysIso(today, 1)]) {
      let result: ReturnType<typeof calculatePrayerTimes>;
      try {
        result = calculatePrayerTimes({ latitude: location.latitude, longitude: location.longitude, elevation: location.elevation ?? undefined, timezone: location.timezone, date, method: methodCode, asrMadhhab, adjustments });
      } catch {
        return;
      }
      for (const key of keys) {
        const value = result.times[key];
        if (!value) continue;
        const delay = Date.parse(value.instant) - Date.now();
        if (delay <= 0 || delay > 2 ** 31 - 1) continue;
        timers.push(
          window.setTimeout(() => {
            try {
              new Notification(`Waktu ${PRAYER_LABELS[key]}`, { body: `${value.label} · ${location.name}`, icon: "/icons/icon.svg", tag: `prayer-${date}-${key}` });
            } catch {
              /* sebagian browser mobile hanya mengizinkan notifikasi via service worker */
            }
          }, delay),
        );
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [enabled, location, methodCode, asrMadhhab, adjustments, reminders]);

  return null;
}
