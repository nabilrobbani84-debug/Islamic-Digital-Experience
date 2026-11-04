import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, Minimize2, RotateCcw, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/services/offline/db";
import { saveDhikrSession } from "@/services/offline/personal";
import { useDhikr, type ActiveDhikr } from "@/stores/dhikr";
import { toast } from "@/stores/ui";
import { formatDateTime } from "@/lib/format";
import { useDhikrContent } from "@/features/knowledge/api";
import { DhikrCounter } from "./DhikrCounter";

const TARGETS = ["33", "99", "100", "custom"] as const;

async function persist(a: ActiveDhikr): Promise<void> {
  if (a.count === 0) return;
  await saveDhikrSession({ id: a.sessionId, dhikrItemId: a.dhikrItemId, label: a.label, count: a.count, targetCount: a.target, startedAt: a.startedAt, completedAt: a.completedAt });
}

export default function DhikrPage() {
  const active = useDhikr((s) => s.active);
  const { increment, reset, start, setTarget } = useDhikr.getState();
  const content = useDhikrContent();
  const [confirmReset, setConfirmReset] = useState(false);
  const [focus, setFocus] = useState(false);
  const [customTarget, setCustomTarget] = useState(String(active.target));
  const history = useLiveQuery(() => db.dhikr_sessions.orderBy("startedAt").reverse().limit(10).toArray(), []);
  const item = content.data?.data.items.find((i) => i.id === active.dhikrItemId) ?? null;
  const latest = useRef(active);
  latest.current = active;

  // Simpan progres saat meninggalkan halaman.
  useEffect(() => () => void persist(latest.current), []);

  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setFocus(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus]);

  const onIncrement = (): void => {
    const next = increment();
    if (next.count === next.target) {
      toast.success("Target tercapai", `${next.label} · ${next.target}×`);
      void persist(next);
    }
  };

  const targetChoice = TARGETS.includes(String(active.target) as (typeof TARGETS)[number]) ? String(active.target) : "custom";

  const counter = <DhikrCounter count={active.count} target={active.target} label={active.label} onIncrement={onIncrement} size={focus ? 320 : 280} />;

  return (
    <div>
      <PageHeader eyebrow="Dhikr" title="Penghitung Dzikir" description="Fokus pada dzikir. Hitungan tersimpan otomatis di perangkat." arabic="ذكر" />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card tone="accent" className="flex flex-col items-center text-center">
          <div className="mb-4 w-full text-left">
            <p className="text-sm font-semibold text-fg">{active.label}</p>
            {item && (
              <div className="mt-3">
                <p lang="ar" className="text-right text-3xl text-fg">
                  {item.arabicText}
                </p>
                <p className="mt-2 text-sm text-gold-text italic">{item.transliteration}</p>
                <p className="mt-1 text-sm text-muted">{item.translation}</p>
                {item.source && <p className="mt-1 text-xs text-muted">Sumber: {item.source}</p>}
              </div>
            )}
          </div>
          {!focus && counter}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="outline" leftIcon={<RotateCcw className="size-4" />} onClick={() => setConfirmReset(true)} disabled={active.count === 0}>
              Reset
            </Button>
            <Button
              variant="subtle"
              leftIcon={<Save className="size-4" />}
              onClick={() => {
                void persist(active).then(() => toast.success("Sesi disimpan"));
              }}
              disabled={active.count === 0}
            >
              Simpan sesi
            </Button>
            <Button variant="ghost" leftIcon={<Maximize2 className="size-4" />} onClick={() => setFocus(true)}>
              Mode fokus
            </Button>
          </div>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Pilih dzikir" icon={<Sparkles className="size-5" />} />
            <div className="space-y-4">
              <Select
                label="Bacaan"
                value={active.dhikrItemId ?? ""}
                onChange={(e) => {
                  void persist(active);
                  const chosen = content.data?.data.items.find((i) => i.id === e.target.value);
                  start({ dhikrItemId: chosen?.id ?? null, label: chosen ? chosen.transliteration : "Hitungan bebas", target: chosen?.recommendedCount ?? active.target });
                  setCustomTarget(String(chosen?.recommendedCount ?? active.target));
                }}
                hint={content.isError ? "Daftar dzikir tidak dapat dimuat; gunakan hitungan bebas." : content.data?.data.items.length === 0 ? "Dataset dzikir belum tersedia." : undefined}
              >
                <option value="">Hitungan bebas</option>
                {content.data?.data.categories.map((c) => (
                  <optgroup key={c.id} label={c.name}>
                    {content.data?.data.items
                      .filter((i) => i.categoryId === c.id)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.transliteration} ({i.recommendedCount}×)
                        </option>
                      ))}
                  </optgroup>
                ))}
              </Select>
              <div>
                <p className="mb-2 text-sm font-medium">Target</p>
                <Segmented
                  label="Target hitungan"
                  value={targetChoice}
                  onChange={(v) => {
                    if (v !== "custom") {
                      setTarget(Number(v));
                      setCustomTarget(v);
                    }
                  }}
                  options={TARGETS.map((t) => ({ value: t, label: t === "custom" ? "Lainnya" : `${t}×` }))}
                />
              </div>
              <Input
                label="Target kustom"
                inputMode="numeric"
                value={customTarget}
                onChange={(e) => setCustomTarget(e.target.value.replace(/\D/g, ""))}
                onBlur={() => {
                  const n = Number(customTarget);
                  if (Number.isInteger(n) && n >= 1 && n <= 10_000) setTarget(n);
                  else setCustomTarget(String(active.target));
                }}
                hint="1–10.000"
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Riwayat sesi" />
            {!history || history.length === 0 ? (
              <p className="text-sm text-muted">Belum ada sesi tersimpan.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{h.label}</span>
                      <span className="block text-xs text-muted">{formatDateTime(h.startedAt)}</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {h.count}/{h.targetCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <AnimatePresence>
        {focus && (
          <motion.div role="dialog" aria-modal="true" aria-label="Mode fokus dzikir" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="nur-pattern fixed inset-0 z-[75] flex flex-col items-center justify-center gap-8 bg-night px-6">
            <p className="text-lg font-semibold text-ivory/90">{active.label}</p>
            {counter}
            <Button variant="outline" leftIcon={<Minimize2 className="size-4" />} onClick={() => setFocus(false)}>
              Keluar mode fokus
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset hitungan?"
        description="Hitungan saat ini akan disimpan ke riwayat, lalu dimulai dari nol."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                void persist(active);
                reset();
                setConfirmReset(false);
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Hitungan: {active.count} dari {active.target}.</p>
      </Dialog>
    </div>
  );
}
