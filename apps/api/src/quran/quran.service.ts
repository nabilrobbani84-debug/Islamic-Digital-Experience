import { Inject, Injectable } from "@nestjs/common";
import { ApiException, notFound } from "../common/http";
import { escapeLike, hasArabic, leadingPhrase, normalizeArabic } from "../common/arabic";
import { CONFIG, type AppConfig } from "../config";
import { PrismaService } from "../prisma/prisma.service";

export interface SurahDto {
  id: number;
  number: number;
  nameArabic: string;
  nameLatin: string;
  meaning: string | null;
  revelationType: string;
  totalVerses: number;
}

interface SearchRow {
  surah_number: number;
  surah_name: string;
  verse_number: number;
  text_uthmani: string;
  translation: string | null;
}

const toSurahDto = (s: { id: number; number: number; nameArabic: string; nameLatin: string; meaning: string | null; revelationType: string; totalVerses: number }): SurahDto => ({
  id: s.id,
  number: s.number,
  nameArabic: s.nameArabic,
  nameLatin: s.nameLatin,
  meaning: s.meaning,
  revelationType: s.revelationType,
  totalVerses: s.totalVerses,
});

@Injectable()
export class QuranService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  /** Dataset teks hanya dilayani setelah versi terbaru disetujui (PUBLISHED). */
  async publishedMeta(): Promise<Record<string, unknown> | null> {
    const ds = await this.prisma.datasetVersion.findFirst({
      where: { datasetName: "quran-text", status: "PUBLISHED" },
      orderBy: { importedAt: "desc" },
      include: { contentSource: true },
    });
    if (!ds) return null;
    return {
      datasetVersion: ds.version,
      source: ds.contentSource?.name ?? ds.source ?? undefined,
      license: ds.contentSource?.license ?? undefined,
      sourceUrl: ds.contentSource?.url ?? undefined,
    };
  }

  async surahs(): Promise<{ data: SurahDto[]; meta: Record<string, unknown> }> {
    const meta = await this.publishedMeta();
    if (!meta) return { data: [], meta: {} };
    const rows = await this.prisma.surah.findMany({ orderBy: { number: "asc" } });
    return { data: rows.map(toSurahDto), meta };
  }

  async editions() {
    const rows = await this.prisma.quranEdition.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ language: "asc" }, { name: "asc" }] });
    return rows.map((e) => ({ id: e.id, name: e.name, language: e.language }));
  }

  async surah(number: number, editionId?: string) {
    const meta = await this.publishedMeta();
    if (!meta) throw notFound("Dataset Al-Qur'an belum diterbitkan");
    const surah = await this.prisma.surah.findUnique({ where: { number } });
    if (!surah) throw notFound("Surah tidak ditemukan");

    const edition = editionId
      ? await this.prisma.quranEdition.findFirst({ where: { id: editionId, status: "PUBLISHED" }, include: { contentSource: true } })
      : await this.prisma.quranEdition.findFirst({ where: { status: "PUBLISHED", language: "id" }, orderBy: { name: "asc" }, include: { contentSource: true } });
    if (editionId && !edition) throw notFound("Edisi terjemahan tidak ditemukan");

    const verses = await this.prisma.verse.findMany({ where: { surahId: surah.id }, orderBy: { verseNumber: "asc" } });

    // Beberapa sumber (mis. Tanzil) menyisipkan basmalah di awal ayat 1 hampir semua surah. Teks disimpan dan dilayani
    // VERBATIM; di sini hanya menunjukkan awalan tersebut agar klien dapat menampilkannya sebagai kepala surah.
    // Teks basmalah diambil dari data (ayat 1:1), bukan ditulis di kode. Surah 1 dan 9 tidak memakainya.
    // Dicocokkan pada bentuk ternormalisasi karena penulisan harakat bisa berbeda antar-surah (pada data Tanzil,
    // surah 95 dan 97 menambahkan tasydid); yang dikembalikan adalah potongan literal dari ayat 1 surah ini.
    let bismillahPrefix: string | null = null;
    const first = verses[0];
    if (surah.number !== 1 && surah.number !== 9 && first) {
      const opener = await this.prisma.verse.findFirst({ where: { verseNumber: 1, surah: { number: 1 } }, select: { textUthmani: true } });
      if (opener) bismillahPrefix = leadingPhrase(first.textUthmani, opener.textUthmani);
    }
    const translations = edition
      ? await this.prisma.verseTranslation.findMany({ where: { editionId: edition.id, verse: { surahId: surah.id } }, select: { verseId: true, translationText: true } })
      : [];
    const byVerse = new Map(translations.map((t) => [t.verseId.toString(), t.translationText]));

    return {
      data: {
        ...toSurahDto(surah),
        editionId: edition?.id ?? null,
        editionName: edition?.name ?? null,
        // Atribusi sumber terjemahan (nama, tautan, lisensi) agar klien dapat mencantumkannya.
        editionSource: edition ? { name: edition.contentSource?.name ?? edition.source, url: edition.contentSource?.url ?? null, license: edition.contentSource?.license ?? null } : null,
        bismillahPrefix,
        verses: verses.map((v) => ({
          id: v.id.toString(),
          number: v.verseNumber,
          globalNumber: v.globalNumber,
          textUthmani: v.textUthmani,
          translation: byVerse.get(v.id.toString()) ?? null,
          pageNumber: v.pageNumber,
          juzNumber: v.juzNumber,
        })),
      },
      meta,
    };
  }

  async juz(number: number) {
    const juz = await this.prisma.juz.findUnique({ where: { number }, include: { startSurah: true, endSurah: true } });
    if (!juz) throw notFound("Juz tidak ditemukan");
    return { number: juz.number, startSurah: juz.startSurah.number, startVerse: juz.startVerse, endSurah: juz.endSurah.number, endVerse: juz.endVerse };
  }

  async tafsir(surahNumber: number, verseNumber: number) {
    const rows = await this.prisma.tafsirContent.findMany({
      where: { verse: { verseNumber, surah: { number: surahNumber } }, source: { status: "PUBLISHED" } },
      include: { source: true },
      orderBy: { source: { name: "asc" } },
    });
    return rows.map((t) => ({ sourceName: t.source.name, author: t.source.author, content: t.content, reference: t.source.reference }));
  }

  /** Pencarian: "surah:ayat", teks Arab (dinormalisasi, trigram), atau terjemahan Indonesia (full-text). */
  async search(query: string) {
    const q = query.trim();
    if (q.length < 2 || q.length > 100) throw new ApiException(400, "VALIDATION_ERROR", "Kata kunci 2–100 karakter");
    if (!(await this.publishedMeta())) return [];

    const ref = /^(\d{1,3})\s*[:.]\s*(\d{1,3})$/.exec(q);
    let rows: SearchRow[];
    if (ref) {
      rows = await this.prisma.$queryRaw<SearchRow[]>`
        SELECT s.number::int AS surah_number, s.name_latin AS surah_name, v.verse_number::int AS verse_number, v.text_uthmani,
               (SELECT t.translation_text FROM verse_translations t JOIN quran_editions e ON e.id = t.edition_id
                 WHERE t.verse_id = v.id AND e.status = 'PUBLISHED' AND e.language = 'id' ORDER BY e.name LIMIT 1) AS translation
          FROM verses v JOIN surahs s ON s.id = v.surah_id
         WHERE s.number = ${Number(ref[1])} AND v.verse_number = ${Number(ref[2])}`;
    } else if (hasArabic(q)) {
      const pattern = `%${escapeLike(normalizeArabic(q))}%`;
      rows = await this.prisma.$queryRaw<SearchRow[]>`
        SELECT s.number::int AS surah_number, s.name_latin AS surah_name, v.verse_number::int AS verse_number, v.text_uthmani,
               (SELECT t.translation_text FROM verse_translations t JOIN quran_editions e ON e.id = t.edition_id
                 WHERE t.verse_id = v.id AND e.status = 'PUBLISHED' AND e.language = 'id' ORDER BY e.name LIMIT 1) AS translation
          FROM verses v JOIN surahs s ON s.id = v.surah_id
         WHERE v.text_normalized ILIKE ${pattern}
         ORDER BY v.global_number LIMIT 30`;
    } else {
      rows = await this.prisma.$queryRaw<SearchRow[]>`
        SELECT s.number::int AS surah_number, s.name_latin AS surah_name, v.verse_number::int AS verse_number, v.text_uthmani, t.translation_text AS translation
          FROM verse_translations t
          JOIN quran_editions e ON e.id = t.edition_id AND e.status = 'PUBLISHED' AND e.language = 'id'
          JOIN verses v ON v.id = t.verse_id
          JOIN surahs s ON s.id = v.surah_id
         WHERE to_tsvector('indonesian', t.translation_text) @@ websearch_to_tsquery('indonesian', ${q})
         ORDER BY v.global_number LIMIT 30`;
    }
    return rows.map((r) => ({ surahNumber: r.surah_number, surahName: r.surah_name, verseNumber: r.verse_number, textUthmani: r.text_uthmani, translation: r.translation }));
  }

  async qaris() {
    const rows = await this.prisma.qari.findMany({ where: { status: "PUBLISHED" }, orderBy: { name: "asc" } });
    return rows.map((q) => ({ id: q.id, name: q.name, country: q.country }));
  }

  async audio(surahNumber: number, qariId: string) {
    const asset = await this.prisma.audioAsset.findFirst({
      where: { qariId, surah: { number: surahNumber }, qari: { status: "PUBLISHED" } },
      include: { segments: { include: { verse: { select: { verseNumber: true } } }, orderBy: { startMs: "asc" } } },
    });
    if (!asset) throw notFound("Audio untuk surah dan qari ini belum tersedia");
    const base = this.cfg.ASSET_BASE_URL.replace(/\/+$/, "");
    return {
      qariId,
      surahNumber,
      url: `${base}/${asset.filePath.replace(/^\/+/, "")}`,
      durationMs: asset.durationMs,
      checksum: asset.checksum,
      segments: asset.segments.length > 0 ? asset.segments.map((s) => ({ verseNumber: s.verse.verseNumber, startMs: s.startMs, endMs: s.endMs })) : null,
    };
  }
}
