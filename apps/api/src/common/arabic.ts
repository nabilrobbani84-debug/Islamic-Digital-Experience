/**
 * Normalisasi teks Arab untuk pencarian: hapus harakat, tanda Qur'an, dan tatwil;
 * samakan bentuk alif dan ya. Harus dipakai SAMA oleh importer dan query pencarian.
 */
export function normalizeArabic(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    .replace(/\u0649/g, "\u064A")
    .replace(/\s+/g, " ")
    .trim();
}

export const hasArabic = (text: string): boolean => /[\u0600-\u06FF]/.test(text);

/** Escape karakter khusus LIKE/ILIKE. */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (c) => `\\${c}`);
