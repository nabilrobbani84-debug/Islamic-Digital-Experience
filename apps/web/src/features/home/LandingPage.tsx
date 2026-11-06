import { useRef } from "react";
import { Link } from "react-router";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, ArrowRight, BookOpen, Clock } from "lucide-react";
import { TopNav } from "@/components/navigation/TopNav";
import { NurMark } from "@/components/navigation/NurLogo";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useNow } from "@/hooks/useNow";
import { SceneBoundary } from "@/three/components/SceneBoundary";
import { HeroFallback2D } from "@/three/components/Fallbacks2D";
import { LazyIslamicHeroScene } from "@/three/scenes";
import { useRenderTier } from "@/three/hooks/useRenderTier";
import { formatCountdown } from "@/lib/format";
import { isPrayerDayReady, PRAYER_LABELS, remainingMs, usePrayerDay } from "@/features/prayer/usePrayerTimes";
import { ModulesShowcase } from "./components/ModulesShowcase";
import { ValuesSection } from "./components/ValuesSection";

/**
 * Rentang progres scroll per bab. Semua nilai WAJIB di dalam 0..1 karena Framer Motion
 * mengakselerasi animasi scroll dengan WAAPI (offset di luar 0..1 memicu error).
 */
const CHAPTERS = [
  { range: [0, 0.04, 0.16, 0.22], out: [0, 1, 1, 0], eyebrow: "", title: "", body: "" },
  {
    range: [0.2, 0.27, 0.38, 0.44],
    out: [0, 1, 1, 0],
    eyebrow: "Al-Qur'an",
    title: "Membaca dengan tenang, tanpa gangguan.",
    body: "Teks Utsmani yang jernih, terjemahan, tafsir, murottal dengan sinkronisasi ayat, dan mode fokus. Animasi tidak pernah mengganggu bacaan.",
  },
  {
    range: [0.42, 0.49, 0.6, 0.66],
    out: [0, 1, 1, 0],
    eyebrow: "Waktu Sholat & Kiblat",
    title: "Dihitung di perangkat Anda.",
    body: "Mesin astronomi lokal menghitung jadwal sholat, arah kiblat, dan kalender Hijriah tanpa API pihak ketiga, tetap berfungsi saat offline.",
  },
  {
    range: [0.64, 0.71, 0.8, 0.86],
    out: [0, 1, 1, 0],
    eyebrow: "Dzikir, Doa & Hadis",
    title: "Teman ibadah sehari-hari.",
    body: "Penghitung dzikir dengan target dan riwayat, doa harian, Asmaul Husna, dan Hadis Arba'in dari dataset bersumber.",
  },
  {
    range: [0.84, 0.9, 0.98, 1],
    out: [0, 1, 1, 1],
    eyebrow: "Offline-first",
    title: "Ibadah tidak menunggu sinyal.",
    body: "Unduh Al-Qur'an dan audio sekali, lalu gunakan di mana saja. Progres tersinkron otomatis saat kembali online.",
  },
] as const;

