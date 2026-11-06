import type { SavedLocation } from "@/stores/prayer-settings";

/**
 * Database koordinat lokal (tanpa layanan peta pihak ketiga).
 * Koordinat pusat kota (WGS84, presisi ~0,01°) dan zona waktu IANA.
 */
export const PRESET_LOCATIONS: readonly Omit<SavedLocation, "source">[] = [
  { name: "Jakarta", latitude: -6.2088, longitude: 106.8456, elevation: 8, timezone: "Asia/Jakarta" },
  { name: "Bandung", latitude: -6.9175, longitude: 107.6191, elevation: 768, timezone: "Asia/Jakarta" },
  { name: "Semarang", latitude: -6.9667, longitude: 110.4167, elevation: 3, timezone: "Asia/Jakarta" },
  { name: "Yogyakarta", latitude: -7.7956, longitude: 110.3695, elevation: 113, timezone: "Asia/Jakarta" },
  { name: "Surabaya", latitude: -7.2575, longitude: 112.7521, elevation: 5, timezone: "Asia/Jakarta" },
  { name: "Banda Aceh", latitude: 5.5483, longitude: 95.3238, elevation: 10, timezone: "Asia/Jakarta" },
  { name: "Medan", latitude: 3.5952, longitude: 98.6722, elevation: 25, timezone: "Asia/Jakarta" },
  { name: "Padang", latitude: -0.9471, longitude: 100.4172, elevation: 5, timezone: "Asia/Jakarta" },
  { name: "Palembang", latitude: -2.9761, longitude: 104.7754, elevation: 8, timezone: "Asia/Jakarta" },
  { name: "Pontianak", latitude: -0.0263, longitude: 109.3425, elevation: 1, timezone: "Asia/Pontianak" },
  { name: "Denpasar", latitude: -8.6705, longitude: 115.2126, elevation: 4, timezone: "Asia/Makassar" },
  { name: "Mataram", latitude: -8.5833, longitude: 116.1167, elevation: 15, timezone: "Asia/Makassar" },
  { name: "Balikpapan", latitude: -1.2379, longitude: 116.8529, elevation: 10, timezone: "Asia/Makassar" },
  { name: "Makassar", latitude: -5.1477, longitude: 119.4327, elevation: 5, timezone: "Asia/Makassar" },
  { name: "Manado", latitude: 1.4748, longitude: 124.8421, elevation: 5, timezone: "Asia/Makassar" },
  { name: "Ambon", latitude: -3.6954, longitude: 128.1814, elevation: 5, timezone: "Asia/Jayapura" },
  { name: "Jayapura", latitude: -2.5337, longitude: 140.7181, elevation: 10, timezone: "Asia/Jayapura" },
  { name: "Kuala Lumpur", latitude: 3.139, longitude: 101.6869, elevation: 60, timezone: "Asia/Kuala_Lumpur" },
  { name: "Singapura", latitude: 1.3521, longitude: 103.8198, elevation: 15, timezone: "Asia/Singapore" },
  { name: "Makkah", latitude: 21.4225, longitude: 39.8262, elevation: 277, timezone: "Asia/Riyadh" },
  { name: "Madinah", latitude: 24.4672, longitude: 39.6111, elevation: 608, timezone: "Asia/Riyadh" },
  { name: "Kairo", latitude: 30.0444, longitude: 31.2357, elevation: 23, timezone: "Africa/Cairo" },
  { name: "Istanbul", latitude: 41.0082, longitude: 28.9784, elevation: 39, timezone: "Europe/Istanbul" },
  { name: "London", latitude: 51.5074, longitude: -0.1278, elevation: 11, timezone: "Europe/London" },
  { name: "New York", latitude: 40.7128, longitude: -74.006, elevation: 10, timezone: "America/New_York" },
];

/** Zona waktu yang ditawarkan saat memakai GPS (zona perangkat ditampilkan, tetapi harus dikonfirmasi). */
export const COMMON_TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Pontianak",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Kuala_Lumpur",
  "Asia/Singapore",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Africa/Cairo",
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
] as const;
