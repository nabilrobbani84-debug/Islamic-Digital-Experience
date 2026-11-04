export type ClassValue = string | number | bigint | boolean | null | undefined;

/** Menggabungkan className secara kondisional; hanya string tidak kosong yang dipakai. */
export function cn(...values: ClassValue[]): string {
  return values.filter((v): v is string => typeof v === "string" && v.length > 0).join(" ");
}
