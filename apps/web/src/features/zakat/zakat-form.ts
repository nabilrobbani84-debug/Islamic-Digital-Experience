import { z } from "zod";
import {
  calculateFitrah,
  calculateZakat,
  nisabFromMetalPrice,
  sumAmounts,
  ZAKAT_RULES,
  ZAKAT_RULE_VERSION,
  mul,
  dec,
  toFixed,
  type ZakatResult,
} from "@nur/islamic-calculations";
import { parseLocaleNumber } from "@/lib/format";

export type ZakatTab = "INCOME" | "GOLD" | "SAVINGS" | "TRADE" | "SILVER" | "FITRAH";

export interface FieldDef {
  name: "a" | "b" | "c" | "d" | "debt" | "price" | "persons" | "perPerson";
  label: string;
  hint?: string;
  kind: "money" | "grams" | "count";
  required?: boolean;
}

/** Definisi input per jenis zakat. Harga emas/perak WAJIB diisi pengguna (tidak ada API harga). */
export const ZAKAT_FIELDS: Record<ZakatTab, FieldDef[]> = {
  INCOME: [
    { name: "a", label: "Penghasilan bulanan", kind: "money", required: true },
    { name: "b", label: "Penghasilan lain (bonus, usaha)", kind: "money" },
    { name: "debt", label: "Cicilan utang jatuh tempo bulan ini", kind: "money" },
    { name: "price", label: "Harga emas per gram", kind: "money", required: true, hint: "Masukkan harga emas terkini untuk menghitung nisab (85 g ÷ 12 bulan)." },
  ],
  GOLD: [
    { name: "a", label: "Berat emas tersimpan (gram)", kind: "grams", required: true },
    { name: "price", label: "Harga emas per gram", kind: "money", required: true },
  ],
  SILVER: [
    { name: "a", label: "Berat perak tersimpan (gram)", kind: "grams", required: true },
    { name: "price", label: "Harga perak per gram", kind: "money", required: true },
  ],
  SAVINGS: [
    { name: "a", label: "Saldo tabungan", kind: "money", required: true },
    { name: "b", label: "Deposito", kind: "money" },
    { name: "c", label: "Uang tunai & e-wallet", kind: "money" },
    { name: "debt", label: "Utang jatuh tempo", kind: "money" },
    { name: "price", label: "Harga emas per gram", kind: "money", required: true, hint: "Nisab setara 85 g emas." },
  ],
  TRADE: [
    { name: "a", label: "Nilai stok barang dagangan", kind: "money", required: true },
    { name: "b", label: "Kas usaha", kind: "money" },
    { name: "c", label: "Piutang lancar", kind: "money" },
    { name: "debt", label: "Utang dagang jatuh tempo", kind: "money" },
    { name: "price", label: "Harga emas per gram", kind: "money", required: true },
  ],
  FITRAH: [
    { name: "persons", label: "Jumlah jiwa", kind: "count", required: true },
    { name: "perPerson", label: "Nilai per jiwa", kind: "money", required: true, hint: "Sesuai ketetapan lembaga amil zakat setempat." },
  ],
};

export const zakatFormSchema = z
  .object({
    type: z.enum(["INCOME", "GOLD", "SAVINGS", "TRADE", "SILVER", "FITRAH"]),
    a: z.string(),
    b: z.string(),
    c: z.string(),
    d: z.string(),
    debt: z.string(),
    price: z.string(),
    persons: z.string(),
    perPerson: z.string(),
    haulCompleted: z.boolean(),
  })
  .superRefine((values, ctx) => {
    for (const field of ZAKAT_FIELDS[values.type]) {
      const raw = values[field.name].trim();
      if (!raw) {
        if (field.required) ctx.addIssue({ code: "custom", path: [field.name], message: `${field.label} wajib diisi` });
        continue;
      }
      if (field.kind === "count") {
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 100) ctx.addIssue({ code: "custom", path: [field.name], message: "Masukkan 1–100 jiwa" });
        continue;
      }
      if (parseLocaleNumber(raw, field.kind === "grams") === null) {
        ctx.addIssue({ code: "custom", path: [field.name], message: field.kind === "grams" ? "Gunakan angka, misalnya 92,5" : "Gunakan angka tanpa huruf, misalnya 5.000.000" });
      }
    }
  });

export type ZakatFormValues = z.infer<typeof zakatFormSchema>;

export const ZAKAT_DEFAULTS: ZakatFormValues = { type: "INCOME", a: "", b: "", c: "", d: "", debt: "", price: "", persons: "1", perPerson: "", haulCompleted: false };

export interface ZakatComputation {
  type: ZakatTab;
  totalAssets: string;
  deductibleDebt: string;
  result: ZakatResult;
  requiresHaul: boolean;
}

const money = (v: string): string => parseLocaleNumber(v) ?? "0";
const grams = (v: string): string => parseLocaleNumber(v, true) ?? "0";

/** Menghitung zakat dari nilai formulir memakai engine desimal (tanpa floating point). */
export function computeZakat(values: ZakatFormValues): ZakatComputation {
  if (values.type === "FITRAH") {
    const fitrah = calculateFitrah({ persons: Number(values.persons), amountPerPerson: money(values.perPerson) });
    return {
      type: "FITRAH",
      totalAssets: fitrah.total,
      deductibleDebt: "0",
      requiresHaul: false,
      result: { eligible: true, netAssets: fitrah.total, nisab: "0", rate: "1.000000", payableAmount: fitrah.total, ruleVersion: ZAKAT_RULE_VERSION, reason: "ELIGIBLE" },
    };
  }
  const rule = ZAKAT_RULES[values.type];
  let totalAssets: string;
  if (values.type === "GOLD" || values.type === "SILVER") {
    totalAssets = toFixed(mul(dec(grams(values.a)), dec(money(values.price))), 0);
  } else {
    totalAssets = sumAmounts([money(values.a), money(values.b), money(values.c)]);
  }
  const deductibleDebt = values.type === "GOLD" || values.type === "SILVER" ? "0" : money(values.debt);
  const nisabValue = nisabFromMetalPrice(rule, money(values.price));
  const result = calculateZakat({ type: values.type, totalAssets, deductibleDebt, nisabValue, rate: rule.rate, haulCompleted: values.haulCompleted });
  return { type: values.type, totalAssets, deductibleDebt, result, requiresHaul: rule.requiresHaul };
}
