import {
  darccos,
  darccot,
  dcos,
  dsin,
  dtan,
  fixHour,
  julianDay,
  sunPosition,
} from "./astronomy.ts";
import { getPrayerMethod, type AsrMadhhab, type HighLatitudeRule, type PrayerMethod } from "./methods.ts";
import { isValidTimeZone, localPartsAt } from "./timezone.ts";

export const PRAYER_ALGORITHM_VERSION = "nur-prayer-1.0.0";

export const PRAYER_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
/** Waktu sholat wajib (tanpa terbit). */
export const OBLIGATORY_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const satisfies readonly PrayerKey[];

export interface PrayerCalculationInput {
  latitude: number;
  longitude: number;
  /** Ketinggian dalam meter di atas permukaan laut. */
  elevation?: number;
  /** Tanggal lokal lokasi, format YYYY-MM-DD. */
  date: string;
  /** Zona waktu IANA lokasi, misalnya "Asia/Jakarta". */
  timezone: string;
  /** Kode metode bawaan atau parameter metode kustom. */
  method: string | PrayerMethod;
  asrMadhhab?: AsrMadhhab;
  highLatitudeRule?: HighLatitudeRule;
  /** Penyesuaian manual dalam menit per waktu. */
  adjustments?: Partial<Record<PrayerKey, number>>;
}

export interface PrayerTimeValue {
  /** Menit sejak tengah malam lokal pada `date`. Bisa >= 1440 jika jatuh setelah tengah malam. */
  minutes: number;
  /** Tampilan jam lokal HH:MM. */
  label: string;
  /** Instan UTC (ISO 8601). */
  instant: string;
}

export interface PrayerTimesResult {
  date: string;
  timezone: string;
  methodCode: string;
  methodName: string;
  methodVerified: boolean;
  asrMadhhab: AsrMadhhab;
  algorithmVersion: string;
  /** Aturan lintang tinggi yang benar-benar mengubah hasil, null jika tidak dipakai. */
  highLatitudeRuleApplied: HighLatitudeRule | null;
  /** null berarti tidak ada solusi astronomis (misalnya matahari tidak terbenam). */
  times: Record<PrayerKey, PrayerTimeValue | null>;
}

/** Bentuk ringkas sesuai spesifikasi arsitektur (bagian 5.1). */
export interface PrayerSchedule {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  calculationMethod: string;
  algorithmVersion: string;
}

export class PrayerInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrayerInputError";
  }
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(date: string): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(date);
  if (!match) throw new PrayerInputError(`Format tanggal harus YYYY-MM-DD: ${date}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new PrayerInputError(`Tanggal tidak valid: ${date}`);
  }
  return { year, month, day };
}

function validate(input: PrayerCalculationInput): void {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new PrayerInputError("Latitude harus di antara -90 dan 90");
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new PrayerInputError("Longitude harus di antara -180 dan 180");
  }
  if (input.elevation !== undefined && (!Number.isFinite(input.elevation) || input.elevation < -500 || input.elevation > 9000)) {
    throw new PrayerInputError("Ketinggian harus di antara -500 dan 9000 meter");
  }
  if (!isValidTimeZone(input.timezone)) {
    throw new PrayerInputError(`Zona waktu IANA tidak dikenal: ${input.timezone}`);
  }
}

function nightPortion(rule: HighLatitudeRule, angle: number, night: number): number {
  switch (rule) {
    case "ANGLE_BASED":
      return (angle / 60) * night;
    case "MIDDLE_OF_NIGHT":
      return night / 2;
    case "ONE_SEVENTH":
      return night / 7;
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatMinutes(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(normalized / 60))}:${pad2(normalized % 60)}`;
}

/**
 * Menghitung waktu sholat untuk satu tanggal lokal di lokasi tertentu.
 * Seluruh perhitungan lokal, tanpa koneksi jaringan.
 */
