import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, CircleCheck, Database, Download, HardDrive, Headphones, Library, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Badge, PageHeader, ProgressBar } from "@/components/ui/misc";
import { OfflineNotice } from "@/components/feedback/States";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { api, userMessage } from "@/services/api";
import { audioCacheSupported, clearAudioCache, downloadTrack, removeCachedTrack } from "@/services/audio/audio-cache";
import { db, type OfflinePackageStatus } from "@/services/offline/db";
import { toast } from "@/stores/ui";
import { formatBytes, formatDateTime } from "@/lib/format";
import { fetchSurahDetail, useQaris, useSurahs } from "@/features/quran/api";
import type { ContentMeta } from "@/types/domain";

interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

function useStorageEstimate(refreshKey: number): StorageInfo | null {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    void Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? Promise.resolve(false)]).then(([e, persisted]) => setInfo({ usage: e.usage ?? 0, quota: e.quota ?? 0, persisted }));
  }, [refreshKey]);
  return info;
}

const STATUS_BADGE: Record<OfflinePackageStatus, { label: string; tone: "neutral" | "gold" | "emerald" | "danger" }> = {
  NOT_DOWNLOADED: { label: "Belum diunduh", tone: "neutral" },
  DOWNLOADING: { label: "Mengunduh", tone: "gold" },
  INSTALLED: { label: "Terpasang", tone: "emerald" },
  FAILED: { label: "Gagal", tone: "danger" },
};

