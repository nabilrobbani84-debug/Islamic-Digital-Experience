import { create } from "zustand";

export type ToastTone = "success" | "error" | "info";

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface UiState {
  commandOpen: boolean;
  moreMenuOpen: boolean;
  toasts: Toast[];
  setCommandOpen: (open: boolean) => void;
  setMoreMenuOpen: (open: boolean) => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export const useUi = create<UiState>()((set, get) => ({
  commandOpen: false,
  moreMenuOpen: false,
  toasts: [],
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setMoreMenuOpen: (moreMenuOpen) => set({ moreMenuOpen }),
  pushToast: (toast) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...toast, id }] }));
    window.setTimeout(() => get().dismissToast(id), toast.tone === "error" ? 7000 : 4000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) => useUi.getState().pushToast({ tone: "success", title, description }),
  error: (title: string, description?: string) => useUi.getState().pushToast({ tone: "error", title, description }),
  info: (title: string, description?: string) => useUi.getState().pushToast({ tone: "info", title, description }),
};
