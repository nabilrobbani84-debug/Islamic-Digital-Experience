import { create } from "zustand";

interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  update: (() => Promise<void>) | null;
  dismiss: () => void;
}

export const usePwa = create<PwaState>()((set) => ({
  needRefresh: false,
  offlineReady: false,
  update: null,
  dismiss: () => set({ needRefresh: false, offlineReady: false }),
}));

/** Mendaftarkan service worker (hanya di build production). */
export async function registerPwa(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const { registerSW } = await import("virtual:pwa-register");
  const updateSW = registerSW({
    onNeedRefresh: () => usePwa.setState({ needRefresh: true }),
    onOfflineReady: () => usePwa.setState({ offlineReady: true }),
  });
  usePwa.setState({ update: () => updateSW(true) });
}
