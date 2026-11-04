import { useMemo } from "react";
import {
  addDaysIso,
  calculatePrayerTimes,
  findNextPrayer,
  todayInTimeZone,
  type NextPrayerInfo,
  type PrayerKey,
  type PrayerTimesResult,
} from "@nur/islamic-calculations";
import { usePrayerSettings, type SavedLocation } from "@/stores/prayer-settings";

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  fajr: "Subuh",
  sunrise: "Terbit",
  dhuhr: "Dzuhur",
  asr: "Ashar",
  maghrib: "Maghrib",
  isha: "Isya",
};

export interface PrayerDay {
  location: SavedLocation;
  today: PrayerTimesResult;
  tomorrow: PrayerTimesResult;
  next: NextPrayerInfo | null;
  error: null;
}

export interface PrayerDayError {
  location: SavedLocation;
  error: string;
}

/** Menghitung jadwal hari ini & besok secara lokal untuk lokasi tersimpan. */
export function usePrayerDay(now: Date): PrayerDay | PrayerDayError | null {
  const { location, methodCode, asrMadhhab, adjustments } = usePrayerSettings();
  const dateKey = location ? todayInTimeZone(location.timezone, now) : null;
  const minuteKey = Math.floor(now.getTime() / 60_000);

  const schedule = useMemo(() => {
    if (!location || !dateKey) return null;
    try {
      const base = {
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation ?? undefined,
        timezone: location.timezone,
        method: methodCode,
        asrMadhhab,
        adjustments,
      };
      return {
        today: calculatePrayerTimes({ ...base, date: dateKey }),
        tomorrow: calculatePrayerTimes({ ...base, date: addDaysIso(dateKey, 1) }),
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Perhitungan gagal" };
    }
  }, [location, dateKey, methodCode, asrMadhhab, adjustments]);

  return useMemo(() => {
    if (!location || !schedule) return null;
    if ("error" in schedule) return { location, error: schedule.error ?? "Perhitungan gagal" };
    return { location, today: schedule.today, tomorrow: schedule.tomorrow, next: findNextPrayer(schedule.today, schedule.tomorrow, new Date(minuteKey * 60_000 + 1)), error: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- next prayer diperbarui per menit
  }, [location, schedule, minuteKey]);
}

/** Sisa waktu ke sholat berikutnya dihitung ulang setiap detik dari instan tetap. */
export function remainingMs(next: NextPrayerInfo | null, now: Date): number {
  return next ? Math.max(0, next.instant.getTime() - now.getTime()) : 0;
}

export function isPrayerDayReady(day: PrayerDay | PrayerDayError | null): day is PrayerDay {
  return !!day && day.error === null;
}
