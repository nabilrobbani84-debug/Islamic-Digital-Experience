const LOCALE = "id-ID";

const idrFormatter = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numberFormatter = new Intl.NumberFormat(LOCALE);

/** Format string desimal (hasil engine zakat) sebagai Rupiah tanpa konversi ke float untuk nilai besar. */
export function formatIdr(value: string): string {
  const [whole = "0"] = value.split(".");
  const negative = whole.startsWith("-");
  const digits = negative ? whole.slice(1) : whole;
  if (digits.length <= 15) return idrFormatter.format(Number(value));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}Rp ${grouped}`;
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Mengubah input pengguna bergaya Indonesia ("1.250.000" atau "12,5") menjadi string desimal "1250000" / "12.5". */
export function parseLocaleNumber(input: string, allowFraction = false): string | null {
  const trimmed = input.trim().replace(/\s|Rp/gi, "");
  if (trimmed === "") return "0";
  if (allowFraction) {
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    return /^\d+(\.\d+)?$/.test(normalized) ? normalized : null;
  }
  const normalized = trimmed.replace(/[.,]/g, "");
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, "") : null;
}

/** Menampilkan angka dengan pemisah ribuan saat mengetik. */
export function groupDigits(input: string): string {
  const digits = input.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatGregorianLong(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone }).format(date);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

/** Countdown HH:MM:SS dari milidetik. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatDurationMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

/** Angka Arab-Indic untuk nomor ayat. */
export function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);
}

export function greetingForHour(hour: number): string {
  if (hour < 4) return "Selamat malam";
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}
