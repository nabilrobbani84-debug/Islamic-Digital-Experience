import { useEffect, useState } from "react";

/** Waktu sekarang yang diperbarui setiap `intervalMs`, selaras dengan pergantian detik. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const tick = (): void => {
      setNow(new Date());
      timer = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    timer = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    return () => window.clearTimeout(timer);
  }, [intervalMs]);
  return now;
}
