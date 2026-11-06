import { useCallback, useState } from "react";

export type GeoStatus = "idle" | "requesting" | "success" | "denied" | "unavailable" | "error";

export interface GeoResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
}

/** Geolocation browser, hanya diminta setelah tindakan eksplisit pengguna. */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [position, setPosition] = useState<GeoResult | null>(null);

  const request = useCallback((): Promise<GeoResult | null> => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return Promise.resolve(null);
    }
    setStatus("requesting");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result: GeoResult = {
            latitude: Math.round(pos.coords.latitude * 1e5) / 1e5,
            longitude: Math.round(pos.coords.longitude * 1e5) / 1e5,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
          };
          setPosition(result);
          setStatus("success");
          resolve(result);
        },
        (err) => {
          setStatus(err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.POSITION_UNAVAILABLE ? "unavailable" : "error");
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 15_000, maximumAge: 10 * 60_000 },
      );
    });
  }, []);

  return { status, position, request };
}
