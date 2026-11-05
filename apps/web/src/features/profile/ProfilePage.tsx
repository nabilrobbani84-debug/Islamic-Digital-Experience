import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { z } from "zod";
import { Bookmark, BookOpen, Calculator, CloudOff, LogOut, MonitorSmartphone, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/feedback/States";
import { api, userMessage } from "@/services/api";
import { db } from "@/services/offline/db";
import { toggleBookmark, updateBookmarkNote } from "@/services/offline/personal";
import { discardChange, flushSync, retryConflict } from "@/services/offline/sync-engine";
import { useAuth } from "@/stores/auth";
import { toast } from "@/stores/ui";
import { formatDateTime, formatIdr, formatRelative } from "@/lib/format";
import { passwordRule } from "@/features/auth/schemas";
import { PasswordInput } from "@/features/auth/components";
import { rememberSession, useLogout } from "@/features/auth/useSession";
import { useSurahs } from "@/features/quran/api";

type Tab = "account" | "bookmarks" | "history" | "devices" | "sync";

const profileSchema = z.object({ name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120) });
const passwordSchema = z
  .object({ currentPassword: z.string().min(1, "Wajib diisi"), newPassword: passwordRule, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Konfirmasi tidak sama" });

function AccountTab() {
  const user = useAuth((s) => s.user);
  const offline = useAuth((s) => s.status === "offline-session");
  const profile = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name ?? "" } });
  const pwd = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  const saveProfile = profile.handleSubmit(async ({ name }) => {
    try {
      const updated = await api.users.updateMe({ name });
      useAuth.getState().setAuthenticated(updated);
      await rememberSession(updated);
      toast.success("Profil diperbarui");
    } catch (err) {
      toast.error("Gagal menyimpan", userMessage(err));
    }
  });
  const savePassword = pwd.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api.users.changePassword({ currentPassword, newPassword });
      pwd.reset();
      toast.success("Kata sandi diperbarui");
    } catch (err) {
      pwd.setError("currentPassword", { message: userMessage(err) });
    }
  });

  if (!user) return null;
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <div className="mb-6 flex items-center gap-4">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="size-16 rounded-full object-cover ring-2 ring-gold/40" />
          ) : (
            <span className="grid size-16 place-items-center rounded-full bg-gradient-to-br from-emerald-nur to-emerald-deep text-xl font-bold text-ivory ring-2 ring-gold/40" aria-hidden>
              {initials}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <div className="mt-1 flex gap-2">
              <Badge tone={user.emailVerified ? "emerald" : "warning"}>{user.emailVerified ? "Email terverifikasi" : "Email belum diverifikasi"}</Badge>
              {user.role !== "USER" && <Badge tone="gold">{user.role}</Badge>}
            </div>
          </div>
        </div>
        <form onSubmit={(e) => void saveProfile(e)} noValidate className="space-y-4">
          <Input label="Nama" error={profile.formState.errors.name?.message} {...profile.register("name")} />
          <Input label="Email" value={user.email} readOnly disabled hint="Perubahan email memerlukan verifikasi ulang melalui dukungan." />
          <Button type="submit" loading={profile.formState.isSubmitting} disabled={offline}>
            Simpan profil
          </Button>
          {offline && <p className="text-xs text-amber-500">Perubahan profil memerlukan koneksi internet.</p>}
        </form>
      </Card>
      <Card>
        <CardHeader title="Ubah kata sandi" />
        <form onSubmit={(e) => void savePassword(e)} noValidate className="space-y-4">
          <PasswordInput label="Kata sandi saat ini" autoComplete="current-password" error={pwd.formState.errors.currentPassword?.message} {...pwd.register("currentPassword")} />
          <PasswordInput label="Kata sandi baru" autoComplete="new-password" error={pwd.formState.errors.newPassword?.message} {...pwd.register("newPassword")} />
          <PasswordInput label="Konfirmasi kata sandi baru" autoComplete="new-password" error={pwd.formState.errors.confirmPassword?.message} {...pwd.register("confirmPassword")} />
          <Button type="submit" variant="outline" loading={pwd.formState.isSubmitting} disabled={offline}>
            Perbarui kata sandi
          </Button>
        </form>
      </Card>
    </div>
  );
}

