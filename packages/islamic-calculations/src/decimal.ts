/**
 * Aritmetika desimal fixed-point berbasis BigInt untuk nominal keuangan.
 * Semua nilai disimpan sebagai bilangan bulat dengan SCALE digit di belakang koma,
 * sehingga tidak ada galat pembulatan floating point (0.1 + 0.2 = 0.3 tepat).
 */

const SCALE = 12;
const FACTOR = 10n ** BigInt(SCALE);

export interface Decimal {
  readonly units: bigint;
}

const DECIMAL_PATTERN = /^(-)?(\d+)(?:\.(\d+))?$/;

export class DecimalParseError extends Error {
  constructor(input: string) {
    super(`Nilai desimal tidak valid: "${input}"`);
    this.name = "DecimalParseError";
  }
}

/** Mengurai string desimal dengan titik sebagai pemisah, misalnya "1250000.50". */
export function dec(input: string | number | bigint): Decimal {
  if (typeof input === "bigint") return { units: input * FACTOR };
  if (typeof input === "number") {
    if (!Number.isSafeInteger(input)) {
      throw new DecimalParseError(String(input));
    }
    return { units: BigInt(input) * FACTOR };
  }
  const trimmed = input.trim();
  const match = DECIMAL_PATTERN.exec(trimmed);
  if (!match) throw new DecimalParseError(input);
  const [, sign, whole = "0", fraction = ""] = match;
  if (fraction.length > SCALE) throw new DecimalParseError(input);
  const units = BigInt(whole) * FACTOR + BigInt(fraction.padEnd(SCALE, "0") || "0");
  return { units: sign ? -units : units };
}

export function isValidDecimal(input: string): boolean {
  const match = DECIMAL_PATTERN.exec(input.trim());
  return match !== null && (match[3]?.length ?? 0) <= SCALE;
}

export const ZERO: Decimal = { units: 0n };

export function add(a: Decimal, b: Decimal): Decimal {
  return { units: a.units + b.units };
}

export function sub(a: Decimal, b: Decimal): Decimal {
  return { units: a.units - b.units };
}

/** Perkalian dengan pembulatan half-up pada SCALE digit. */
export function mul(a: Decimal, b: Decimal): Decimal {
  return { units: divRoundHalfUp(a.units * b.units, FACTOR) };
}

/** Pembagian dengan pembulatan half-up pada SCALE digit. */
export function div(a: Decimal, b: Decimal): Decimal {
  if (b.units === 0n) throw new RangeError("Pembagian dengan nol");
  return { units: divRoundHalfUp(a.units * FACTOR, b.units) };
}

export function cmp(a: Decimal, b: Decimal): -1 | 0 | 1 {
  if (a.units < b.units) return -1;
  if (a.units > b.units) return 1;
  return 0;
}

export function max(a: Decimal, b: Decimal): Decimal {
  return cmp(a, b) >= 0 ? a : b;
}

export function isNegative(a: Decimal): boolean {
  return a.units < 0n;
}

/** Membulatkan ke `places` digit desimal (half-up, menjauhi nol). */
export function round(a: Decimal, places: number): Decimal {
  if (!Number.isInteger(places) || places < 0 || places > SCALE) {
    throw new RangeError(`places harus 0..${SCALE}`);
  }
  const step = 10n ** BigInt(SCALE - places);
  return { units: divRoundHalfUp(a.units, step) * step };
}

/** Mengubah ke string dengan tepat `places` digit desimal. */
export function toFixed(a: Decimal, places: number): string {
  const rounded = round(a, places);
  const negative = rounded.units < 0n;
  const abs = negative ? -rounded.units : rounded.units;
  const whole = abs / FACTOR;
  const fraction = (abs % FACTOR).toString().padStart(SCALE, "0").slice(0, places);
  const body = places > 0 ? `${whole}.${fraction}` : `${whole}`;
  return negative && rounded.units !== 0n ? `-${body}` : body;
}

function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = n / d;
  const r = n % d;
  const rounded = r * 2n >= d ? q + 1n : q;
  return negative ? -rounded : rounded;
}