export function calculatePrayerTimes(input: PrayerCalculationInput): PrayerTimesResult {
  validate(input);
  const { year, month, day } = parseIsoDate(input.date);
  const method = typeof input.method === "string" ? getPrayerMethod(input.method) : input.method;
  const asrMadhhab = input.asrMadhhab ?? "STANDARD";
  const rule = input.highLatitudeRule ?? "ANGLE_BASED";
  const lat = input.latitude;
  const lng = input.longitude;
  const elevation = Math.max(0, input.elevation ?? 0);
  const riseSetAngle = 0.833 + 0.0347 * Math.sqrt(elevation);
  const asrFactor = asrMadhhab === "HANAFI" ? 2 : 1;

  // Julian date pada tengah malam waktu matahari lokal (Local Mean Time).
  const jDate = julianDay(year, month, day) - lng / (15 * 24);

  const midDay = (t: number): number => fixHour(12 - sunPosition(jDate + t / 24).equation);
  const sunAngleTime = (angle: number, t: number, ccw: boolean): number => {
    const decl = sunPosition(jDate + t / 24).declination;
    const noon = midDay(t);
    const cosH = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
    if (cosH < -1 || cosH > 1) return Number.NaN;
    const h = darccos(cosH) / 15;
    return noon + (ccw ? -h : h);
  };
  const asrTime = (t: number): number => {
    const decl = sunPosition(jDate + t / 24).declination;
    const angle = -darccot(asrFactor + dtan(Math.abs(lat - decl)));
    return sunAngleTime(angle, t, false);
  };

  // Tebakan awal (jam waktu matahari lokal), lalu dua iterasi penyempurnaan.
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    const g = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);
    t = {
      fajr: sunAngleTime(method.fajrAngle, g(t.fajr, 5), true),
      sunrise: sunAngleTime(riseSetAngle, g(t.sunrise, 6), true),
      dhuhr: midDay(g(t.dhuhr, 12)),
      asr: asrTime(g(t.asr, 13)),
      sunset: sunAngleTime(riseSetAngle, g(t.sunset, 18), false),
      isha:
        method.ishaIntervalMinutes !== undefined
          ? Number.NaN
          : sunAngleTime(method.ishaAngle ?? 18, g(t.isha, 18), false),
    };
  }

  let highLatitudeRuleApplied: HighLatitudeRule | null = null;
  if (method.ishaIntervalMinutes !== undefined) {
    t.isha = t.sunset + method.ishaIntervalMinutes / 60;
  }

  // Penyesuaian lintang tinggi: jika sudut tidak tercapai atau melebihi porsi malam.
  if (Number.isFinite(t.sunrise) && Number.isFinite(t.sunset)) {
    const night = fixHour(t.sunrise - t.sunset);
    const fajrPortion = nightPortion(rule, method.fajrAngle, night);
    const fajrDiff = fixHour(t.sunrise - t.fajr);
    if (!Number.isFinite(t.fajr) || fajrDiff > fajrPortion) {
      t.fajr = t.sunrise - fajrPortion;
      highLatitudeRuleApplied = rule;
    }
    if (method.ishaIntervalMinutes === undefined) {
      const ishaPortion = nightPortion(rule, method.ishaAngle ?? 18, night);
      const ishaDiff = fixHour(t.isha - t.sunset);
      if (!Number.isFinite(t.isha) || ishaDiff > ishaPortion) {
        t.isha = t.sunset + ishaPortion;
        highLatitudeRuleApplied = rule;
      }
    }
  }

  const ihtiyat = method.ihtiyatMinutes;
  const adj = input.adjustments ?? {};
  const solar: Record<PrayerKey, number> = {
    fajr: t.fajr + (ihtiyat + (adj.fajr ?? 0)) / 60,
    sunrise: t.sunrise + (-ihtiyat + (adj.sunrise ?? 0)) / 60,
    dhuhr: t.dhuhr + (ihtiyat + (adj.dhuhr ?? 0)) / 60,
    asr: t.asr + (ihtiyat + (adj.asr ?? 0)) / 60,
    maghrib: t.sunset + (ihtiyat + (adj.maghrib ?? 0)) / 60,
    isha: t.isha + (ihtiyat + (adj.isha ?? 0)) / 60,
  };

  const baseUtc = Date.UTC(year, month - 1, day);
  const baseDayNumber = Math.floor(baseUtc / 86_400_000);
  const times = {} as Record<PrayerKey, PrayerTimeValue | null>;
  for (const key of PRAYER_KEYS) {
    const solarHours = solar[key];
    if (!Number.isFinite(solarHours)) {
      times[key] = null;
      continue;
    }
    // Waktu matahari lokal -> UT, dibulatkan ke menit terdekat.
    const utcMs = baseUtc + Math.round((solarHours - lng / 15) * 60) * 60_000;
    const instant = new Date(utcMs);
    const local = localPartsAt(input.timezone, instant);
    const localDayNumber = Math.floor(Date.UTC(local.year, local.month - 1, local.day) / 86_400_000);
    const minutes = (localDayNumber - baseDayNumber) * 1440 + local.minutes;
    times[key] = { minutes, label: formatMinutes(minutes), instant: instant.toISOString() };
  }

  return {
    date: input.date,
    timezone: input.timezone,
    methodCode: method.code,
    methodName: method.name,
    methodVerified: method.verified,
    asrMadhhab,
    algorithmVersion: PRAYER_ALGORITHM_VERSION,
    highLatitudeRuleApplied,
    times,
  };
}

