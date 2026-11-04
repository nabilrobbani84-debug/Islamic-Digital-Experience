/**
 * Kalender Hijriah tabular (aritmetis), siklus 30 tahun dengan tahun kabisat
 * 2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29 dan epoch sipil 16 Juli 622 M (Julian).
 *
 * PENTING: hasil algoritma tabular BUKAN hasil rukyat maupun penetapan resmi pemerintah
 * (misalnya sidang isbat). Perbedaan 1–2 hari dapat terjadi; gunakan `adjustmentDays`.
 */

export const HIJRI_ALGORITHM_VERSION = "nur-hijri-tabular-1.0.0";

const ISLAMIC_EPOCH = 1948439.5;

export type CalendarMethod = "TABULAR" | "CUSTOM_HISAB";

export const HIJRI_MONTH_NAMES = [
  "Muharram",
  "Safar",
  "Rabiul Awal",
  "Rabiul Akhir",
  "Jumadil Awal",
  "Jumadil Akhir",
  "Rajab",
  "Syaban",
  "Ramadan",
  "Syawal",
  "Zulkaidah",
  "Zulhijah",
] as const;

export const HIJRI_MONTH_NAMES_ARABIC = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
] as const;

export interface HijriDateResult {
  day: number;
  month: number;
  year: number;
  monthName: string;
  method: CalendarMethod;
  algorithmVersion: string;
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
}

export function gregorianToJd(year: number, month: number, day: number): number {
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

export function jdToGregorian(jd: number): GregorianDate {
  const z = Math.floor(jd + 0.5);
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = z < 2299161 ? z : z + 1 + alpha - Math.floor(alpha / 4);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day };
}

export function isHijriLeapYear(year: number): boolean {
  return (14 + 11 * year) % 30 < 11;
}

export function hijriMonthLength(year: number, month: number): number {
  if (month === 12 && isHijriLeapYear(year)) return 30;
  return month % 2 === 1 ? 30 : 29;
}

export function hijriToJd(year: number, month: number, day: number): number {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    ISLAMIC_EPOCH -
    1
  );
}

export function jdToHijri(jd: number): { year: number; month: number; day: number } {
  const j = Math.floor(jd) + 0.5;
  const year = Math.floor((30 * (j - ISLAMIC_EPOCH) + 10646) / 10631);
  const month = Math.min(12, Math.ceil((j - (29 + hijriToJd(year, 1, 1))) / 29.5) + 1);
  const day = j - hijriToJd(year, month, 1) + 1;
  return { year, month, day };
}

function validateGregorian({ year, month, day }: GregorianDate): void {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCFullYear(year);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    throw new RangeError(`Tanggal Masehi tidak valid: ${year}-${month}-${day}`);
  }
}

export interface HijriOptions {
  /** Koreksi hari (positif = Hijriah dimajukan), dibatasi -2..2. */
  adjustmentDays?: number;
  method?: CalendarMethod;
}

function clampAdjustment(n: number | undefined): number {
  if (n === undefined) return 0;
  if (!Number.isInteger(n) || n < -2 || n > 2) throw new RangeError("adjustmentDays harus bilangan bulat -2..2");
  return n;
}

export function toHijri(date: GregorianDate, options: HijriOptions = {}): HijriDateResult {
  validateGregorian(date);
  const adjustment = clampAdjustment(options.adjustmentDays);
  const h = jdToHijri(gregorianToJd(date.year, date.month, date.day) + adjustment);
  return {
    ...h,
    monthName: HIJRI_MONTH_NAMES[h.month - 1] ?? "",
    method: options.method ?? "TABULAR",
    algorithmVersion: HIJRI_ALGORITHM_VERSION,
  };
}

export function toGregorian(
  hijri: { year: number; month: number; day: number },
  options: HijriOptions = {},
): GregorianDate {
  const { year, month, day } = hijri;
  if (!Number.isInteger(year) || year < 1) throw new RangeError("Tahun Hijriah harus >= 1");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError("Bulan Hijriah harus 1..12");
  if (!Number.isInteger(day) || day < 1 || day > hijriMonthLength(year, month)) {
    throw new RangeError("Hari Hijriah di luar panjang bulan");
  }
  const adjustment = clampAdjustment(options.adjustmentDays);
  return jdToGregorian(hijriToJd(year, month, day) - adjustment);
}

export interface CalendarDay {
  gregorian: GregorianDate;
  hijri: { year: number; month: number; day: number };
  /** 0 = Minggu ... 6 = Sabtu */
  weekday: number;
  events: IslamicEvent[];
}

export interface IslamicEvent {
  key: string;
  name: string;
  hijriMonth: number;
  hijriDay: number;
}

/** Hari besar Islam dengan tanggal Hijriah tetap. */
export const ISLAMIC_EVENTS: readonly IslamicEvent[] = [
  { key: "new-year", name: "Tahun Baru Islam", hijriMonth: 1, hijriDay: 1 },
  { key: "ashura", name: "Hari Asyura", hijriMonth: 1, hijriDay: 10 },
  { key: "mawlid", name: "Maulid Nabi Muhammad ﷺ", hijriMonth: 3, hijriDay: 12 },
  { key: "isra-miraj", name: "Isra Mi'raj", hijriMonth: 7, hijriDay: 27 },
  { key: "nisfu-syaban", name: "Nisfu Syaban", hijriMonth: 8, hijriDay: 15 },
  { key: "ramadan-start", name: "Awal Ramadan", hijriMonth: 9, hijriDay: 1 },
  { key: "nuzulul-quran", name: "Nuzulul Qur'an", hijriMonth: 9, hijriDay: 17 },
  { key: "eid-al-fitr", name: "Idul Fitri", hijriMonth: 10, hijriDay: 1 },
  { key: "arafah", name: "Hari Arafah", hijriMonth: 12, hijriDay: 9 },
  { key: "eid-al-adha", name: "Idul Adha", hijriMonth: 12, hijriDay: 10 },
];

export function eventsOn(hijriMonth: number, hijriDay: number): IslamicEvent[] {
  return ISLAMIC_EVENTS.filter((e) => e.hijriMonth === hijriMonth && e.hijriDay === hijriDay);
}

function weekdayOf(jd: number): number {
  return (Math.floor(jd + 1.5) % 7 + 7) % 7;
}

/** Seluruh hari dalam satu bulan Masehi beserta padanan Hijriahnya. */
export function gregorianMonthCalendar(year: number, month: number, options: HijriOptions = {}): CalendarDay[] {
  const adjustment = clampAdjustment(options.adjustmentDays);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const result: CalendarDay[] = [];
  for (let day = 1; day <= days; day++) {
    const jd = gregorianToJd(year, month, day);
    const hijri = jdToHijri(jd + adjustment);
    result.push({
      gregorian: { year, month, day },
      hijri,
      weekday: weekdayOf(jd),
      events: eventsOn(hijri.month, hijri.day),
    });
  }
  return result;
}

/** Seluruh hari dalam satu bulan Hijriah beserta padanan Masehinya. */
export function hijriMonthCalendar(year: number, month: number, options: HijriOptions = {}): CalendarDay[] {
  const adjustment = clampAdjustment(options.adjustmentDays);
  const length = hijriMonthLength(year, month);
  const result: CalendarDay[] = [];
  for (let day = 1; day <= length; day++) {
    const jd = hijriToJd(year, month, day) - adjustment;
    result.push({
      gregorian: jdToGregorian(jd),
      hijri: { year, month, day },
      weekday: weekdayOf(jd),
      events: eventsOn(month, day),
    });
  }
  return result;
}
