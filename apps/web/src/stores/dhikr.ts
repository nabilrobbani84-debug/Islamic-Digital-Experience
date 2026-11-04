import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ActiveDhikr {
  sessionId: string;
  dhikrItemId: string | null;
  label: string;
  target: number;
  count: number;
  startedAt: string;
  completedAt: string | null;
}

interface DhikrState {
  active: ActiveDhikr;
  increment: () => ActiveDhikr;
  reset: () => void;
  start: (args: { dhikrItemId: string | null; label: string; target: number }) => void;
  setTarget: (target: number) => void;
}

function fresh(dhikrItemId: string | null = null, label = "Hitungan bebas", target = 33): ActiveDhikr {
  return { sessionId: crypto.randomUUID(), dhikrItemId, label, target, count: 0, startedAt: new Date().toISOString(), completedAt: null };
}

/** Sesi dzikir aktif dipertahankan saat halaman ditutup (bukan data sensitif). */
export const useDhikr = create<DhikrState>()(
  persist(
    (set, get) => ({
      active: fresh(),
      increment: () => {
        const a = get().active;
        const count = a.count + 1;
        const next: ActiveDhikr = { ...a, count, completedAt: a.completedAt ?? (count >= a.target ? new Date().toISOString() : null) };
        set({ active: next });
        return next;
      },
      reset: () => {
        const a = get().active;
        set({ active: fresh(a.dhikrItemId, a.label, a.target) });
      },
      start: ({ dhikrItemId, label, target }) => set({ active: fresh(dhikrItemId, label, target) }),
      setTarget: (target) => set((s) => ({ active: { ...s.active, target: Math.max(1, Math.min(10_000, Math.round(target))), completedAt: null } })),
    }),
    { name: "nur-dhikr-active", version: 1 },
  ),
);
