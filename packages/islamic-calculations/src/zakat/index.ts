import {
  add,
  cmp,
  dec,
  div,
  isNegative,
  max,
  mul,
  sub,
  toFixed,
  ZERO,
  type Decimal,
} from "../decimal.ts";

export const ZAKAT_RULE_VERSION = "nur-zakat-1.0.0";

export type ZakatType = "FITRAH" | "MAAL" | "INCOME" | "TRADE" | "GOLD" | "SILVER" | "SAVINGS";

/**
 * Parameter aturan per jenis zakat. Nilai nisab dalam gram emas/perak mengikuti ketentuan
 * yang umum dipakai (85 g emas, 595 g perak, tarif 2,5%). Harga per gram TIDAK disediakan
 * aplikasi: pengguna atau admin wajib memasukkan harga terkini.
 */
export interface ZakatRule {
  type: Exclude<ZakatType, "FITRAH">;
  label: string;
  rate: string;
  nisabBasis: "GOLD" | "SILVER";
  nisabGrams: string;
  requiresHaul: boolean;
  /** true jika nisab dibandingkan per bulan (nisab tahunan / 12). */
  monthlyNisab: boolean;
  description: string;
}

export const ZAKAT_RULES: Record<Exclude<ZakatType, "FITRAH">, ZakatRule> = {
  INCOME: {
    type: "INCOME",
    label: "Zakat Penghasilan",
    rate: "0.025",
    nisabBasis: "GOLD",
    nisabGrams: "85",
    requiresHaul: false,
    monthlyNisab: true,
    description: "Dihitung dari penghasilan bulanan. Nisab bulanan = nilai 85 g emas ÷ 12.",
  },
  GOLD: {
    type: "GOLD",
    label: "Zakat Emas",
    rate: "0.025",
    nisabBasis: "GOLD",
    nisabGrams: "85",
    requiresHaul: true,
    monthlyNisab: false,
    description: "Emas yang disimpan minimal 85 g dan telah dimiliki satu tahun Hijriah (haul).",
  },
  SILVER: {
    type: "SILVER",
    label: "Zakat Perak",
    rate: "0.025",
    nisabBasis: "SILVER",
    nisabGrams: "595",
    requiresHaul: true,
    monthlyNisab: false,
    description: "Perak yang disimpan minimal 595 g dan telah mencapai haul.",
  },
  SAVINGS: {
    type: "SAVINGS",
    label: "Zakat Tabungan",
    rate: "0.025",
    nisabBasis: "GOLD",
    nisabGrams: "85",
    requiresHaul: true,
    monthlyNisab: false,
    description: "Saldo tabungan/deposito setara nilai 85 g emas dan telah mencapai haul.",
  },
  TRADE: {
    type: "TRADE",
    label: "Zakat Perdagangan",
    rate: "0.025",
    nisabBasis: "GOLD",
    nisabGrams: "85",
    requiresHaul: true,
    monthlyNisab: false,
    description: "(Modal diputar + piutang lancar + kas + nilai stok) − utang jatuh tempo.",
  },
  MAAL: {
    type: "MAAL",
    label: "Zakat Maal (umum)",
    rate: "0.025",
    nisabBasis: "GOLD",
    nisabGrams: "85",
    requiresHaul: true,
    monthlyNisab: false,
    description: "Total harta wajib zakat dikurangi utang jatuh tempo.",
  },
};

export interface ZakatInput {
  type: Exclude<ZakatType, "FITRAH">;
  /** Total harta (string desimal, satuan mata uang). */
  totalAssets: string;
  deductibleDebt: string;
  /** Nilai nisab dalam mata uang (sudah dikalikan harga per gram). */
  nisabValue: string;
  rate: string;
  haulCompleted: boolean;
  /** Digit desimal mata uang (IDR = 0). */
  currencyDecimals?: number;
}

export interface ZakatResult {
  eligible: boolean;
  netAssets: string;
  nisab: string;
  rate: string;
  payableAmount: string;
  ruleVersion: string;
  reason: "ELIGIBLE" | "BELOW_NISAB" | "HAUL_NOT_COMPLETED";
}

export class ZakatInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZakatInputError";
  }
}

function nonNegative(name: string, value: string): Decimal {
  let parsed: Decimal;
  try {
    parsed = dec(value);
  } catch {
    throw new ZakatInputError(`${name} tidak valid`);
  }
  if (isNegative(parsed)) throw new ZakatInputError(`${name} tidak boleh negatif`);
  return parsed;
}

export function calculateZakat(input: ZakatInput): ZakatResult {
  const rule = ZAKAT_RULES[input.type];
  if (!rule) throw new ZakatInputError(`Jenis zakat tidak dikenal: ${input.type}`);
  const places = input.currencyDecimals ?? 0;
  const assets = nonNegative("Total harta", input.totalAssets);
  const debt = nonNegative("Utang", input.deductibleDebt);
  const nisab = nonNegative("Nisab", input.nisabValue);
  const rate = nonNegative("Tarif", input.rate);
  if (cmp(rate, dec(1)) > 0) throw new ZakatInputError("Tarif tidak boleh lebih dari 100%");

  const net = max(sub(assets, debt), ZERO);
  let reason: ZakatResult["reason"] = "ELIGIBLE";
  if (cmp(net, nisab) < 0) reason = "BELOW_NISAB";
  else if (rule.requiresHaul && !input.haulCompleted) reason = "HAUL_NOT_COMPLETED";
  const eligible = reason === "ELIGIBLE";
  const payable = eligible ? mul(net, rate) : ZERO;

  return {
    eligible,
    netAssets: toFixed(net, places),
    nisab: toFixed(nisab, places),
    rate: toFixed(rate, 6),
    payableAmount: toFixed(payable, places),
    ruleVersion: ZAKAT_RULE_VERSION,
    reason,
  };
}

/** Nilai nisab = gram × harga per gram (dibagi 12 untuk nisab bulanan). */
export function nisabFromMetalPrice(rule: ZakatRule, pricePerGram: string, currencyDecimals = 0): string {
  const price = nonNegative("Harga per gram", pricePerGram);
  const yearly = mul(dec(rule.nisabGrams), price);
  const value = rule.monthlyNisab ? div(yearly, dec(12)) : yearly;
  return toFixed(value, currencyDecimals);
}

/** Menjumlahkan beberapa komponen harta (string desimal). */
export function sumAmounts(values: readonly string[], currencyDecimals = 0): string {
  let total = ZERO;
  for (const v of values) {
    if (v.trim() === "") continue;
    total = add(total, nonNegative("Komponen harta", v));
  }
  return toFixed(total, currencyDecimals);
}

export interface FitrahInput {
  persons: number;
  /** Nilai per jiwa (uang) sesuai ketetapan lembaga setempat. */
  amountPerPerson: string;
  currencyDecimals?: number;
}

export function calculateFitrah(input: FitrahInput): { total: string; ruleVersion: string } {
  if (!Number.isInteger(input.persons) || input.persons < 1 || input.persons > 100) {
    throw new ZakatInputError("Jumlah jiwa harus 1..100");
  }
  const perPerson = nonNegative("Nilai per jiwa", input.amountPerPerson);
  return {
    total: toFixed(mul(perPerson, dec(input.persons)), input.currencyDecimals ?? 0),
    ruleVersion: ZAKAT_RULE_VERSION,
  };
}