function BookmarksTab() {
  const bookmarks = useLiveQuery(() => db.bookmarks.orderBy("updatedAt").reverse().filter((b) => !b.deletedAt).toArray(), []);
  const surahs = useSurahs();
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  if (!bookmarks) return <ListSkeleton rows={3} />;
  if (bookmarks.length === 0) return <EmptyState icon={<Bookmark className="size-6" />} title="Belum ada bookmark" description="Tandai ayat dari halaman pembaca Al-Qur'an." action={<Link to="/quran" className="inline-flex h-10 items-center rounded-xl bg-emerald-nur px-4 text-sm font-semibold text-ivory">Buka Al-Qur'an</Link>} />;
  return (
    <ul className="space-y-2">
      {bookmarks.map((b) => {
        const name = surahs.data?.data.find((s) => s.number === b.surahNumber)?.nameLatin ?? `Surah ${b.surahNumber}`;
        return (
          <li key={b.id} className="nur-surface rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <Link to={`/quran/${b.surahNumber}?ayat=${b.verseNumber}`} className="min-w-0 flex-1">
                <span className="block font-semibold">
                  QS. {name} : {b.verseNumber}
                </span>
                <span className="block truncate text-xs text-muted">{b.note ?? `Disimpan ${formatRelative(b.updatedAt)}`}</span>
              </Link>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(b.id); setNote(b.note ?? ""); }}>
                Catatan
              </Button>
              <IconButton size="sm" label="Hapus bookmark" icon={<Trash2 className="size-4" />} onClick={() => void toggleBookmark(b.surahNumber, b.verseNumber)} />
            </div>
            {editing === b.id && (
              <form
                className="mt-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void updateBookmarkNote(b.id, note).then(() => {
                    setEditing(null);
                    toast.success("Catatan disimpan");
                  });
                }}
              >
                <Textarea label="Catatan" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" type="submit">Simpan</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
                </div>
              </form>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function HistoryTab() {
  const reading = useLiveQuery(() => db.reading_history.orderBy("readAt").reverse().limit(30).toArray(), []);
  const dhikr = useLiveQuery(() => db.dhikr_sessions.orderBy("startedAt").reverse().limit(10).toArray(), []);
  const zakat = useLiveQuery(() => db.zakat_history.orderBy("calculatedAt").reverse().limit(10).toArray(), []);
  const surahs = useSurahs();
  const name = (n: number): string => surahs.data?.data.find((s) => s.number === n)?.nameLatin ?? `Surah ${n}`;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card>
        <CardHeader title="Riwayat membaca" icon={<BookOpen className="size-5" />} />
        {reading?.length ? (
          <ul className="space-y-1.5 text-sm">
            {reading.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <Link to={`/quran/${r.surahNumber}?ayat=${r.verseNumber}`} className="truncate hover:text-gold-text">
                  {name(r.surahNumber)} : {r.verseNumber}
                </Link>
                <span className="shrink-0 text-xs text-muted">{formatRelative(r.readAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Belum ada riwayat.</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Riwayat dzikir" icon={<Sparkles className="size-5" />} />
        {dhikr?.length ? (
          <ul className="space-y-1.5 text-sm">
            {dhikr.map((d) => (
              <li key={d.id} className="flex justify-between gap-2">
                <span className="truncate">{d.label}</span>
                <span className="shrink-0 tabular-nums">{d.count}/{d.targetCount}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Belum ada sesi.</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Riwayat zakat" icon={<Calculator className="size-5" />} />
        {zakat?.length ? (
          <ul className="space-y-1.5 text-sm">
            {zakat.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span className="truncate">{formatDateTime(item.calculatedAt)}</span>
                <span className="shrink-0 tabular-nums">{formatIdr(item.payableAmount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Belum ada kalkulasi tersimpan.</p>
        )}
      </Card>
    </div>
  );
}

function DevicesTab() {
  const client = useQueryClient();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => api.users.sessions() });
  const logout = useLogout();
  const revoke = useMutation({
    mutationFn: (id: string) => api.users.revokeSession(id),
    onSuccess: () => {
      toast.success("Sesi dicabut");
      void client.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (err) => toast.error("Gagal mencabut sesi", userMessage(err)),
  });
  if (sessions.isPending) return <ListSkeleton rows={2} />;
  if (sessions.isError) return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;
  return (
    <Card>
      <CardHeader title="Perangkat & sesi aktif" icon={<MonitorSmartphone className="size-5" />} action={<Button size="sm" variant="outline" leftIcon={<LogOut className="size-4" />} onClick={() => void logout()}>Keluar dari perangkat ini</Button>} />
      <ul className="space-y-2">
        {sessions.data.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {s.deviceName ?? "Perangkat tidak dikenal"} {s.current && <Badge tone="emerald">Perangkat ini</Badge>}
              </p>
              <p className="truncate text-xs text-muted">{s.userAgent ?? ""}</p>
              <p className="text-xs text-muted">Aktif {formatRelative(s.lastUsedAt)}</p>
            </div>
            {!s.current && (
              <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                Cabut
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SyncTab() {
  const pending = useLiveQuery(() => db.pending_sync.toArray(), []);
  const conflicts = (pending ?? []).filter((p) => p.status === "CONFLICT");
  const failed = (pending ?? []).filter((p) => p.status === "FAILED");
  return (
    <Card>
      <CardHeader title="Sinkronisasi" icon={<CloudOff className="size-5" />} action={<Button size="sm" variant="outline" leftIcon={<RefreshCw className="size-4" />} onClick={() => void flushSync().then(() => toast.info("Sinkronisasi selesai"))}>Sinkronkan sekarang</Button>} />
      <dl className="mb-5 grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Menunggu", value: (pending ?? []).filter((p) => p.status === "PENDING").length },
          { label: "Gagal", value: failed.length },
          { label: "Konflik", value: conflicts.length },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface-2 py-3">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="text-xl font-bold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      {conflicts.length > 0 && (
        <ul className="space-y-2">
          {conflicts.map((c) => (
            <li key={c.seq} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              <p className="font-semibold">
                {c.entityType} · {formatDateTime(c.clientCreatedAt)}
              </p>
              <p className="text-xs text-muted">Data ini diubah di perangkat lain. Pilih versi yang dipertahankan.</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => c.seq !== undefined && void retryConflict(c.seq, c.serverVersion ?? c.baseVersion ?? 0)}>
                  Pakai versi perangkat ini
                </Button>
                <Button size="sm" variant="ghost" onClick={() => c.seq !== undefined && void discardChange(c.seq)}>
                  Pakai versi server
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {conflicts.length === 0 && failed.length === 0 && <p className="text-sm text-muted">Semua perubahan sudah tersinkron atau sedang menunggu koneksi.</p>}
    </Card>
  );
}

const TABS: { value: Tab; label: string }[] = [
  { value: "account", label: "Akun" },
  { value: "bookmarks", label: "Bookmark" },
  { value: "history", label: "Riwayat" },
  { value: "devices", label: "Perangkat" },
  { value: "sync", label: "Sinkronisasi" },
];

export default function ProfilePage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get("tab"))?.value ?? "account") as Tab;
  return (
    <div>
      <PageHeader eyebrow="Profil" title="Profil & Riwayat" description="Kelola akun, bookmark, riwayat ibadah, dan perangkat." />
      <Segmented label="Bagian profil" value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} options={TABS} className="mb-6" />
      {tab === "account" && <AccountTab />}
      {tab === "bookmarks" && <BookmarksTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "devices" && <DevicesTab />}
      {tab === "sync" && <SyncTab />}
    </div>
  );
}
