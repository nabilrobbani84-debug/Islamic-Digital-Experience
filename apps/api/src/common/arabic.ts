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

/**
 * Bagian awal `text` yang, setelah dinormalisasi, sama dengan `phrase` dan berakhir di batas spasi, dengan sisa
 * teks yang tidak kosong. Hasilnya potongan LITERAL dari `text` (tidak diubah), sehingga variasi penulisan harakat
 * antar-ayat tetap utuh dan klien dapat memotongnya dengan `startsWith`. Mengembalikan null bila tidak cocok.
 */
export function leadingPhrase(text: string, phrase: string): string | null {
  const target = normalizeArabic(phrase);
  if (!target) return null;
  for (let i = text.indexOf(" "); i !== -1; i = text.indexOf(" ", i + 1)) {
    const head = text.slice(0, i);
    const normalized = normalizeArabic(head);
    if (normalized === target) return text.slice(i + 1).trim().length > 0 ? head : null;
    if (normalized.length > target.length) return null;
  }
  return null;
}

export const hasArabic = (text: string): boolean => /[\u0600-\u06FF]/.test(text);

/** Escape karakter khusus LIKE/ILIKE. */
export const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (c) => `\\${c}`);