export default function OfflineDataPage() {
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const surahs = useSurahs();
  const qaris = useQaris();
  const packages = useLiveQuery(() => db.offline_packages.toArray(), []);
  const cachedSurahs = useLiveQuery(() => db.quran_verses.count(), []);
  const audioRows = useLiveQuery(() => db.audio_metadata.toArray(), []);
  const contentRows = useLiveQuery(() => db.content_cache.toArray(), []);
  const [refresh, setRefresh] = useState(0);
  const storage = useStorageEstimate(refresh);
  const [progress, setProgress] = useState<{ id: string; ratio: number } | null>(null);
  const [qariId, setQariId] = useState("");
  const [audioSurah, setAudioSurah] = useState("1");
  const [integrity, setIntegrity] = useState<{ ok: boolean; message: string } | null>(null);
  const pkg = (id: string) => packages?.find((p) => p.id === id);

  const downloadQuran = async (): Promise<void> => {
    const list = surahs.data?.data ?? [];
    if (list.length === 0) {
      toast.error("Daftar surah belum tersedia");
      return;
    }
    const meta: ContentMeta = surahs.data?.meta ?? {};
    await db.offline_packages.put({ id: "quran", name: "Al-Qur'an & terjemahan", version: meta.datasetVersion ?? "unknown", sizeBytes: 0, checksum: "", required: true, status: "DOWNLOADING" });
    try {
      for (let i = 0; i < list.length; i++) {
        const s = list[i]!;
        await fetchSurahDetail(s.number, null);
        setProgress({ id: "quran", ratio: (i + 1) / list.length });
      }
      await db.offline_packages.update("quran", { status: "INSTALLED", downloadedAt: new Date().toISOString() });
      toast.success("Al-Qur'an siap dibaca offline");
    } catch (err) {
      await db.offline_packages.update("quran", { status: "FAILED" });
      toast.error("Unduhan terhenti", userMessage(err));
    } finally {
      setProgress(null);
      setRefresh((r) => r + 1);
    }
  };

  const downloadContent = async (): Promise<void> => {
    await db.offline_packages.put({ id: "content", name: "Dzikir, doa, hadis, Asmaul Husna", version: "latest", sizeBytes: 0, checksum: "", required: false, status: "DOWNLOADING" });
    try {
      const jobs = [
        { key: "dhikr", fetch: () => api.content.dhikr() },
        { key: "duas", fetch: () => api.content.duas() },
        { key: "hadith-nawawi", fetch: () => api.content.hadithNawawi() },
        { key: "asmaul-husna", fetch: () => api.content.asmaulHusna() },
      ] as const;
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i]!;
        const result = await job.fetch();
        await db.content_cache.put({ key: job.key, data: result.data, meta: result.meta, cachedAt: new Date().toISOString() });
        void queryClient.invalidateQueries({ queryKey: ["content", job.key] });
        setProgress({ id: "content", ratio: (i + 1) / jobs.length });
      }
      await db.offline_packages.update("content", { status: "INSTALLED", downloadedAt: new Date().toISOString() });
      toast.success("Konten ibadah tersedia offline");
    } catch (err) {
      await db.offline_packages.update("content", { status: "FAILED" });
      toast.error("Unduhan konten gagal", userMessage(err));
    } finally {
      setProgress(null);
      setRefresh((r) => r + 1);
    }
  };

  const downloadAudio = async (): Promise<void> => {
    const id = qariId || qaris.data?.[0]?.id;
    if (!id) return;
    const surahNumber = Number(audioSurah);
    try {
      const track = await api.audio.surah(surahNumber, id);
      await downloadTrack(track, (ratio) => setProgress({ id: "audio", ratio }));
      toast.success("Audio tersimpan", track.checksum ? "Checksum terverifikasi" : "Backend tidak menyediakan checksum");
    } catch (err) {
      toast.error("Gagal mengunduh audio", err instanceof Error && !("status" in err) ? err.message : userMessage(err));
    } finally {
      setProgress(null);
      setRefresh((r) => r + 1);
    }
  };

  const checkIntegrity = async (): Promise<void> => {
    const list = surahs.data?.data ?? [];
    const rows = await db.quran_verses.toArray();
    const problems: string[] = [];
    for (const row of rows) {
      const expected = list.find((s) => s.number === row.surahNumber)?.totalVerses ?? row.detail.totalVerses;
      const numbers = row.detail.verses.map((v) => v.number);
      if (row.detail.verses.length !== expected) problems.push(`Surah ${row.surahNumber}: ${row.detail.verses.length}/${expected} ayat`);
      if (new Set(numbers).size !== numbers.length) problems.push(`Surah ${row.surahNumber}: nomor ayat duplikat`);
    }
    setIntegrity(problems.length === 0 ? { ok: true, message: `${rows.length} surah tersimpan lengkap (jumlah & urutan ayat sesuai metadata).` } : { ok: false, message: problems.slice(0, 5).join("; ") });
  };

  const clearQuran = async (): Promise<void> => {
    await db.transaction("rw", db.quran_verses, db.offline_packages, async () => {
      await db.quran_verses.clear();
      await db.offline_packages.delete("quran");
    });
    setIntegrity(null);
    setRefresh((r) => r + 1);
    toast.success("Cache Al-Qur'an dihapus");
  };

  const clearContent = async (): Promise<void> => {
    await db.transaction("rw", db.content_cache, db.offline_packages, async () => {
      await db.content_cache.clear();
      await db.offline_packages.delete("content");
    });
    setRefresh((r) => r + 1);
    toast.success("Cache konten dihapus");
  };

  const quranPkg = pkg("quran");
  const contentPkg = pkg("content");
  const totalSurahs = surahs.data?.data.length ?? 114;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Pengaturan" title="Data Offline" description="Unduh data sekali, gunakan tanpa koneksi. Data referensi disimpan terpisah dari data pribadi." />
      {!online && <div className="mb-5"><OfflineNotice>Anda sedang offline. Unduhan baru memerlukan koneksi internet.</OfflineNotice></div>}
      <div className="space-y-5">
        <Card>
          <CardHeader title="Penyimpanan perangkat" icon={<HardDrive className="size-5" />} action={storage?.persisted ? <Badge tone="emerald">Persisten</Badge> : undefined} />
          {storage ? (
            <>
              <ProgressBar value={storage.quota ? storage.usage / storage.quota : 0} label="Penggunaan penyimpanan" />
              <p className="mt-2 text-sm text-muted">
                {formatBytes(storage.usage)} dari {formatBytes(storage.quota)} digunakan
              </p>
              {!storage.persisted && navigator.storage?.persist && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => void navigator.storage.persist().then((ok) => { toast.info(ok ? "Penyimpanan dijadikan persisten" : "Browser menolak permintaan penyimpanan persisten"); setRefresh((r) => r + 1); })}>
                  Minta penyimpanan persisten
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">Browser tidak menyediakan estimasi penyimpanan.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Al-Qur'an & terjemahan" icon={<BookOpen className="size-5" />} description={`${cachedSurahs ?? 0} dari ${totalSurahs} surah tersimpan`} action={<Badge tone={STATUS_BADGE[quranPkg?.status ?? "NOT_DOWNLOADED"].tone}>{STATUS_BADGE[quranPkg?.status ?? "NOT_DOWNLOADED"].label}</Badge>} />
          {progress?.id === "quran" && <ProgressBar value={progress.ratio} label="Progres unduhan Al-Qur'an" className="mb-3" />}
          <dl className="mb-4 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-muted">Versi dataset</dt><dd className="font-medium">{quranPkg?.version ?? surahs.data?.meta.datasetVersion ?? "—"}</dd></div>
            <div><dt className="text-muted">Diunduh</dt><dd className="font-medium">{quranPkg?.downloadedAt ? formatDateTime(quranPkg.downloadedAt) : "—"}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button leftIcon={<Download className="size-4" />} onClick={() => void downloadQuran()} loading={progress?.id === "quran"} disabled={!online || !surahs.data}>
              {quranPkg?.status === "INSTALLED" ? "Perbarui" : "Unduh semua surah"}
            </Button>
            <Button variant="outline" leftIcon={<ShieldCheck className="size-4" />} onClick={() => void checkIntegrity()} disabled={!cachedSurahs}>
              Periksa integritas
            </Button>
            <Button variant="ghost" leftIcon={<Trash2 className="size-4" />} onClick={() => void clearQuran()} disabled={!cachedSurahs}>
              Hapus cache
            </Button>
          </div>
          {integrity && (
            <p className={integrity.ok ? "mt-3 flex items-center gap-2 text-sm text-accent" : "mt-3 text-sm text-red-400"} role="status">
              {integrity.ok && <CircleCheck className="size-4" aria-hidden />} {integrity.message}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Konten ibadah" icon={<Library className="size-5" />} description={`${contentRows?.length ?? 0} dari 4 paket konten tersimpan`} action={<Badge tone={STATUS_BADGE[contentPkg?.status ?? "NOT_DOWNLOADED"].tone}>{STATUS_BADGE[contentPkg?.status ?? "NOT_DOWNLOADED"].label}</Badge>} />
          {progress?.id === "content" && <ProgressBar value={progress.ratio} label="Progres unduhan konten" className="mb-3" />}
          <div className="flex flex-wrap gap-2">
            <Button leftIcon={<Download className="size-4" />} onClick={() => void downloadContent()} loading={progress?.id === "content"} disabled={!online}>
              Unduh dzikir, doa, hadis, Asmaul Husna
            </Button>
            <Button variant="ghost" leftIcon={<Trash2 className="size-4" />} onClick={() => void clearContent()} disabled={!contentRows?.length}>
              Hapus cache
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Audio murottal" icon={<Headphones className="size-5" />} description={`${audioRows?.length ?? 0} file tersimpan`} />
          {!audioCacheSupported() ? (
            <p className="text-sm text-muted">Browser tidak mendukung penyimpanan audio offline.</p>
          ) : qaris.data?.length === 0 || qaris.isError ? (
            <p className="text-sm text-muted">Backend belum menyediakan daftar qari.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Select label="Qari" value={qariId || qaris.data?.[0]?.id || ""} onChange={(e) => setQariId(e.target.value)}>
                {qaris.data?.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
              </Select>
              <Select label="Surah" value={audioSurah} onChange={(e) => setAudioSurah(e.target.value)}>
                {(surahs.data?.data ?? []).map((s) => <option key={s.number} value={s.number}>{s.number}. {s.nameLatin}</option>)}
              </Select>
              <Button leftIcon={<Download className="size-4" />} onClick={() => void downloadAudio()} loading={progress?.id === "audio"} disabled={!online}>
                Unduh
              </Button>
            </div>
          )}
          {progress?.id === "audio" && <ProgressBar value={progress.ratio} label="Progres unduhan audio" className="mt-3" />}
          {audioRows && audioRows.length > 0 && (
            <ul className="mt-4 space-y-2">
              {audioRows.map((a) => (
                <li key={a.key} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-2.5 text-sm">
                  <span>
                    Surah {a.surahNumber} · {qaris.data?.find((q) => q.id === a.qariId)?.name ?? a.qariId}
                    <span className="block text-xs text-muted">{formatBytes(a.sizeBytes)} · {a.verified ? "checksum terverifikasi" : "tanpa checksum"}</span>
                  </span>
                  <IconButton size="sm" label="Hapus audio" icon={<Trash2 className="size-4" />} onClick={() => void removeCachedTrack(a.key).then(() => setRefresh((r) => r + 1))} />
                </li>
              ))}
            </ul>
          )}
          {audioRows && audioRows.length > 0 && (
            <Button size="sm" variant="ghost" className="mt-3" leftIcon={<Trash2 className="size-4" />} onClick={() => void clearAudioCache().then(() => setRefresh((r) => r + 1))}>
              Hapus semua audio
            </Button>
          )}
        </Card>

        <Card tone="glass">
          <CardHeader title="Model 3D" icon={<Database className="size-5" />} />
          <p className="text-sm text-muted">Scene 3D NUR saat ini dibangun secara procedural (tanpa file model), sehingga tidak memerlukan unduhan tambahan. Jika aset GLB berlisensi ditambahkan ke /models, service worker akan menyimpannya otomatis setelah dibuka pertama kali.</p>
        </Card>
      </div>
    </div>
  );
}
