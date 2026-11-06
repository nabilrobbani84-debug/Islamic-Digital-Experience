/**
 * Utilitas zona waktu IANA berbasis Intl (tersedia di browser dan Node tanpa dataset tambahan).
 * Zona waktu yang dipakai selalu milik LOKASI, bukan perangkat.
 */

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Offset zona waktu (menit, timur UTC positif) pada instan tertentu. */
export function timeZoneOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const instantSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - instantSeconds) / 60000);
}

export interface LocalDateParts {
  year: number;
  month: number;
  day: number;
  /** Menit sejak tengah malam lokal. */
  minutes: number;
  /** Detik sejak tengah malam lokal (presisi lebih tinggi untuk countdown). */
  seconds: number;
}

/** Tanggal dan jam lokal pada zona `timeZone` untuk instan tertentu. */
export function localPartsAt(timeZone: string, instant: Date): LocalDateParts {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const hour = get("hour");
  const minute = get("minute");
  const second = get("second");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    minutes: hour * 60 + minute,
    seconds: hour * 3600 + minute * 60 + second,
  };
}

/** Instan UTC untuk jam lokal (dalam jam desimal) pada tanggal lokal tertentu di zona `timeZone`. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  localHours: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day) + localHours * 3600_000;
  // Dua iterasi menangani pergantian daylight saving di sekitar waktu target.
  let offset = timeZoneOffsetMinutes(timeZone, new Date(naive));
  let utc = naive - offset * 60_000;
  const refined = timeZoneOffsetMinutes(timeZone, new Date(utc));
  if (refined !== offset) {
    offset = refined;
    utc = naive - offset * 60_000;
  }
  return new Date(utc);
}

export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const p = localPartsAt(timeZone, now);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
