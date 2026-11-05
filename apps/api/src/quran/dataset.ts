import { z } from "zod";

/**
 * Format dataset Al-Qur'an NUR ("nur-quran-dataset/1"). Dataset berasal dari sumber berlisensi yang
 * diverifikasi manusia; kode ini memeriksa KONSISTENSI STRUKTUR, bukan kebenaran teks.
 * Kebenaran teks tetap memerlukan perbandingan dengan mushaf sumber (lihat docs/DATA_INTEGRITY.md).
 */
const sourceSchema = z.object({
  name: z.string().min(2),
  publisher: z.string().optional(),
  license: z.string().min(2, "Lisensi sumber wajib dicantumkan"),
  attribution: z.string().optional(),
  url: z.string().url().optional(),
});

export const datasetSchema = z.object({
  format: z.literal("nur-quran-dataset/1"),
  version: z.string().min(1).max(40),
  source: sourceSchema,
  surahs: z.array(
    z.object({
      number: z.number().int().min(1).max(114),
      nameArabic: z.string().min(1),
      nameLatin: z.string().min(1),
      meaning: z.string().optional(),
      revelationType: z.enum(["MAKKIYAH", "MADANIYAH"]),
      verses: z.array(
        z.object({ number: z.number().int().min(1), textUthmani: z.string().min(1), page: z.number().int().min(1).max(604), juz: z.number().int().min(1).max(30), hizb: z.number().int().min(1).max(60).optional() }),
      ),
    }),
  ),
  juzs: z.array(z.object({ number: z.number().int().min(1).max(30), startSurah: z.number().int(), startVerse: z.number().int(), endSurah: z.number().int(), endVerse: z.number().int() })),
  translations: z
    .array(
      z.object({
        name: z.string().min(2),
        language: z.string().min(2).max(10),
        version: z.string().min(1).max(40),
        source: sourceSchema,
        items: z.array(z.object({ surah: z.number().int(), verse: z.number().int(), text: z.string().min(1) })),
      }),
    )
    .default([]),
});
export type QuranDataset = z.infer<typeof datasetSchema>;

/** Jumlah ayat mushaf standar Hafs (6.236) dan 114 surah. */
export const STANDARD = { surahs: 114, verses: 6236, juzs: 30 } as const;

export function validateDataset(data: QuranDataset, options: { partial?: boolean } = {}): string[] {
  const errors: string[] = [];
  const seenSurah = new Set<number>();
  let total = 0;
  let lastPage = 0;
  let lastJuz = 0;

  const ordered = [...data.surahs].sort((a, b) => a.number - b.number);
  for (const surah of ordered) {
    if (seenSurah.has(surah.number)) errors.push(`Surah ${surah.number} duplikat`);
    seenSurah.add(surah.number);
    const numbers = surah.verses.map((v) => v.number).sort((a, b) => a - b);
    if (numbers.length === 0) errors.push(`Surah ${surah.number} tidak memiliki ayat`);
    numbers.forEach((n, i) => {
      if (n !== i + 1) errors.push(`Surah ${surah.number}: nomor ayat tidak berurutan/duplikat di posisi ${i + 1} (${n})`);
    });
    for (const verse of [...surah.verses].sort((a, b) => a.number - b.number)) {
      total++;
      if (verse.page < lastPage) errors.push(`Surah ${surah.number}:${verse.number}: halaman mundur (${verse.page} < ${lastPage})`);
      if (verse.juz < lastJuz) errors.push(`Surah ${surah.number}:${verse.number}: juz mundur (${verse.juz} < ${lastJuz})`);
      lastPage = Math.max(lastPage, verse.page);
      lastJuz = Math.max(lastJuz, verse.juz);
    }
  }

  if (!options.partial) {
    if (seenSurah.size !== STANDARD.surahs) errors.push(`Jumlah surah ${seenSurah.size}, seharusnya ${STANDARD.surahs}`);
    for (let n = 1; n <= STANDARD.surahs; n++) if (!seenSurah.has(n)) errors.push(`Surah ${n} tidak ada`);
    if (total !== STANDARD.verses) errors.push(`Jumlah ayat ${total}, seharusnya ${STANDARD.verses}`);
    if (data.juzs.length !== STANDARD.juzs) errors.push(`Jumlah juz ${data.juzs.length}, seharusnya ${STANDARD.juzs}`);
  }

  const verseKeys = new Set(data.surahs.flatMap((s) => s.verses.map((v) => `${s.number}:${v.number}`)));
  for (const j of data.juzs) {
    if (!verseKeys.has(`${j.startSurah}:${j.startVerse}`) || !verseKeys.has(`${j.endSurah}:${j.endVerse}`)) errors.push(`Juz ${j.number}: batas mengacu ke ayat yang tidak ada`);
  }

  for (const t of data.translations) {
    const seen = new Set<string>();
    for (const item of t.items) {
      const key = `${item.surah}:${item.verse}`;
      if (!verseKeys.has(key)) errors.push(`Terjemahan "${t.name}": ${key} tidak ada pada teks Arab`);
      if (seen.has(key)) errors.push(`Terjemahan "${t.name}": ${key} duplikat`);
      seen.add(key);
    }
    if (!options.partial && seen.size !== verseKeys.size) errors.push(`Terjemahan "${t.name}" mencakup ${seen.size} dari ${verseKeys.size} ayat`);
  }
  return errors.slice(0, 50);
}