function Chapter({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const chapter = CHAPTERS[index]!;
  const [a, , , d] = chapter.range;
  const input = [...chapter.range];
  const opacity = useTransform(progress, input, [...chapter.out]);
  const y = useTransform(progress, input, chapter.out.map((o, i) => (o === 1 ? 0 : i === 0 ? 40 : -40)));
  const pointerEvents = useTransform(opacity, (o) => (o > 0.5 ? "auto" : "none"));
  // Disembunyikan sepenuhnya di luar rentangnya agar tidak pernah bertumpuk dengan bab lain.
  const visibility = useTransform(progress, (v) => (v < a - 0.004 || v > d + 0.004 ? "hidden" : "visible"));
  return (
    <motion.article style={{ opacity, y, pointerEvents, visibility }} className="absolute inset-x-0 bottom-[14%] mx-auto max-w-7xl px-5 sm:px-8 md:bottom-auto md:top-1/2 md:-translate-y-1/2">
      <div className="nur-glass max-w-lg rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-semibold tracking-[0.24em] text-gold-text uppercase">{chapter.eyebrow}</p>
        <h2 className="mt-3 text-2xl font-bold text-fg sm:text-3xl">{chapter.title}</h2>
        <p className="mt-3 text-muted">{chapter.body}</p>
      </div>
    </motion.article>
  );
}

function NextPrayerPill() {
  const now = useNow(1000);
  const day = usePrayerDay(now);
  if (!isPrayerDayReady(day) || !day.next) return null;
  return (
    <Link to="/prayer" className="nur-glass inline-flex items-center gap-3 rounded-full py-2 pr-4 pl-2 text-sm">
      <span className="grid size-8 place-items-center rounded-full bg-emerald-nur/25 text-gold-text">
        <Clock className="size-4" aria-hidden />
      </span>
      <span className="text-muted">
        {PRAYER_LABELS[day.next.key]} di {day.location.name}
      </span>
      <span className="font-semibold text-fg tabular-nums" aria-live="off">
        {formatCountdown(remainingMs(day.next, now))}
      </span>
    </Link>
  );
}

function HeroIntro({ progress }: { progress: MotionValue<number> }) {
  const opacity = useTransform(progress, [0, 0.12, 0.2], [1, 1, 0]);
  const y = useTransform(progress, [0, 0.2], [0, -60]);
  const pointerEvents = useTransform(opacity, (o) => (o > 0.4 ? "auto" : "none"));
  const visibility = useTransform(progress, (v) => (v > 0.21 ? "hidden" : "visible"));
  return (
    <motion.div style={{ opacity, y, pointerEvents, visibility }} className="absolute inset-0 flex items-end pb-20 md:items-center md:pb-0">
      <div className="mx-auto w-full max-w-7xl px-5 pt-16 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="max-w-2xl">
          <div className="mb-6 hidden items-center gap-3 sm:flex">
            <NurMark className="size-11" />
            <span className="text-sm font-semibold tracking-[0.4em] text-gold-soft">NUR</span>
          </div>
          <h1 className="text-[2rem] leading-[1.1] font-bold tracking-tight sm:text-6xl sm:leading-[1.08] lg:text-7xl">
            <span className="nur-text-gradient">Your Spiritual Journey, Reimagined.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-ivory/85 [text-shadow:0_2px_18px_rgb(0_0_0/0.7)] sm:mt-6 sm:text-xl">Explore the beauty of Islam through a more meaningful digital experience.</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-9">
            <a href="#experience-end" className="inline-flex h-13 items-center gap-2 rounded-2xl bg-gradient-to-b from-gold-soft to-gold px-7 font-semibold text-navy shadow-glow transition-transform active:scale-[0.97]">
              Explore NUR <ArrowDown className="size-4" aria-hidden />
            </a>
            <Link to="/quran" className="inline-flex h-13 items-center gap-2 rounded-2xl border border-ivory/20 bg-ivory/5 px-7 font-semibold text-ivory backdrop-blur transition-colors hover:border-gold/50">
              <BookOpen className="size-4" aria-hidden /> Start Reading Quran
            </Link>
          </div>
          <div className="mt-5 sm:mt-8">
            <NextPrayerPill />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ScrollIndicator({ progress }: { progress: MotionValue<number> }) {
  const scaleY = useTransform(progress, [0, 1], [0, 1]);
  return (
    <div className="absolute top-1/2 right-5 hidden h-40 w-px -translate-y-1/2 bg-ivory/15 md:block" aria-hidden>
      <motion.div style={{ scaleY }} className="h-full w-px origin-top bg-gold" />
    </div>
  );
}

/** Landing immersive: scene 3D sticky, konten berganti mengikuti progres scroll. */
export default function LandingPage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const tier = useRenderTier();
  const reducedMotion = useReducedMotion();

  return (
    <div className="dark bg-night text-fg">
      <div className="fixed inset-x-0 top-0 z-50">
        <TopNav transparent />
      </div>
      <main id="main">
        <section ref={ref} className="relative h-[460vh]" aria-label="Pengenalan NUR">
          <div className="sticky top-0 h-dvh overflow-hidden">
            <SceneBoundary tier={tier} className="absolute inset-0" label="Ilustrasi masjid" fallback={<HeroFallback2D />}>
              {(active) => tier !== "none" && <LazyIslamicHeroScene tier={tier} progress={scrollYProgress} reducedMotion={reducedMotion} active={active} />}
            </SceneBoundary>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night/95 via-night/45 to-transparent md:bg-gradient-to-r md:from-night/80 md:via-night/25 md:to-transparent" aria-hidden />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-night to-transparent" aria-hidden />
            <HeroIntro progress={scrollYProgress} />
            {CHAPTERS.slice(1).map((_, i) => (
              <Chapter key={i + 1} index={i + 1} progress={scrollYProgress} />
            ))}
            <ScrollIndicator progress={scrollYProgress} />
          </div>
        </section>
        <div id="experience-end" />
        <ModulesShowcase />
        <ValuesSection />
        <section className="relative overflow-hidden px-5 py-24 text-center sm:py-32">
          <div className="nur-pattern absolute inset-0 opacity-70" aria-hidden />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-bold sm:text-5xl">
              <span className="nur-text-gradient">Mulai perjalanan Anda.</span>
            </h2>
            <p className="mt-4 text-lg text-muted">Buat akun gratis untuk menyimpan bookmark, progres bacaan, dan riwayat ibadah di semua perangkat.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/register" className="inline-flex h-13 items-center gap-2 rounded-2xl bg-emerald-nur px-7 font-semibold text-ivory">
                Buat akun <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link to="/login" className="inline-flex h-13 items-center rounded-2xl border border-line px-7 font-semibold text-fg hover:border-gold/50">
                Saya sudah punya akun
              </Link>
            </div>
          </div>
        </section>
        <footer className="border-t border-line px-5 py-10 text-center text-sm text-muted">
          <p>© NUR Islamic Digital Experience. Seluruh perhitungan ibadah dilakukan secara lokal di perangkat Anda.</p>
        </footer>
      </main>
    </div>
  );
}
