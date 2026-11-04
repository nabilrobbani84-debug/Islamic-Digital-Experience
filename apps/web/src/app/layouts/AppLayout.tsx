import { Suspense } from "react";
import { Outlet, useLocation } from "react-router";
import { motion } from "framer-motion";
import { TopNav } from "@/components/navigation/TopNav";
import { MobileBottomNav } from "@/components/navigation/MobileNav";
import { PageLoader } from "@/components/feedback/RouteFallbacks";
import { AudioPlayerBar } from "@/features/quran/audio/AudioPlayerBar";
import { RequireAuth } from "@/features/auth/guards";
import { PrayerReminderScheduler } from "@/features/prayer/PrayerReminders";
import { useAudio } from "@/stores/audio";
import { cn } from "@/lib/cn";

/** Layout aplikasi (wajib login): navigasi atas, navigasi bawah mobile, mini player audio. */
export function AppLayout() {
  const location = useLocation();
  const hasPlayer = useAudio((s) => s.status !== "idle");
  return (
    <RequireAuth>
      <div className="relative min-h-dvh">
        <div className="nur-pattern pointer-events-none fixed inset-0 -z-10 opacity-70" aria-hidden />
        <div className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgb(8_127_91/0.18),transparent)]" aria-hidden />
        <TopNav />
        <main id="main" tabIndex={-1} className={cn("mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 sm:pt-10 focus:outline-none", hasPlayer ? "pb-44 lg:pb-32" : "pb-28 lg:pb-16")}>
          <motion.div key={location.pathname.split("/").slice(0, 2).join("/")} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </motion.div>
        </main>
        <AudioPlayerBar />
        <MobileBottomNav />
        <PrayerReminderScheduler />
      </div>
    </RequireAuth>
  );
}
