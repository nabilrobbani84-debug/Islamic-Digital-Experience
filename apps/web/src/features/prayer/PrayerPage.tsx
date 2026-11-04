import { useMemo, useState } from "react";
import { Bell, BellOff, Clock, MapPin, Minus, Plus, ShieldAlert } from "lucide-react";
import { calculatePrayerTimes, OBLIGATORY_PRAYERS, PRAYER_KEYS, PRAYER_METHODS, type PrayerKey } from "@nur/islamic-calculations";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/feedback/States";
import { useNow } from "@/hooks/useNow";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePrayerSettings } from "@/stores/prayer-settings";
import { usePreferences } from "@/stores/preferences";
import { toast } from "@/stores/ui";
import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/cn";
import { SceneBoundary } from "@/three/components/SceneBoundary";
import { LazyPrayerSunScene } from "@/three/scenes";
import { useRenderTier } from "@/three/hooks/useRenderTier";
import { LocationDialog } from "./components/LocationDialog";
import { SunPath2D } from "./components/SunPath2D";
import { notificationsSupported } from "./PrayerReminders";
import { isPrayerDayReady, PRAYER_LABELS, remainingMs, usePrayerDay, type PrayerDay } from "./usePrayerTimes";

function dayFraction(day: PrayerDay, now: Date): { progress: number; markers: { key: string; t: number; label: string }[] } {
  const rise = day.today.times.sunrise;
  const set = day.today.times.maghrib;
  if (!rise || !set) return { progress: 0.5, markers: [] };
  const start = Date.parse(rise.instant);
  const span = Date.parse(set.instant) - start;
  const markers = (["dhuhr", "asr"] as const).flatMap((k) => {
    const v = day.today.times[k];
    return v ? [{ key: k, t: (Date.parse(v.instant) - start) / span, label: PRAYER_LABELS[k] }] : [];
  });
  return { progress: (now.getTime() - start) / span, markers };
}

