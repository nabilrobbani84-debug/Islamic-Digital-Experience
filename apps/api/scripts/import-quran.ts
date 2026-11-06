/**
 * Impor dataset Al-Qur'an ke PostgreSQL.
 *
 *   npm run build && node dist/scripts/import-quran.js path/ke/dataset.json [--partial]
 *
 * - Format: lihat src/quran/dataset.ts. Validasi struktur ketat (114 surah, 6.236 ayat) kecuali --partial.
 * - Hasil impor berstatus REVIEW. Dataset BARU dilayani ke pengguna setelah admin menyetujuinya
 *   (POST /api/v1/admin/datasets/:id/approve).
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { normalizeArabic } from "../src/common/arabic";
import { datasetSchema, validateDataset } from "../src/quran/dataset";

async function main(): Promise<void> {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) throw new Error("Pemakaian: import-quran <dataset.json> [--partial]");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib diisi");
  const partial = flags.includes("--partial");

  const raw = readFileSync(file);
  const checksum = createHash("sha256").update(raw).digest("hex");
  const parsed = datasetSchema.safeParse(JSON.parse(raw.toString("utf8")));
  if (!parsed.success) throw new Error(`Format dataset tidak valid:\n${parsed.error.issues.slice(0, 10).map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
  const data = parsed.data;
  const problems = validateDataset(data, { partial });
  if (problems.length > 0) throw new Error(`Validasi dataset gagal:\n${problems.map((p) => `  - ${p}`).join("\n")}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const verseCount = data.surahs.reduce((n, s) => n + s.verses.length, 0);
    await prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.datasetVersion.findUnique({ where: { datasetName_version: { datasetName: "quran-text", version: data.version } } });
        if (duplicate) throw new Error(`Dataset quran-text versi ${data.version} sudah diimpor`);
        const source = await tx.contentSource.create({ data: { name: data.source.name, publisher: data.source.publisher, license: data.source.license, attribution: data.source.attribution, url: data.source.url } });

        let global = 0;
        for (const s of [...data.surahs].sort((a, b) => a.number - b.number)) {
          await tx.surah.upsert({
            where: { number: s.number },
            create: { id: s.number, number: s.number, nameArabic: s.nameArabic, nameLatin: s.nameLatin, meaning: s.meaning, revelationType: s.revelationType, totalVerses: s.verses.length },
            update: { nameArabic: s.nameArabic, nameLatin: s.nameLatin, meaning: s.meaning, revelationType: s.revelationType, totalVerses: s.verses.length },
          });
          await tx.verse.deleteMany({ where: { surahId: s.number } });
          await tx.verse.createMany({
            data: [...s.verses]
              .sort((a, b) => a.number - b.number)
              .map((v) => ({ surahId: s.number, verseNumber: v.number, globalNumber: ++global, textUthmani: v.textUthmani, textNormalized: normalizeArabic(v.textUthmani), pageNumber: v.page, juzNumber: v.juz, hizbNumber: v.hizb ?? null })),
          });
        }
        await tx.juz.deleteMany();
        for (const j of data.juzs) {
          await tx.juz.create({ data: { number: j.number, startSurahId: j.startSurah, startVerse: j.startVerse, endSurahId: j.endSurah, endVerse: j.endVerse } });
        }
        await tx.datasetVersion.create({ data: { datasetName: "quran-text", version: data.version, checksum, recordCount: verseCount, source: data.source.name, contentSourceId: source.id, status: "REVIEW" } });

        const verses = await tx.verse.findMany({ select: { id: true, verseNumber: true, surah: { select: { number: true } } } });
        const idByKey = new Map(verses.map((v) => [`${v.surah.number}:${v.verseNumber}`, v.id]));
        for (const t of data.translations) {
          const tsource = await tx.contentSource.create({ data: { name: t.source.name, publisher: t.source.publisher, license: t.source.license, attribution: t.source.attribution, url: t.source.url } });
          const edition = await tx.quranEdition.create({ data: { name: t.name, language: t.language, version: t.version, source: t.source.name, contentSourceId: tsource.id, status: "REVIEW" } });
          const rows = t.items.map((i) => ({ verseId: idByKey.get(`${i.surah}:${i.verse}`) as bigint, editionId: edition.id, translationText: i.text }));
          for (let i = 0; i < rows.length; i += 2000) await tx.verseTranslation.createMany({ data: rows.slice(i, i + 2000) });
          await tx.datasetVersion.create({ data: { datasetName: `quran-translation:${t.name}`, version: t.version, checksum, recordCount: rows.length, source: t.source.name, contentSourceId: tsource.id, status: "REVIEW" } });
        }
      },
      { timeout: 300_000, maxWait: 10_000 },
    );
    console.log(`Impor selesai: ${data.surahs.length} surah, ${verseCount} ayat, ${data.translations.length} terjemahan. checksum=${checksum}`);
    console.log("Status REVIEW — setujui lewat panel admin sebelum dilayani ke pengguna.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
