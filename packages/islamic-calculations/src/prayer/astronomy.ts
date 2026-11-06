/**
 * Rumus astronomi posisi matahari (presisi ~1 menit untuk tahun 1950–2050).
 * Sumber rumus: U.S. Naval Observatory "Approximate Solar Coordinates",
 * pendekatan yang sama dipakai oleh algoritma PrayTimes.
 */

const DEG = Math.PI / 180;

export const dsin = (d: number): number => Math.sin(d * DEG);
export const dcos = (d: number): number => Math.cos(d * DEG);
export const dtan = (d: number): number => Math.tan(d * DEG);
export const darcsin = (x: number): number => Math.asin(x) / DEG;
export const darccos = (x: number): number => Math.acos(x) / DEG;
export const darctan2 = (y: number, x: number): number => Math.atan2(y, x) / DEG;
export const darccot = (x: number): number => Math.atan(1 / x) / DEG;

export function fixAngle(a: number): number {
  return a - 360 * Math.floor(a / 360);
}

export function fixHour(h: number): number {
  return h - 24 * Math.floor(h / 24);
}

/** Julian Day pada 00:00 UT untuk tanggal kalender Gregorian (Meeus, bab 7). */
export function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

export interface SunPosition {
  /** Deklinasi matahari dalam derajat. */
  declination: number;
  /** Equation of time dalam jam. */
  equation: number;
}

export function sunPosition(jd: number): SunPosition {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d);
  const q = fixAngle(280.459 + 0.98564736 * d);
  const l = fixAngle(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * d;
  const ra = darctan2(dcos(e) * dsin(l), dcos(l)) / 15;
  const equation = q / 15 - fixHour(ra);
  const declination = darcsin(dsin(e) * dsin(l));
  return { declination, equation };
}
