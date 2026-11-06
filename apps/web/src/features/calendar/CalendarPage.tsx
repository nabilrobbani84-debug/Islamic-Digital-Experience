import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info, Minus, Plus, Star } from "lucide-react";
import {
  gregorianMonthCalendar,
  hijriMonthCalendar,
  HIJRI_MONTH_NAMES,
  HIJRI_MONTH_NAMES_ARABIC,
  ISLAMIC_EVENTS,
  toGregorian,
  toHijri,
  todayInTimeZone,
  type CalendarDay,
} from "@nur/islamic-calculations";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { Badge, PageHeader } from "@/components/ui/misc";
import { usePrayerSettings } from "@/stores/prayer-settings";
import { cn } from "@/lib/cn";

type View = "gregorian" | "hijri";

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const G_MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const sameG = (a: CalendarDay["gregorian"], b: CalendarDay["gregorian"]): boolean => a.year === b.year && a.month === b.month && a.day === b.day;

function parseIso(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y ?? 1970, month: m ?? 1, day: d ?? 1 };
}

export default function CalendarPage() {
  const timezone = usePrayerSettings((s) => s.location?.timezone) ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const adjustment = usePrayerSettings((s) => s.hijriAdjustment);
  const setAdjustment = usePrayerSettings((s) => s.setHijriAdjustment);
  const today = useMemo(() => parseIso(todayInTimeZone(timezone)), [timezone]);
  const todayHijri = useMemo(() => toHijri(today, { adjustmentDays: adjustment }), [today, adjustment]);

  const [view, setView] = useState<View>("gregorian");
  const [gCursor, setGCursor] = useState({ year: today.year, month: today.month });
  const [hCursor, setHCursor] = useState({ year: todayHijri.year, month: todayHijri.month });
  const [selected, setSelected] = useState(today);
  const [direction, setDirection] = useState(0);

  const days = useMemo(
    () => (view === "gregorian" ? gregorianMonthCalendar(gCursor.year, gCursor.month, { adjustmentDays: adjustment }) : hijriMonthCalendar(hCursor.year, hCursor.month, { adjustmentDays: adjustment })),
    [view, gCursor, hCursor, adjustment],
  );

  const move = (delta: number): void => {
    setDirection(delta);
    if (view === "gregorian") {
      setGCursor((c) => {
        const m = c.month + delta;
        return m < 1 ? { year: c.year - 1, month: 12 } : m > 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: m };
      });
    } else {
      setHCursor((c) => {
        const m = c.month + delta;
        return m < 1 ? { year: c.year - 1, month: 12 } : m > 12 ? { year: c.year + 1, month: 1 } : { year: c.year, month: m };
      });
    }
  };

  const goToday = (): void => {
    setGCursor({ year: today.year, month: today.month });
    setHCursor({ year: todayHijri.year, month: todayHijri.month });
    setSelected(today);
  };

  const title =
    view === "gregorian" ? `${G_MONTHS[gCursor.month - 1]} ${gCursor.year}` : `${HIJRI_MONTH_NAMES[hCursor.month - 1]} ${hCursor.year} H`;
  const subtitle = (() => {
    const first = days[0];
    const last = days[days.length - 1];
    if (!first || !last) return "";
    if (view === "gregorian") {
      const a = HIJRI_MONTH_NAMES[first.hijri.month - 1];
      const b = HIJRI_MONTH_NAMES[last.hijri.month - 1];
      return a === b ? `${a} ${first.hijri.year} H` : `${a} – ${b} ${last.hijri.year} H`;
    }
    const a = G_MONTHS[first.gregorian.month - 1];
    const b = G_MONTHS[last.gregorian.month - 1];
    return a === b ? `${a} ${first.gregorian.year}` : `${a} – ${b} ${last.gregorian.year}`;
  })();

  const selectedHijri = toHijri(selected, { adjustmentDays: adjustment });
  const selectedEvents = ISLAMIC_EVENTS.filter((e) => e.hijriMonth === selectedHijri.month && e.hijriDay === selectedHijri.day);

  const upcoming = useMemo(() => {
    const list: { name: string; hijri: string; date: Date }[] = [];
    for (const year of [todayHijri.year, todayHijri.year + 1]) {
      for (const e of ISLAMIC_EVENTS) {
        const g = toGregorian({ year, month: e.hijriMonth, day: e.hijriDay }, { adjustmentDays: adjustment });
        const date = new Date(Date.UTC(g.year, g.month - 1, g.day));
        if (date.getTime() >= Date.UTC(today.year, today.month - 1, today.day)) list.push({ name: e.name, hijri: `${e.hijriDay} ${HIJRI_MONTH_NAMES[e.hijriMonth - 1]} ${year} H`, date });
      }
    }
    return list.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 6);
  }, [todayHijri.year, adjustment, today]);

  const leading = days[0]?.weekday ?? 0;

  return (
    <div>
      <PageHeader eyebrow="Islamic Calendar" title="Kalender Hijriah" description="Konversi Masehi ↔ Hijriah dengan algoritma tabular lokal dan koreksi hari yang dapat disesuaikan." arabic="التقويم الهجري" />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold" aria-live="polite" data-testid="calendar-title">
                {title}
              </h2>
              <p className="text-sm text-muted">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Segmented
                label="Jenis kalender"
                size="sm"
                value={view}
                onChange={setView}
                options={[
                  { value: "gregorian", label: "Masehi" },
                  { value: "hijri", label: "Hijriah" },
                ]}
              />
              <IconButton label="Bulan sebelumnya" icon={<ChevronLeft className="size-5" />} onClick={() => move(-1)} />
              <Button size="sm" variant="outline" onClick={goToday}>
                Hari ini
              </Button>
              <IconButton label="Bulan berikutnya" icon={<ChevronRight className="size-5" />} onClick={() => move(1)} />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted" aria-hidden>
            {WEEKDAYS.map((d) => (
              <div key={d} className={cn("py-2", d === "Jum" && "text-gold-text")}>
                {d}
              </div>
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${view}-${title}`}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.22 }}
              role="group"
              aria-label={`Tanggal ${title}`}
              className="grid grid-cols-7 gap-1"
            >
              {Array.from({ length: leading }, (_, i) => (
                <div key={`pad-${i}`} aria-hidden />
              ))}
              {days.map((d) => {
                const isToday = sameG(d.gregorian, today);
                const isSelected = sameG(d.gregorian, selected);
                const primary = view === "gregorian" ? d.gregorian.day : d.hijri.day;
                const secondary = view === "gregorian" ? d.hijri.day : d.gregorian.day;
                const label = `${d.gregorian.day} ${G_MONTHS[d.gregorian.month - 1]} ${d.gregorian.year}, ${d.hijri.day} ${HIJRI_MONTH_NAMES[d.hijri.month - 1]} ${d.hijri.year} H${d.events.length ? `, ${d.events.map((e) => e.name).join(", ")}` : ""}`;
                return (
                  <button
                    key={`${d.gregorian.year}-${d.gregorian.month}-${d.gregorian.day}`}
                    type="button"
                    aria-pressed={isSelected}
                    aria-current={isToday ? "date" : undefined}
                    aria-label={label}
                    onClick={() => setSelected(d.gregorian)}
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors sm:aspect-[1.15]",
                      isSelected ? "bg-emerald-nur text-ivory" : "hover:bg-surface-2",
                      isToday && !isSelected && "ring-1 ring-gold",
                      d.weekday === 5 && !isSelected && "text-gold-text",
                    )}
                  >
                    <span className="text-base font-semibold sm:text-lg">{primary}</span>
                    <span className={cn("text-[10px]", isSelected ? "text-ivory/75" : "text-muted")}>{secondary}</span>
                    {d.events.length > 0 && <span className={cn("absolute top-1.5 right-1.5 size-1.5 rounded-full", isSelected ? "bg-ivory" : "bg-gold")} aria-hidden />}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </Card>

        <div className="space-y-5">
          <Card tone="accent">
            <p className="text-xs tracking-wider text-muted uppercase">Tanggal dipilih</p>
            <p className="mt-2 text-2xl font-bold">
              {selectedHijri.day} {selectedHijri.monthName} {selectedHijri.year} H
            </p>
            <p lang="ar" className="text-xl text-gold-text">
              {HIJRI_MONTH_NAMES_ARABIC[selectedHijri.month - 1]}
            </p>
            <p className="mt-1 text-muted">{new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "UTC" }).format(new Date(Date.UTC(selected.year, selected.month - 1, selected.day)))}</p>
            {selectedEvents.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedEvents.map((e) => (
                  <Badge key={e.key} tone="gold">
                    <Star className="size-3" aria-hidden /> {e.name}
                  </Badge>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Hari besar Islam" description="Perkiraan berdasarkan kalender tabular" />
            <ul className="space-y-2">
              {upcoming.map((e) => (
                <li key={`${e.name}-${e.hijri}`} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold">{e.name}</span>
                    <span className="block text-xs text-muted">{e.hijri}</span>
                  </span>
                  <span className="text-right text-xs text-muted">{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(e.date)}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Koreksi hari" description="Sesuaikan dengan penetapan otoritas setempat" />
            <div className="flex items-center justify-between">
              <span className="text-sm">Geser tanggal Hijriah</span>
              <span className="flex items-center gap-2">
                <IconButton size="sm" label="Kurangi satu hari" icon={<Minus className="size-4" />} disabled={adjustment <= -2} onClick={() => setAdjustment(adjustment - 1)} />
                <output className="w-10 text-center font-semibold tabular-nums" aria-live="polite">
                  {adjustment > 0 ? `+${adjustment}` : adjustment}
                </output>
                <IconButton size="sm" label="Tambah satu hari" icon={<Plus className="size-4" />} disabled={adjustment >= 2} onClick={() => setAdjustment(adjustment + 1)} />
              </span>
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Kalender ini memakai algoritma tabular (aritmetis). Hasilnya bukan hasil rukyat maupun penetapan resmi pemerintah dan dapat berbeda 1–2 hari.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
