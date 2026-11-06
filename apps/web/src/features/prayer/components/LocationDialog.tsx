import { useMemo, useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import { isValidTimeZone } from "@nur/islamic-calculations";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { useGeolocation } from "@/hooks/useGeolocation";
import { usePrayerSettings, type SavedLocation } from "@/stores/prayer-settings";
import { toast } from "@/stores/ui";
import { COMMON_TIMEZONES, PRESET_LOCATIONS } from "../locations";

type Mode = "preset" | "gps" | "manual";

const deviceTz = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Pemilihan lokasi: kota dari database lokal, GPS perangkat (dengan izin), atau koordinat manual. */
export function LocationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setLocation = usePrayerSettings((s) => s.setLocation);
  const current = usePrayerSettings((s) => s.location);
  const [mode, setMode] = useState<Mode>("preset");
  const [preset, setPreset] = useState(current?.source === "preset" ? current.name : "Jakarta");
  const geo = useGeolocation();
  const [tz, setTz] = useState(current?.timezone ?? deviceTz());
  const [manual, setManual] = useState({ name: current?.source === "manual" ? current.name : "", lat: current ? String(current.latitude) : "", lng: current ? String(current.longitude) : "", elevation: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const tzOptions = useMemo(() => Array.from(new Set([deviceTz(), ...COMMON_TIMEZONES])), []);

  const save = (location: SavedLocation): void => {
    setLocation(location);
    toast.success("Lokasi disimpan", location.name);
    onClose();
  };

  const submit = (): void => {
    if (mode === "preset") {
      const p = PRESET_LOCATIONS.find((l) => l.name === preset);
      if (p) save({ ...p, source: "preset" });
      return;
    }
    if (!isValidTimeZone(tz)) {
      setErrors({ tz: "Zona waktu tidak dikenal" });
      return;
    }
    if (mode === "gps") {
      if (!geo.position) return;
      save({ name: "Lokasi perangkat", latitude: geo.position.latitude, longitude: geo.position.longitude, elevation: geo.position.altitude, timezone: tz, source: "geolocation" });
      return;
    }
    const lat = Number(manual.lat.replace(",", "."));
    const lng = Number(manual.lng.replace(",", "."));
    const next: Record<string, string> = {};
    if (!manual.name.trim()) next.name = "Nama lokasi wajib diisi";
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || manual.lat.trim() === "") next.lat = "Latitude harus -90 sampai 90";
    if (!Number.isFinite(lng) || lng < -180 || lng > 180 || manual.lng.trim() === "") next.lng = "Longitude harus -180 sampai 180";
    const elevation = manual.elevation.trim() ? Number(manual.elevation) : null;
    if (elevation !== null && (!Number.isFinite(elevation) || elevation < -500 || elevation > 9000)) next.elevation = "Ketinggian -500 sampai 9000 m";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    save({ name: manual.name.trim(), latitude: lat, longitude: lng, elevation, timezone: tz, source: "manual" });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Atur lokasi"
      description="Koordinat hanya dipakai untuk perhitungan lokal di perangkat."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={submit} disabled={mode === "gps" && !geo.position}>
            Simpan lokasi
          </Button>
        </>
      }
    >
      <Segmented
        label="Sumber lokasi"
        value={mode}
        onChange={setMode}
        className="mb-5 w-full"
        options={[
          { value: "preset", label: "Pilih kota" },
          { value: "gps", label: "GPS" },
          { value: "manual", label: "Manual" },
        ]}
      />
      {mode === "preset" && (
        <Select label="Kota" value={preset} onChange={(e) => setPreset(e.target.value)} hint="Database koordinat lokal, tanpa layanan peta pihak ketiga.">
          {PRESET_LOCATIONS.map((l) => (
            <option key={l.name} value={l.name}>
              {l.name} ({l.timezone})
            </option>
          ))}
        </Select>
      )}
      {mode === "gps" && (
        <div className="space-y-4">
          <Button variant="outline" leftIcon={<LocateFixed className="size-4" />} loading={geo.status === "requesting"} onClick={() => void geo.request()}>
            Gunakan lokasi perangkat
          </Button>
          {geo.status === "denied" && <p className="text-sm text-red-400" role="alert">Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser atau pilih kota secara manual.</p>}
          {(geo.status === "unavailable" || geo.status === "error") && <p className="text-sm text-red-400" role="alert">Lokasi tidak dapat ditentukan. Coba lagi atau gunakan pilihan kota.</p>}
          {geo.position && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <MapPin className="size-4 text-gold-text" aria-hidden />
              {geo.position.latitude.toFixed(4)}, {geo.position.longitude.toFixed(4)} (akurasi ±{Math.round(geo.position.accuracy)} m)
            </p>
          )}
          <Select label="Zona waktu lokasi" value={tz} onChange={(e) => setTz(e.target.value)} error={errors.tz} hint="Konfirmasi zona waktu lokasi. Zona perangkat tidak selalu sama dengan zona lokasi.">
            {tzOptions.map((z) => (
              <option key={z} value={z}>
                {z}
                {z === deviceTz() ? " (perangkat)" : ""}
              </option>
            ))}
          </Select>
        </div>
      )}
      {mode === "manual" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Nama lokasi" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} error={errors.name} />
          </div>
          <Input label="Latitude" inputMode="decimal" placeholder="-6.2088" value={manual.lat} onChange={(e) => setManual({ ...manual, lat: e.target.value })} error={errors.lat} />
          <Input label="Longitude" inputMode="decimal" placeholder="106.8456" value={manual.lng} onChange={(e) => setManual({ ...manual, lng: e.target.value })} error={errors.lng} />
          <Input label="Ketinggian (m, opsional)" inputMode="numeric" value={manual.elevation} onChange={(e) => setManual({ ...manual, elevation: e.target.value })} error={errors.elevation} />
          <Select label="Zona waktu" value={tz} onChange={(e) => setTz(e.target.value)} error={errors.tz}>
            {tzOptions.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </Select>
        </div>
      )}
    </Dialog>
  );
}
