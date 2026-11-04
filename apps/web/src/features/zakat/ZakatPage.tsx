import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { AnimatePresence, motion } from "framer-motion";
import { Calculator, CircleCheck, Info, Save, Trash2 } from "lucide-react";
import { ZAKAT_RULES } from "@nur/islamic-calculations";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { Badge, PageHeader } from "@/components/ui/misc";
import { EmptyState } from "@/components/feedback/States";
import { db } from "@/services/offline/db";
import { deleteZakatRecord, saveZakatRecord } from "@/services/offline/personal";
import { toast } from "@/stores/ui";
import { formatDateTime, formatIdr } from "@/lib/format";
import { computeZakat, ZAKAT_DEFAULTS, ZAKAT_FIELDS, zakatFormSchema, type ZakatComputation, type ZakatFormValues, type ZakatTab } from "./zakat-form";

const TAB_LABELS: Record<ZakatTab, string> = {
  INCOME: "Penghasilan",
  GOLD: "Emas",
  SAVINGS: "Tabungan",
  TRADE: "Perdagangan",
  SILVER: "Perak",
  FITRAH: "Fitrah",
};

const REASON_TEXT = {
  ELIGIBLE: "Wajib zakat",
  BELOW_NISAB: "Belum mencapai nisab",
  HAUL_NOT_COMPLETED: "Belum mencapai haul",
} as const;

function ResultPanel({ computation, onSave, saving }: { computation: ZakatComputation; onSave: () => void; saving: boolean }) {
  const { result } = computation;
  const rows = computation.type === "FITRAH"
    ? [{ label: "Total zakat fitrah", value: formatIdr(result.payableAmount) }]
    : [
        { label: "Total harta", value: formatIdr(computation.totalAssets) },
        { label: "Dikurangi utang jatuh tempo", value: `− ${formatIdr(computation.deductibleDebt)}` },
        { label: "Harta bersih", value: formatIdr(result.netAssets) },
        { label: "Nisab", value: formatIdr(result.nisab) },
        { label: "Tarif", value: `${(Number(result.rate) * 100).toLocaleString("id-ID")}%` },
      ];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-live="polite">
      <Card tone="accent">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs tracking-wider text-muted uppercase">Zakat yang perlu dibayar</p>
            <p className="mt-1 text-4xl font-bold text-gold-text tabular-nums" data-testid="zakat-payable">
              {formatIdr(result.payableAmount)}
            </p>
          </div>
          <Badge tone={result.eligible ? "emerald" : "warning"}>
            {result.eligible && <CircleCheck className="size-3.5" aria-hidden />}
            {REASON_TEXT[result.reason]}
          </Badge>
        </div>
        <dl className="mt-6 divide-y divide-line text-sm">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4 py-2.5">
              <dt className="text-muted">{r.label}</dt>
              <dd className="font-semibold tabular-nums">{r.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Aturan {result.ruleVersion}</p>
          <Button size="sm" variant="gold" leftIcon={<Save className="size-4" />} onClick={onSave} loading={saving}>
            Simpan hasil
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

function History() {
  const records = useLiveQuery(() => db.zakat_history.orderBy("calculatedAt").reverse().limit(20).toArray(), []);
  return (
    <Card>
      <CardHeader title="Riwayat perhitungan" description="Tersimpan di perangkat & tersinkron ke akun" />
      {!records || records.length === 0 ? (
        <EmptyState icon={<Calculator className="size-6" />} title="Belum ada riwayat" description="Simpan hasil perhitungan untuk melihatnya di sini." className="border-0 bg-transparent py-6 shadow-none" />
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {TAB_LABELS[r.type as ZakatTab] ?? r.type} · {formatIdr(r.payableAmount)}
                </p>
                <p className="text-xs text-muted">{formatDateTime(r.calculatedAt)}</p>
              </div>
              <IconButton size="sm" label="Hapus riwayat" icon={<Trash2 className="size-4" />} onClick={() => void deleteZakatRecord(r.id)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function ZakatPage() {
  const [computation, setComputation] = useState<ZakatComputation | null>(null);
  const [saving, setSaving] = useState(false);
  const form = useForm<ZakatFormValues>({ resolver: zodResolver(zakatFormSchema), defaultValues: ZAKAT_DEFAULTS, mode: "onSubmit" });
  const type = form.watch("type");
  const haul = form.watch("haulCompleted");
  const fields = ZAKAT_FIELDS[type];
  const rule = type === "FITRAH" ? null : ZAKAT_RULES[type];

  const onSubmit = form.handleSubmit((values) => {
    try {
      setComputation(computeZakat(values));
    } catch (error) {
      toast.error("Perhitungan gagal", error instanceof Error ? error.message : undefined);
    }
  });

  const onSave = async (): Promise<void> => {
    if (!computation) return;
    setSaving(true);
    try {
      await saveZakatRecord({
        type: computation.type,
        totalAssets: computation.totalAssets,
        deductibleDebt: computation.deductibleDebt,
        netAssets: computation.result.netAssets,
        nisabValue: computation.result.nisab,
        payableAmount: computation.result.payableAmount,
        eligible: computation.result.eligible,
        currency: "IDR",
        ruleVersion: computation.result.ruleVersion,
        calculatedAt: new Date().toISOString(),
      });
      toast.success("Hasil disimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader eyebrow="Zakat" title="Kalkulator Zakat" description="Perhitungan memakai aritmetika desimal presisi sehingga tidak ada galat pembulatan." arabic="الزكاة" />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <Segmented
            label="Jenis zakat"
            value={type}
            onChange={(v) => {
              form.reset({ ...ZAKAT_DEFAULTS, type: v });
              setComputation(null);
            }}
            options={(Object.keys(TAB_LABELS) as ZakatTab[]).map((k) => ({ value: k, label: TAB_LABELS[k] }))}
            className="mb-5 w-full"
          />
          {rule && <p className="mb-5 text-sm text-muted">{rule.description}</p>}
          <form onSubmit={(e) => void onSubmit(e)} noValidate className="space-y-4" aria-label={`Formulir zakat ${TAB_LABELS[type]}`}>
            {fields.map((f) => (
              <Input
                key={`${type}-${f.name}`}
                label={f.label}
                hint={f.hint}
                inputMode={f.kind === "grams" ? "decimal" : "numeric"}
                placeholder={f.kind === "money" ? "0" : f.kind === "grams" ? "0" : "1"}
                leading={f.kind === "money" ? <span className="text-sm">Rp</span> : undefined}
                error={form.formState.errors[f.name]?.message}
                {...form.register(f.name)}
              />
            ))}
            {rule?.requiresHaul && (
              <Switch label="Sudah dimiliki satu tahun Hijriah (haul)" description="Zakat ini mensyaratkan haul." checked={haul} onChange={(v) => form.setValue("haulCompleted", v)} />
            )}
            <Button type="submit" size="lg" className="w-full" leftIcon={<Calculator className="size-5" />}>
              Hitung zakat
            </Button>
          </form>
          <p className="mt-5 flex items-start gap-2 text-xs text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Hasil bergantung pada parameter yang Anda masukkan (harga emas/perak, nilai per jiwa) dan ketentuan zakat yang dipilih. Konsultasikan dengan lembaga amil zakat atau ulama untuk kasus khusus.
          </p>
        </Card>
        <div className="space-y-5">
          <AnimatePresence mode="wait">{computation && <ResultPanel key={JSON.stringify(computation.result)} computation={computation} onSave={() => void onSave()} saving={saving} />}</AnimatePresence>
          <History />
        </div>
      </div>
    </div>
  );
}
