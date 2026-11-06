import { Outlet, ScrollRestoration, useLocation } from "react-router";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { SessionBootstrap } from "@/app/providers/SessionBootstrap";
import { Toaster } from "@/components/feedback/Toaster";
import { CommandPalette } from "@/components/navigation/CommandPalette";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { api } from "@/services/api";
import { usePwa } from "@/services/pwa";

function ConnectivityBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-navy">
      <WifiOff className="size-3.5" aria-hidden />
      Mode offline — fitur yang sudah tersimpan tetap dapat digunakan.
    </div>
  );
}

function MockBanner() {
  const { pathname } = useLocation();
  // Di landing banner menimpa tombol CTA pada layar kecil; peringatan mock tetap tampil di seluruh halaman aplikasi.
  if (api.mode !== "mock" || pathname === "/") return null;
  return (
    <div className="fixed bottom-20 left-3 z-[60] rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-700 backdrop-blur dark:text-amber-200 lg:bottom-3" role="note">
      MODE MOCK DEVELOPMENT — data contoh, bukan konten keagamaan
    </div>
  );
}

function UpdatePrompt() {
  const { needRefresh, update, dismiss } = usePwa();
  if (!needRefresh) return null;
  return (
    <div role="alert" className="nur-glass fixed right-4 bottom-24 z-[85] flex max-w-sm items-center gap-3 rounded-2xl px-4 py-3 shadow-xl lg:bottom-6">
      <p className="text-sm text-fg">Versi baru NUR tersedia.</p>
      <button type="button" onClick={() => void update?.()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-nur px-3 py-1.5 text-xs font-semibold text-ivory">
        <RefreshCw className="size-3.5" aria-hidden /> Perbarui
      </button>
      <button type="button" onClick={dismiss} aria-label="Nanti saja" className="rounded-lg p-1 text-muted hover:text-fg">
        <X className="size-4" />
      </button>
    </div>
  );
}

export function RootLayout() {
  return (
    <>
      <SessionBootstrap />
      <ConnectivityBanner />
      <Outlet />
      <CommandPalette />
      <Toaster />
      <UpdatePrompt />
      <MockBanner />
      <ScrollRestoration />
    </>
  );
}