function MonthlySchedule() {
  const { location, methodCode, asrMadhhab, adjustments } = usePrayerSettings();
  const [offset, setOffset] = useState(0);
  const rows = useMemo(() => {
    if (!location) return [];
    const now = new Date();
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    const year = base.getUTCFullYear();
    const month = base.getUTCMonth() + 1;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return Array.from({ length: days }, (_, i) => {
      const date = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
      try {
        return { date, result: calculatePrayerTimes({ latitude: location.latitude, longitude: location.longitude, elevation: location.elevation ?? undefined, timezone: location.timezone, date, method: methodCode, asrMadhhab, adjustments }) };
      } catch {
        return { date, result: null };
      }
    });
  }, [location, methodCode, asrMadhhab, adjustments, offset]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const label = rows[0] ? new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${rows[0].date}T00:00:00Z`)) : "";
  return (
    <Card>
      <CardHeader
        title="Jadwal bulanan"
        description={label}
        action={
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => setOffset((o) => o - 1)}>
              Sebelumnya
            </Button>
            <Button size="sm" variant="outline" onClick={() => setOffset((o) => o + 1)}>
              Berikutnya
            </Button>
          </div>
        }
      />
      <div className="-mx-2 overflow-x-auto" tabIndex={0} role="region" aria-label={`Tabel jadwal sholat ${label}`}>
        <table className="w-full min-w-[560px] text-sm">
          <caption className="sr-only">Jadwal sholat {label}</caption>
          <thead>
            <tr className="text-left text-xs text-muted">
              <th scope="col" className="px-2 py-2 font-medium">Tanggal</th>
              {PRAYER_KEYS.map((k) => (
                <th key={k} scope="col" className="px-2 py-2 font-medium">
                  {PRAYER_LABELS[k]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ date, result }) => (
              <tr key={date} className={cn("border-t border-line tabular-nums", date === todayIso && "bg-emerald-nur/10 font-semibold")} aria-current={date === todayIso ? "date" : undefined}>
                <th scope="row" className="px-2 py-2 text-left font-medium">{Number(date.slice(8))}</th>
                {PRAYER_KEYS.map((k) => (
                  <td key={k} className="px-2 py-2">
                    {result?.times[k]?.label ?? "--:--"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MethodSettings() {
  const { methodCode, setMethod, asrMadhhab, setAsrMadhhab, adjustments, setAdjustment } = usePrayerSettings();
  const method = PRAYER_METHODS[methodCode];
  return (
    <Card>
      <CardHeader title="Metode perhitungan" description="Dihitung lokal oleh Islamic Calculation Engine" />
      <div className="space-y-5">
        <Select label="Metode" value={methodCode} onChange={(e) => setMethod(e.target.value)}>
          {Object.values(PRAYER_METHODS).map((m) => (
            <option key={m.code} value={m.code}>
              {m.name}
            </option>
          ))}
        </Select>
        {method && (
          <div className="rounded-2xl bg-surface-2 p-4 text-sm">
            <p className="text-muted">
              Subuh {method.fajrAngle}° · Isya {method.ishaIntervalMinutes ? `${method.ishaIntervalMinutes} menit setelah Maghrib` : `${method.ishaAngle}°`}
              {method.ihtiyatMinutes ? ` · ihtiyath ${method.ihtiyatMinutes} menit` : ""}
            </p>
            {!method.verified && (
              <p className="mt-2 flex items-start gap-2 text-amber-600 dark:text-amber-300">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {method.note ?? "Parameter belum diverifikasi dengan dokumen resmi penerbit metode."}
              </p>
            )}
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-medium">Madzhab Ashar</p>
          <Segmented
            label="Madzhab Ashar"
            value={asrMadhhab}
            onChange={setAsrMadhhab}
            options={[
              { value: "STANDARD", label: "Jumhur (Syafi'i)" },
              { value: "HANAFI", label: "Hanafi" },
            ]}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Penyesuaian waktu (menit)</p>
          <ul className="divide-y divide-line">
            {OBLIGATORY_PRAYERS.map((k) => {
              const v = adjustments[k] ?? 0;
              return (
                <li key={k} className="flex items-center justify-between py-1.5">
                  <span className="text-sm">{PRAYER_LABELS[k]}</span>
                  <span className="flex items-center gap-1">
                    <IconButton size="sm" label={`Kurangi ${PRAYER_LABELS[k]} 1 menit`} icon={<Minus className="size-4" />} onClick={() => setAdjustment(k, v - 1)} disabled={v <= -30} />
                    <output className="w-10 text-center text-sm font-semibold tabular-nums">{v > 0 ? `+${v}` : v}</output>
                    <IconButton size="sm" label={`Tambah ${PRAYER_LABELS[k]} 1 menit`} icon={<Plus className="size-4" />} onClick={() => setAdjustment(k, v + 1)} disabled={v >= 30} />
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
}

export default function PrayerPage() {
  const now = useNow(1000);
  const day = usePrayerDay(now);
  const [locationOpen, setLocationOpen] = useState(false);
  const tier = useRenderTier();
  const reducedMotion = useReducedMotion();
  const reminders = usePrayerSettings((s) => s.reminders);
  const setReminder = usePrayerSettings((s) => s.setReminder);
  const notificationsEnabled = usePreferences((s) => s.notificationsEnabled);
  const setPrefs = usePreferences((s) => s.set);

  const toggleReminder = async (key: PrayerKey): Promise<void> => {
    if (!notificationsSupported()) {
      toast.error("Notifikasi tidak didukung", "Browser ini tidak mendukung Notification API.");
      return;
    }
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Izin notifikasi ditolak", "Aktifkan izin notifikasi di pengaturan browser.");
        return;
      }
    }
    if (!notificationsEnabled) setPrefs({ notificationsEnabled: true });
    const on = !reminders[key];
    setReminder(key, on);
    toast.success(on ? `Pengingat ${PRAYER_LABELS[key]} aktif` : `Pengingat ${PRAYER_LABELS[key]} dimatikan`, on ? "Berbunyi selama NUR terbuka di perangkat ini." : undefined);
  };

  return (
    <div>
      <PageHeader eyebrow="Prayer" title="Waktu Sholat" description="Jadwal dihitung secara lokal dari koordinat dan zona waktu lokasi Anda." arabic="الصلاة" />
      {!day ? (
        <EmptyState icon={<MapPin className="size-6" />} title="Pilih lokasi untuk memulai" description="Gunakan GPS perangkat, pilih kota, atau masukkan koordinat. Tidak ada data lokasi yang dikirim ke layanan pihak ketiga." action={<Button onClick={() => setLocationOpen(true)}>Atur lokasi</Button>} />
      ) : !isPrayerDayReady(day) ? (
        <EmptyState icon={<ShieldAlert className="size-6" />} title="Perhitungan gagal" description={day.error} action={<Button onClick={() => setLocationOpen(true)}>Ubah lokasi</Button>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5">
            <Card tone="accent" padded={false}>
              <div className="flex flex-wrap items-start justify-between gap-4 p-6">
                <div>
                  <button type="button" onClick={() => setLocationOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
                    <MapPin className="size-4 text-gold-text" aria-hidden /> {day.location.name} · {day.location.timezone}
                  </button>
                  {day.next && (
                    <>
                      <p className="mt-4 text-xs tracking-wider text-muted uppercase">Menuju {PRAYER_LABELS[day.next.key]}</p>
                      <p className="mt-1 text-5xl font-bold text-gold-text tabular-nums sm:text-6xl" role="timer" aria-live="off">
                        {formatCountdown(remainingMs(day.next, now))}
                      </p>
                      <p className="mt-2 text-sm text-muted">{day.next.current ? `Sekarang waktu ${PRAYER_LABELS[day.next.current]}` : "Di luar waktu sholat wajib"}</p>
                    </>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge tone="gold">{day.today.methodName}</Badge>
                  {day.today.highLatitudeRuleApplied && <Badge tone="warning">Aturan lintang tinggi</Badge>}
                </div>
              </div>
              <SceneBoundary tier={tier} className="h-44 px-2" fallback={<SunPath2D dayProgress={dayFraction(day, now).progress} markers={dayFraction(day, now).markers} />}>
                {(active) => {
                  const f = dayFraction(day, now);
                  return tier !== "none" && <LazyPrayerSunScene tier={tier} dayProgress={f.progress} markers={f.markers} reducedMotion={reducedMotion} active={active} />;
                }}
              </SceneBoundary>
            </Card>
            <MonthlySchedule />
          </div>
          <div className="space-y-5">
            <Card>
              <CardHeader title="Hari ini" icon={<Clock className="size-5" />} description={day.today.date} />
              <ul className="space-y-2">
                {PRAYER_KEYS.map((k) => {
                  const t = day.today.times[k];
                  const isNext = day.next?.key === k;
                  const obligatory = k !== "sunrise";
                  return (
                    <li key={k} className={cn("flex items-center justify-between rounded-2xl px-4 py-3", isNext ? "bg-emerald-nur text-ivory" : "bg-surface-2")}>
                      <span className="font-medium">{PRAYER_LABELS[k]}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-lg font-semibold tabular-nums">{t?.label ?? "--:--"}</span>
                        {obligatory && (
                          <IconButton
                            size="sm"
                            label={reminders[k] ? `Matikan pengingat ${PRAYER_LABELS[k]}` : `Aktifkan pengingat ${PRAYER_LABELS[k]}`}
                            aria-pressed={!!reminders[k]}
                            icon={reminders[k] ? <Bell className="size-4" /> : <BellOff className="size-4 opacity-60" />}
                            onClick={() => void toggleReminder(k)}
                            className={isNext ? "text-ivory hover:bg-emerald-deep" : undefined}
                          />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <MethodSettings />
          </div>
        </div>
      )}
      <LocationDialog open={locationOpen} onClose={() => setLocationOpen(false)} />
    </div>
  );
}
