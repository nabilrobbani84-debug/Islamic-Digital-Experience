import { Link } from "react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Calculator, CalendarDays, Clock, Compass, Hand, MapPin, ScrollText, Sparkles, Star } from "lucide-react";
import { toHijri, HIJRI_MONTH_NAMES, todayInTimeZone } from "@nur/islamic-calculations";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, ProgressBar, ProgressRing } from "@/components/ui/misc";
import { EmptyState } from "@/components/feedback/States";
import { useNow } from "@/hooks/useNow";
import { useAuth } from "@/stores/auth";
import { usePrayerSettings } from "@/stores/prayer-settings";
import { db } from "@/services/offline/db";
import { formatCountdown, formatGregorianLong, formatRelative, greetingForHour } from "@/lib/format";
import { isPrayerDayReady, PRAYER_LABELS, remainingMs, usePrayerDay } from "@/features/prayer/usePrayerTimes";
import { useSurahs } from "@/features/quran/api";
import { OBLIGATORY_PRAYERS } from "@nur/islamic-calculations";
import { DailyInspiration } from "./DailyInspiration";
import { cn } from "@/lib/cn";

const QUICK_ACCESS = [
  { to: "/quran", label: "Al-Qur'an", icon: BookOpen },
  { to: "/prayer", label: "Waktu Sholat", icon: Clock },
  { to: "/qibla", label: "Kiblat", icon: Compass },
  { to: "/dhikr", label: "Dzikir", icon: Sparkles },
  { to: "/duas", label: "Doa", icon: Hand },
  { to: "/calendar", label: "Kalender Hijriah", icon: CalendarDays },
  { to: "/zakat", label: "Kalkulator Zakat", icon: Calculator },
  { to: "/asmaul-husna", label: "Asmaul Husna", icon: Star },
] as const;

const DAILY_VERSE_TARGET = 20;

function Greeting() {
  const user = useAuth((s) => s.user);
  const now = useNow(60_000);
  const timezone = usePrayerSettings((s) => s.location?.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hijriAdjustment = usePrayerSettings((s) => s.hijriAdjustment);
  const [y, m, d] = todayInTimeZone(timezone, now).split("-").map(Number);
  const hijri = toHijri({ year: y ?? 2000, month: m ?? 1, day: d ?? 1 }, { adjustmentDays: hijriAdjustment });
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(now));
  return (
    <section aria-labelledby="greeting" className="mb-8">
      <p className="text-sm text-gold-text">Assalamu'alaikum</p>
      <h1 id="greeting" className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
        {greetingForHour(hour)}, {user?.name.split(" ")[0] ?? "Sahabat"}
      </h1>
      <p className="mt-2 text-muted">
        {formatGregorianLong(now, timezone)} · <span className="text-fg">{hijri.day} {HIJRI_MONTH_NAMES[hijri.month - 1]} {hijri.year} H</span>
        <span className="sr-only"> (kalender Hijriah tabular, dapat berbeda dari penetapan resmi)</span>
      </p>
    </section>
  );
}