export function toPrayerSchedule(result: PrayerTimesResult): PrayerSchedule {
  const label = (k: PrayerKey): string => result.times[k]?.label ?? "--:--";
  return {
    fajr: label("fajr"),
    sunrise: label("sunrise"),
    dhuhr: label("dhuhr"),
    asr: label("asr"),
    maghrib: label("maghrib"),
    isha: label("isha"),
    calculationMethod: result.methodCode,
    algorithmVersion: result.algorithmVersion,
  };
}

export interface NextPrayerInfo {
  key: (typeof OBLIGATORY_PRAYERS)[number];
  instant: Date;
  remainingMs: number;
  /** Waktu wajib yang sedang berlangsung, null jika di antara terbit dan Dzuhur atau sebelum Subuh. */
  current: (typeof OBLIGATORY_PRAYERS)[number] | null;
}

/**
 * Menentukan waktu sholat berikutnya dari jadwal hari ini dan besok.
 * `tomorrow` dipakai ketika seluruh waktu hari ini sudah lewat.
 */
export function findNextPrayer(
  today: PrayerTimesResult,
  tomorrow: PrayerTimesResult | null,
  now: Date = new Date(),
): NextPrayerInfo | null {
  const nowMs = now.getTime();
  const entries = OBLIGATORY_PRAYERS.flatMap((key) => {
    const value = today.times[key];
    return value ? [{ key, ms: Date.parse(value.instant) }] : [];
  });
  let current: NextPrayerInfo["current"] = null;
  for (const entry of entries) {
    if (entry.ms <= nowMs) current = entry.key;
  }
  const sunrise = today.times.sunrise;
  if (current === "fajr" && sunrise && Date.parse(sunrise.instant) <= nowMs) current = null;

  const upcoming = entries.find((e) => e.ms > nowMs);
  if (upcoming) {
    return { key: upcoming.key, instant: new Date(upcoming.ms), remainingMs: upcoming.ms - nowMs, current };
  }
  const fajrTomorrow = tomorrow?.times.fajr;
  if (!fajrTomorrow) return null;
  const ms = Date.parse(fajrTomorrow.instant);
  return { key: "fajr", instant: new Date(ms), remainingMs: ms - nowMs, current };
}

export function addDaysIso(date: string, days: number): string {
  const { year, month, day } = parseIsoDate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
