import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, Info, MapPin, Navigation, ShieldAlert, Smartphone } from "lucide-react";
import { calculateQibla, qiblaRelativeAngle } from "@nur/islamic-calculations";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/feedback/States";
import { useDeviceHeading } from "@/hooks/useDeviceHeading";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { usePrayerSettings } from "@/stores/prayer-settings";
import { formatNumber } from "@/lib/format";
import { SceneBoundary } from "@/three/components/SceneBoundary";
import { LazyQiblaCompass3D } from "@/three/scenes";
import { useRenderTier } from "@/three/hooks/useRenderTier";
import { LocationDialog } from "@/features/prayer/components/LocationDialog";
import { QiblaCompass2D } from "./QiblaCompass2D";

function accuracyInfo(accuracy: number | null, active: boolean): { label: string; tone: "emerald" | "warning" | "danger" | "neutral" } {
  if (!active) return { label: "Sensor tidak aktif", tone: "neutral" };
  if (accuracy === null) return { label: "Akurasi tidak dilaporkan perangkat", tone: "warning" };
  if (accuracy < 0) return { label: "Perlu kalibrasi", tone: "danger" };
  if (accuracy <= 15) return { label: `Baik (±${Math.round(accuracy)}°)`, tone: "emerald" };
  if (accuracy <= 30) return { label: `Sedang (±${Math.round(accuracy)}°)`, tone: "warning" };
  return { label: `Rendah (±${Math.round(accuracy)}°) — kalibrasi`, tone: "danger" };
}

export default function QiblaPage() {
  const location = usePrayerSettings((s) => s.location);
  const [locationOpen, setLocationOpen] = useState(false);
  const sensor = useDeviceHeading();
  const tier = useRenderTier();
  const reducedMotion = useReducedMotion();
  const qibla = useMemo(() => (location ? calculateQibla(location) : null), [location]);
  const active = sensor.status === "active" && sensor.absolute;
  const heading = active ? sensor.heading : null;
  const relative = qibla && heading !== null ? qiblaRelativeAngle(qibla.bearing, heading) : null;
  const offBy = relative === null ? null : relative > 180 ? relative - 360 : relative;
  const aligned = offBy !== null && Math.abs(offBy) <= 5;
  const vibrated = useRef(false);

  useEffect(() => {
    if (aligned && !vibrated.current) {
      vibrated.current = true;
      navigator.vibrate?.(40);
    } else if (!aligned) vibrated.current = false;
  }, [aligned]);

  const accuracy = accuracyInfo(sensor.accuracy, active);

  return (
    <div>
      <PageHeader eyebrow="Qibla" title="Arah Kiblat" description="Azimut menuju Ka'bah dihitung lokal dari koordinat Anda (lingkaran besar, WGS84)." arabic="القبلة" />
      {!location || !qibla ? (
        <EmptyState icon={<MapPin className="size-6" />} title="Lokasi diperlukan" description="Pilih kota atau izinkan GPS untuk menghitung arah kiblat." action={<Button onClick={() => setLocationOpen(true)}>Atur lokasi</Button>} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card tone="accent" className="flex flex-col items-center">
            <div className="relative aspect-square w-full max-w-[420px]">
              <SceneBoundary tier={tier} className="h-full w-full" fallback={<QiblaCompass2D bearing={qibla.bearing} heading={heading} />} label="Kompas kiblat">
                {(isActive) => tier !== "none" && <LazyQiblaCompass3D tier={tier} bearing={qibla.bearing} heading={heading} reducedMotion={reducedMotion} active={isActive} />}
              </SceneBoundary>
            </div>
            <div className="mt-4 text-center" aria-live="polite">
              {active ? (
                aligned ? (
                  <p className="text-lg font-semibold text-accent">Anda menghadap kiblat</p>
                ) : (
                  <p className="text-lg font-semibold">
                    Putar {offBy !== null && offBy > 0 ? "ke kanan" : "ke kiri"} {offBy !== null ? Math.abs(Math.round(offBy)) : 0}°
                  </p>
                )
              ) : (
                <p className="max-w-sm text-sm text-muted">Kompas tidak aktif. Dial menunjukkan arah kiblat relatif terhadap UTARA. Sejajarkan “U” dengan utara pada kompas fisik.</p>
              )}
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Hasil perhitungan" icon={<Compass className="size-5" />} />
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-surface-2 p-4">
                  <dt className="text-xs text-muted">Derajat kiblat</dt>
                  <dd className="text-3xl font-bold text-gold-text tabular-nums">{qibla.bearing.toFixed(2)}°</dd>
                  <dd className="text-xs text-muted">dari utara sejati</dd>
                </div>
                <div className="rounded-2xl bg-surface-2 p-4">
                  <dt className="text-xs text-muted">Arah</dt>
                  <dd className="text-2xl font-bold">{qibla.direction}</dd>
                  <dd className="text-xs text-muted">{formatNumber(Math.round(qibla.distanceKm))} km ke Ka'bah</dd>
                </div>
              </dl>
              <button type="button" onClick={() => setLocationOpen(true)} className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
                <MapPin className="size-4 text-gold-text" aria-hidden /> {location.name} ({location.latitude.toFixed(4)}, {location.longitude.toFixed(4)})
              </button>
            </Card>

            <Card>
              <CardHeader title="Sensor kompas" icon={<Smartphone className="size-5" />} action={<Badge tone={accuracy.tone}>{accuracy.label}</Badge>} />
              {sensor.status === "needs-permission" && (
                <Button leftIcon={<Navigation className="size-4" />} onClick={() => void sensor.requestPermission()}>
                  Aktifkan kompas
                </Button>
              )}
              {sensor.status === "denied" && (
                <p className="flex items-start gap-2 text-sm text-red-400" role="alert">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> Izin sensor ditolak. Arah tetap dapat dibaca dari derajat di atas.
                </p>
              )}
              {sensor.status === "unsupported" && <p className="text-sm text-muted">Perangkat atau browser ini tidak menyediakan heading kompas absolut. Gunakan derajat kiblat dengan kompas fisik.</p>}
              {sensor.status === "waiting" && <p className="text-sm text-muted">Menunggu data sensor…</p>}
              {sensor.status === "active" && !sensor.absolute && <p className="text-sm text-amber-500">Sensor hanya memberi orientasi relatif; arah tidak diklaim akurat.</p>}
              {active && heading !== null && <p className="mt-2 text-sm text-muted">Heading perangkat: {Math.round(heading)}°</p>}
            </Card>

            <Card tone="glass">
              <CardHeader title="Panduan kalibrasi" icon={<Info className="size-5" />} />
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
                <li>Jauhkan perangkat dari benda logam, magnet, dan perangkat elektronik.</li>
                <li>Gerakkan perangkat membentuk angka 8 di udara beberapa kali.</li>
                <li>Pegang perangkat mendatar sejajar lantai saat membaca arah.</li>
                <li>Bandingkan dengan arah kiblat masjid terdekat bila memungkinkan.</li>
              </ol>
            </Card>
          </div>
        </div>
      )}
      <LocationDialog open={locationOpen} onClose={() => setLocationOpen(false)} />
    </div>
  );
}
