export type ClassValue = string | false | null | undefined | 0;

/** Menggabungkan className secara kondisional. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