function PrayerWidget() {
  const now = useNow(1000);
  const day = usePrayerDay(now);
  if (!day) {
    return (
      <Card tone="accent" className="h-full">
        <CardHeader title="Waktu Sholat" icon={<Clock className="size-5" />} />
        <EmptyState icon={<MapPin className="size-6" />} title="Lokasi belum diatur" description="Pilih kota atau gunakan lokasi perangkat untuk menghitung jadwal sholat secara lokal." action={<Link to="/prayer" className="inline-flex h-10 items-center rounded-xl bg-emerald-nur px-4 text-sm font-semibold text-ivory">Atur lokasi</Link>} className="border-0 bg-transparent py-4 shadow-none" />
      </Card>
    );
  }
  if (!isPrayerDayReady(day)) {
    return (
      <Card tone="accent" className="h-full">
        <CardHeader title="Waktu Sholat" icon={<Clock className="size-5" />} />
        <p className="text-sm text-red-400">{day.error}</p>
      </Card>
    );
  }
  const { today, next, location } = day;
  return (
    <Card tone="accent" className="h-full">
      <CardHeader
        title="Waktu Sholat"
        description={
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3.5" aria-hidden /> {location.name} · {today.methodName}
          </span>
        }
        icon={<Clock className="size-5" />}
        action={
          <Link to="/prayer" className="text-sm font-medium text-gold-text hover:underline">
            Detail
          </Link>
        }
      />
      {next && (
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-wider text-muted uppercase">Berikutnya</p>
            <p className="text-2xl font-bold text-fg">{PRAYER_LABELS[next.key]}</p>
            {next.current && <Badge tone="emerald" className="mt-1">Sedang waktu {PRAYER_LABELS[next.current]}</Badge>}
          </div>
          <p className="text-3xl font-bold text-gold-text tabular-nums sm:text-4xl" aria-label={`Menuju ${PRAYER_LABELS[next.key]}`}>
            {formatCountdown(remainingMs(next, now))}
          </p>
        </div>
      )}
      <ol className="grid grid-cols-5 gap-1.5">
        {OBLIGATORY_PRAYERS.map((key) => {
          const t = today.times[key];
          const isNext = next?.key === key;
          return (
            <li key={key} className={cn("rounded-2xl px-1 py-3 text-center", isNext ? "bg-emerald-nur text-ivory" : "bg-surface-2")}>
              <span className={cn("block text-[11px]", isNext ? "text-ivory/80" : "text-muted")}>{PRAYER_LABELS[key]}</span>
              <span className="mt-1 block text-sm font-semibold tabular-nums">{t?.label ?? "--:--"}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function QuranProgressCard() {
  const progress = useLiveQuery(() => db.reading_progress.get("last-read"), []);
  const todayCount = useLiveQuery(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return db.reading_history.where("readAt").aboveOrEqual(start.toISOString()).count();
  }, []);
  const surahs = useSurahs();
  const surah = surahs.data?.data.find((s) => s.number === progress?.surahNumber);
  const ratio = surah && progress ? progress.verseNumber / surah.totalVerses : 0;
  return (
    <Card className="h-full">
      <CardHeader title="Progres Al-Qur'an" icon={<BookOpen className="size-5" />} />
      {progress ? (
        <div className="flex items-center gap-5">
          <ProgressRing value={ratio} size={96} label="Progres surah terakhir">
            <span className="text-lg font-bold">{Math.round(ratio * 100)}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted">Terakhir dibaca {formatRelative(progress.updatedAt)}</p>
            <p className="mt-1 truncate text-lg font-semibold">{surah?.nameLatin ?? `Surah ${progress.surahNumber}`}</p>
            <p className="text-sm text-muted">Ayat {progress.verseNumber}{surah ? ` dari ${surah.totalVerses}` : ""}</p>
            <Link to={`/quran/${progress.surahNumber}?ayat=${progress.verseNumber}`} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-nur px-4 text-sm font-semibold text-ivory">
              Continue Reading <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted">
          <p>Belum ada bacaan tersimpan.</p>
          <Link to="/quran" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-nur px-4 text-sm font-semibold text-ivory">
            Mulai membaca <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}
      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs text-muted">
          <span>Target harian</span>
          <span>
            {todayCount ?? 0} / {DAILY_VERSE_TARGET} ayat
          </span>
        </div>
        <ProgressBar value={(todayCount ?? 0) / DAILY_VERSE_TARGET} label="Target ayat harian" />
      </div>
    </Card>
  );
}

function ActivityOverview() {
  const stats = useLiveQuery(async () => {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [history, dhikr, bookmarks, zakat] = await Promise.all([
      db.reading_history.where("readAt").aboveOrEqual(weekAgo).toArray(),
      db.dhikr_sessions.where("startedAt").aboveOrEqual(weekAgo).toArray(),
      db.bookmarks.filter((b) => !b.deletedAt).count(),
      db.zakat_history.count(),
    ]);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      return { key, label: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(d), verses: history.filter((h) => h.readAt.startsWith(key)).length };
    });
    return { days, dhikrCount: dhikr.reduce((s, x) => s + x.count, 0), bookmarks, zakat };
  }, []);
  const maxVerses = Math.max(1, ...(stats?.days.map((d) => d.verses) ?? [1]));
  return (
    <Card>
      <CardHeader title="Aktivitas 7 hari" description="Tersimpan di perangkat dan tersinkron ke akun" icon={<ScrollText className="size-5" />} />
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div className="flex h-36 items-end gap-2" role="img" aria-label="Grafik ayat dibaca per hari">
          {(stats?.days ?? []).map((d) => (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
              <motion.div initial={{ height: 0 }} animate={{ height: `${(d.verses / maxVerses) * 100}%` }} className="w-full min-h-1 rounded-t-lg bg-gradient-to-t from-emerald-nur to-gold/80" title={`${d.verses} ayat`} />
              <span className="text-[11px] text-muted">{d.label}</span>
            </div>
          ))}
        </div>
        <dl className="grid grid-cols-3 gap-3 md:grid-cols-1">
          {[
            { label: "Hitungan dzikir", value: stats?.dhikrCount ?? 0 },
            { label: "Bookmark ayat", value: stats?.bookmarks ?? 0 },
            { label: "Kalkulasi zakat", value: stats?.zakat ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-surface-2 px-4 py-3">
              <dt className="text-xs text-muted">{s.label}</dt>
              <dd className="text-xl font-bold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div>
      <Greeting />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PrayerWidget />
        </div>
        <QuranProgressCard />
      </div>
      <section aria-labelledby="quick-access" className="mt-8">
        <h2 id="quick-access" className="mb-4 text-lg font-semibold">
          Akses cepat
        </h2>
        <ul className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
          {QUICK_ACCESS.map((q, i) => (
            <motion.li key={q.to} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link to={q.to} className="group flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface/70 px-1 text-center transition-all hover:-translate-y-0.5 hover:border-gold/40 sm:h-28">
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-nur/15 text-gold-text transition-transform group-hover:scale-110">
                  <q.icon className="size-5" aria-hidden />
                </span>
                <span className="text-[11px] leading-tight font-medium sm:text-xs">{q.label}</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </section>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <DailyInspiration />
        <ActivityOverview />
      </div>
    </div>
  );
}
