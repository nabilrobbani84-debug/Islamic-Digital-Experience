import { darctan2, dcos, dsin, dtan, fixAngle } from "../prayer/astronomy.ts";

/** Koordinat Ka'bah yang dikunci dalam dataset aplikasi (WGS84). */
export const KAABA = Object.freeze({ latitude: 21.4225, longitude: 39.8262 });

const EARTH_RADIUS_KM = 6371.0088;

export interface QiblaInput {
  latitude: number;
  longitude: number;
}

export interface QiblaResult {
  /** Azimut kiblat dari utara sejati, searah jarum jam, 0–360°. */
  bearing: number;
  /** Arah mata angin (8 arah, Bahasa Indonesia). */
  direction: string;
  /** Jarak lingkaran besar menuju Ka'bah. */
  distanceKm: number;
}

const DIRECTIONS = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"] as const;

export function compassDirection(bearing: number): string {
  const index = Math.round(fixAngle(bearing) / 45) % 8;
  return DIRECTIONS[index] ?? "Utara";
}

export function calculateQibla(input: QiblaInput): QiblaResult {
  const { latitude, longitude } = input;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new RangeError("Latitude harus di antara -90 dan 90");
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError("Longitude harus di antara -180 dan 180");
  }
  const dLng = KAABA.longitude - longitude;
  const bearing = fixAngle(
    darctan2(dsin(dLng), dcos(latitude) * dtan(KAABA.latitude) - dsin(latitude) * dcos(dLng)),
  );
  return {
    bearing: Math.round(bearing * 1000) / 1000,
    direction: compassDirection(bearing),
    distanceKm: Math.round(haversineKm(latitude, longitude, KAABA.latitude, KAABA.longitude) * 10) / 10,
  };
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Sudut rotasi jarum kiblat relatif terhadap layar, berdasarkan heading perangkat.
 * heading: arah yang dihadap perangkat dari utara (0–360°).
 */
export function qiblaRelativeAngle(qiblaBearing: number, deviceHeading: number): number {
  return fixAngle(qiblaBearing - deviceHeading);
}
