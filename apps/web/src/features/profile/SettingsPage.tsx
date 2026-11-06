import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Bell, Box, Download, MapPin, Palette, Type } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { PageHeader } from "@/components/ui/misc";
import { ARABIC_FONT_RANGE, TRANSLATION_FONT_RANGE, usePreferences } from "@/stores/preferences";
import { detectWebGL } from "@/lib/device";
import { toast } from "@/stores/ui";
import { usePrayerSettings } from "@/stores/prayer-settings";
import { LocationDialog } from "@/features/prayer/components/LocationDialog";
import { notificationsSupported } from "@/features/prayer/PrayerReminders";

export default function SettingsPage() {
  const prefs = usePreferences();
  const webgl = detectWebGL();
  const location = usePrayerSettings((st) => st.location);
  const [locationOpen, setLocationOpen] = useState(false);

  const toggleNotifications = async (on: boolean): Promise<void> => {
    if (!on) {
      prefs.set({ notificationsEnabled: false });
      return;
    }
    if (!notificationsSupported()) {
      toast.error("Notifikasi tidak didukung browser ini");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Izin notifikasi ditolak");
      return;
    }
    prefs.set({ notificationsEnabled: true });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Pengaturan" title="Pengaturan" description="Preferensi tersimpan di perangkat ini." />
      <div className="space-y-5">
        <Card>
          <CardHeader title="Lokasi & perhitungan ibadah" icon={<MapPin className="size-5" />} description="Dipakai untuk waktu sholat, kiblat, dan kalender. Dihitung lokal di perangkat." />
          <p className="text-sm">{location ? `${location.name} · ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} · ${location.timezone}` : "Lokasi belum diatur"}</p>
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setLocationOpen(true)}>
              {location ? "Ubah lokasi" : "Atur lokasi"}
            </Button>
          </div>
          <LocationDialog open={locationOpen} onClose={() => setLocationOpen(false)} />
        </Card>
        <Card>
          <CardHeader title="Tampilan" icon={<Palette className="size-5" />} />
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-sm font-medium">Tema</span>
            <Segmented label="Tema" size="sm" value={prefs.theme} onChange={prefs.setTheme} options={[{ value: "dark", label: "Gelap" }, { value: "light", label: "Terang" }]} />
          </div>
          <Switch label="Kurangi animasi" description="Mematikan animasi dekoratif, parallax, dan gerakan kamera 3D." checked={prefs.reducedMotion} onChange={(v) => prefs.set({ reducedMotion: v })} />
        </Card>
        <Card>
          <CardHeader title="Pengalaman 3D" icon={<Box className="size-5" />} description={webgl.webgl ? (webgl.webgl2 ? "WebGL2 tersedia" : "Hanya WebGL1 — kualitas disederhanakan") : "WebGL tidak tersedia — memakai tampilan 2D"} />
          <Switch label="Aktifkan scene 3D" description="Matikan untuk menghemat baterai dan data. Semua fitur tetap tersedia dalam tampilan 2D." checked={prefs.experience3D === "auto"} disabled={!webgl.webgl} onChange={(v) => prefs.set({ experience3D: v ? "auto" : "off" })} />
        </Card>
        <Card>
          <CardHeader title="Bacaan Al-Qur'an" icon={<Type className="size-5" />} />
          <label className="block py-2">
            <span className="flex justify-between text-sm font-medium">
              Ukuran teks Arab <output className="tabular-nums">{prefs.arabicFontSize}px</output>
            </span>
            <input type="range" className="mt-2 w-full accent-gold" {...ARABIC_FONT_RANGE} value={prefs.arabicFontSize} onChange={(e) => prefs.set({ arabicFontSize: Number(e.target.value) })} />
          </label>
          <label className="block py-2">
            <span className="flex justify-between text-sm font-medium">
              Ukuran terjemahan <output className="tabular-nums">{prefs.translationFontSize}px</output>
            </span>
            <input type="range" className="mt-2 w-full accent-gold" {...TRANSLATION_FONT_RANGE} value={prefs.translationFontSize} onChange={(e) => prefs.set({ translationFontSize: Number(e.target.value) })} />
          </label>
          <p lang="ar" className="quran-arabic mt-2">ٱلْقُرْآنُ ٱلْكَرِيمُ</p>
          <Switch label="Tampilkan terjemahan" checked={prefs.translationEnabled} onChange={(v) => prefs.set({ translationEnabled: v })} />
        </Card>
        <Card>
          <CardHeader title="Notifikasi" icon={<Bell className="size-5" />} />
          <Switch label="Pengingat waktu sholat" description="Aktif selama NUR terbuka. Pilih waktu sholat di halaman Prayer." checked={prefs.notificationsEnabled} onChange={(v) => void toggleNotifications(v)} />
        </Card>
        <Link to="/settings/offline-data" className="nur-surface flex items-center justify-between gap-4 rounded-3xl p-5 hover:border-gold/40">
          <span className="flex items-center gap-3">
            <Download className="size-5 text-gold-text" aria-hidden />
            <span>
              <span className="block font-semibold">Data offline</span>
              <span className="block text-sm text-muted">Unduh Al-Qur'an, konten, dan audio; kelola penyimpanan.</span>
            </span>
          </span>
          <ArrowRight className="size-5 text-muted" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
