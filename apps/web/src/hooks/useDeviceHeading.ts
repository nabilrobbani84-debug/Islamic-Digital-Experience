import { useCallback, useEffect, useRef, useState } from "react";

export type HeadingStatus = "unsupported" | "needs-permission" | "denied" | "waiting" | "active";

/** Akurasi heading dalam derajat. null = tidak diketahui (perangkat tidak melaporkan). */
export interface HeadingState {
  status: HeadingStatus;
  heading: number | null;
  accuracy: number | null;
  /** true jika sumber heading absolut terhadap utara (bukan orientasi relatif). */
  absolute: boolean;
}

interface IOSOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}

interface OrientationEventCtor {
  requestPermission?: () => Promise<"granted" | "denied">;
}

function supported(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

/**
 * Heading kompas perangkat via DeviceOrientation API.
 * - iOS: webkitCompassHeading (butuh izin eksplisit).
 * - Android/Chrome: event deviceorientationabsolute (alpha absolut).
 * Tanpa sumber absolut, heading TIDAK diklaim akurat.
 */
export function useDeviceHeading() {
  const needsPermission =
    supported() && typeof (window.DeviceOrientationEvent as unknown as OrientationEventCtor).requestPermission === "function";
  const [state, setState] = useState<HeadingState>(() => ({
    status: !supported() ? "unsupported" : needsPermission ? "needs-permission" : "waiting",
    heading: null,
    accuracy: null,
    absolute: false,
  }));
  const [listening, setListening] = useState(supported() && !needsPermission);
  const smoothed = useRef<number | null>(null);

  useEffect(() => {
    if (!listening) return;
    const apply = (raw: number, absolute: boolean, accuracy: number | null): void => {
      // Penghalusan sudut melingkar agar jarum tidak bergetar.
      const prev = smoothed.current;
      let next = raw;
      if (prev !== null) {
        const delta = ((raw - prev + 540) % 360) - 180;
        next = (prev + delta * 0.25 + 360) % 360;
      }
      smoothed.current = next;
      setState({ status: "active", heading: next, accuracy, absolute });
    };
    const onAbsolute = (e: DeviceOrientationEvent): void => {
      if (e.alpha === null) return;
      apply((360 - e.alpha) % 360, true, null);
    };
    const onRelative = (e: DeviceOrientationEvent): void => {
      const ios = e as IOSOrientationEvent;
      if (typeof ios.webkitCompassHeading === "number") {
        apply(ios.webkitCompassHeading, true, ios.webkitCompassAccuracy ?? null);
      } else if (e.absolute && e.alpha !== null) {
        apply((360 - e.alpha) % 360, true, null);
      }
    };
    const hasAbsoluteEvent = "ondeviceorientationabsolute" in window;
    if (hasAbsoluteEvent) window.addEventListener("deviceorientationabsolute", onAbsolute as EventListener);
    window.addEventListener("deviceorientation", onRelative);
    const timeout = window.setTimeout(() => {
      setState((s) => (s.status === "waiting" ? { ...s, status: "unsupported" } : s));
    }, 4000);
    return () => {
      if (hasAbsoluteEvent) window.removeEventListener("deviceorientationabsolute", onAbsolute as EventListener);
      window.removeEventListener("deviceorientation", onRelative);
      window.clearTimeout(timeout);
    };
  }, [listening]);

  const requestPermission = useCallback(async () => {
    const ctor = window.DeviceOrientationEvent as unknown as OrientationEventCtor;
    if (!ctor.requestPermission) {
      setListening(true);
      return;
    }
    try {
      const result = await ctor.requestPermission();
      if (result === "granted") {
        setState((s) => ({ ...s, status: "waiting" }));
        setListening(true);
      } else setState((s) => ({ ...s, status: "denied" }));
    } catch {
      setState((s) => ({ ...s, status: "denied" }));
    }
  }, []);

  return { ...state, requestPermission };
}
