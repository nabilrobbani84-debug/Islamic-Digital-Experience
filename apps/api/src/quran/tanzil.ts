/**
 * Konverter berkas Tanzil (https://tanzil.net) ke format dataset NUR (`nur-quran-dataset/1`).
 *
 * ATURAN KERAS: teks disalin APA ADANYA. Lisensi teks Tanzil hanya mengizinkan salinan verbatim; mengubah teks
 * tidak diizinkan. Maka konverter tidak melakukan trim, normalisasi Unicode, penghapusan basmalah, atau pembersihan
 * lain pada teks. Hanya terminator baris (CR/LF) dan BOM di awal berkas yang diabaikan. Normalisasi untuk pencarian
 * dilakukan terpisah di kolom `text_normalized` oleh importer, tidak pada teks yang ditampilkan.
 *
 * Format yang dipakai (diperiksa langsung dari berkas Tanzil):
 *   teks/terjemahan : baris `surah|ayat|teks`; baris berawalan `#` adalah blok hak cipta/lisensi.
 *   quran-data.xml  : <sura index ayas start name tname ename type="Meccan|Medinan"/>, <juz|page|quarter index sura aya/>
 *                     (penanda AWAL; `start` = jumlah ayat pada surah-surah sebelumnya).
 */
import { createHash } from "node:crypto";
import { datasetSchema, type QuranDataset } from "./dataset";

export class TanzilFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TanzilFormatError";
  }
}

export const sha256Hex = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

export interface SourceFile {
  name: string;
  sha256: string;
}

interface Marker {
  index: number;
  sura: number;
  aya: number;
}

export interface TanzilSura {
  index: number;
  ayas: number;
  start: number;
  name: string;
  tname: string;
  ename: string;
  type: string;
}

export interface TanzilMetadata {
  suras: TanzilSura[];
  juz: Marker[];
  page: Marker[];
  quarter: Marker[];
}

export interface TextEntry {
  sura: number;
  aya: number;
  text: string;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const decodeEntities = (value: string): string => value.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m] ?? m);

function attributes(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    if (m[1] !== undefined && m[2] !== undefined) out[m[1]] = decodeEntities(m[2]);
  }
  return out;
}

function elements(xml: string, tag: string): Record<string, string>[] {
  return [...xml.matchAll(new RegExp(`<${tag}\\s+([^>]*?)\\/?>`, "g"))].map((m) => attributes(m[1] ?? ""));
}

function int(record: Record<string, string>, key: string, label: string): number {
  const raw = record[key];
  const n = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new TanzilFormatError(`${label}: atribut "${key}" bukan bilangan bulat (${String(raw)})`);
  return n;
}

function markers(xml: string, tag: string): Marker[] {
  return elements(xml, tag).map((e) => ({ index: int(e, "index", tag), sura: int(e, "sura", tag), aya: int(e, "aya", tag) }));
}

export function parseMetadata(xml: string): TanzilMetadata {
  const suras = elements(xml, "sura").map((e) => ({
    index: int(e, "index", "sura"),
    ayas: int(e, "ayas", "sura"),
    start: int(e, "start", "sura"),
    name: e["name"] ?? "",
    tname: e["tname"] ?? "",
    ename: e["ename"] ?? "",
    type: e["type"] ?? "",
  }));
  if (suras.length === 0) throw new TanzilFormatError("Metadata tidak memuat elemen <sura>");
  let running = 0;
  suras.forEach((s, i) => {
    if (s.index !== i + 1) throw new TanzilFormatError(`Surah ke-${i + 1} memiliki index ${s.index}`);
    if (s.start !== running) throw new TanzilFormatError(`Surah ${s.index}: start=${s.start}, seharusnya ${running} (jumlah ayat surah sebelumnya)`);
    if (!s.name || !s.tname) throw new TanzilFormatError(`Surah ${s.index}: nama kosong`);
    running += s.ayas;
  });
  return { suras, juz: markers(xml, "juz"), page: markers(xml, "page"), quarter: markers(xml, "quarter") };
}

/** Mem-parse berkas `surah|ayat|teks`. Teks TIDAK diubah. */
export function parseText(raw: string): { entries: TextEntry[]; header: string } {
  const entries: TextEntry[] = [];
  const header: string[] = [];
  raw
    .replace(/^\uFEFF/, "")
    .split("\n")
    .forEach((line, i) => {
      const l = line.endsWith("\r") ? line.slice(0, -1) : line;
      if (l.trim() === "") return;
      if (l.startsWith("#")) {
        header.push(l);
        return;
      }
      const m = /^(\d+)\|(\d+)\|(.+)$/.exec(l);
      if (!m) throw new TanzilFormatError(`Baris ${i + 1} bukan "surah|ayat|teks": ${l.slice(0, 60)}`);
      entries.push({ sura: Number(m[1]), aya: Number(m[2]), text: m[3] ?? "" });
    });
  return { entries, header: header.join("\n") };
}

/** Untuk posisi 0..total-1, kembalikan nomor rentang (1-based) berdasarkan indeks awal rentang. */
export function assignRanges(starts: number[], total: number): number[] {
  const out: number[] = new Array<number>(total);
  let k = 0;
  for (let g = 0; g < total; g++) {
    while (k + 1 < starts.length && (starts[k + 1] as number) <= g) k++;
    out[g] = k + 1;
  }
  return out;
}

export interface BuildInput {
  /** Isi berkas teks Utsmani Tanzil. */
  text: string;
  /** Isi quran-data.xml. */
  metadata: string;
  /** Berkas sumber beserta SHA-256 (jejak asal data). */
  files: SourceFile[];
  translation?: {
    name: string;
    language: string;
    /** Lisensi terjemahan: WAJIB eksplisit (tidak ada nilai bawaan). */
    license: string;
    sourceName?: string;
    text: string;
    fileSha256: string;
  };
}

export const TANZIL_TEXT_LICENSE = "Tanzil: salinan verbatim, atribusi wajib (https://tanzil.net/docs/Text_License). Metadata: cc-by.";

export function buildDataset(input: BuildInput): QuranDataset {
  const meta = parseMetadata(input.metadata);
  const { entries, header } = parseText(input.text);
  const total = meta.suras.reduce((n, s) => n + s.ayas, 0);
  const startOf = new Map(meta.suras.map((s) => [s.index, s.start]));
  const ayasOf = new Map(meta.suras.map((s) => [s.index, s.ayas]));

  const globalIndex = (sura: number, aya: number, label: string): number => {
    const start = startOf.get(sura);
    const ayas = ayasOf.get(sura);
    if (start === undefined || ayas === undefined || aya < 1 || aya > ayas) throw new TanzilFormatError(`${label}: posisi ${sura}:${aya} di luar metadata`);
    return start + aya - 1;
  };

  // Teks harus tepat satu baris per ayat, berurutan, sesuai jumlah ayat metadata.
  if (entries.length !== total) throw new TanzilFormatError(`Teks memuat ${entries.length} ayat, metadata ${total}`);
  entries.forEach((e, i) => {
    if (globalIndex(e.sura, e.aya, "Teks") !== i) throw new TanzilFormatError(`Teks: baris ke-${i + 1} (${e.sura}:${e.aya}) tidak berurutan/tidak lengkap`);
  });

  const startIndexes = (list: Marker[], tag: string, expectedMax?: number): number[] => {
    if (list.length === 0) throw new TanzilFormatError(`Metadata tidak memuat <${tag}>`);
    if (expectedMax !== undefined && list.length > expectedMax) throw new TanzilFormatError(`<${tag}> berjumlah ${list.length}, maksimum ${expectedMax}`);
    const idx = list.map((m, i) => {
      if (m.index !== i + 1) throw new TanzilFormatError(`<${tag}> ke-${i + 1} memiliki index ${m.index}`);
      return globalIndex(m.sura, m.aya, `<${tag}>`);
    });
    if (idx[0] !== 0) throw new TanzilFormatError(`<${tag}> pertama harus dimulai di 1:1`);
    idx.forEach((v, i) => {
      if (i > 0 && v <= (idx[i - 1] as number)) throw new TanzilFormatError(`<${tag}> ke-${i + 1} tidak menaik`);
    });
    return idx;
  };

  const pageOf = assignRanges(startIndexes(meta.page, "page", 604), total);
  const juzStarts = startIndexes(meta.juz, "juz", 30);
  const juzOf = assignRanges(juzStarts, total);
  // 240 perempat = 60 hizb; hizb hanya diisi bila data lengkap.
  const hizbOf = meta.quarter.length === 240 ? assignRanges(startIndexes(meta.quarter, "quarter"), total).map((q) => Math.ceil(q / 4)) : null;

  const surahs = meta.suras.map((s) => {
    const revelationType = s.type === "Meccan" ? "MAKKIYAH" : s.type === "Medinan" ? "MADANIYAH" : null;
    if (!revelationType) throw new TanzilFormatError(`Surah ${s.index}: type "${s.type}" tidak dikenal`);
    return {
      number: s.index,
      nameArabic: s.name,
      nameLatin: s.tname,
      meaning: s.ename || undefined,
      revelationType,
      verses: entries.slice(s.start, s.start + s.ayas).map((e, i) => {
        const g = s.start + i;
        return { number: e.aya, textUthmani: e.text, page: pageOf[g] as number, juz: juzOf[g] as number, ...(hizbOf ? { hizb: hizbOf[g] as number } : {}) };
      }),
    };
  });

  // Akhir juz = ayat tepat sebelum awal juz berikutnya; juz terakhir berakhir di ayat terakhir mushaf.
  const lastSura = meta.suras[meta.suras.length - 1] as TanzilSura;
  const before = (m: Marker): { surah: number; verse: number } =>
    m.aya > 1 ? { surah: m.sura, verse: m.aya - 1 } : { surah: m.sura - 1, verse: ayasOf.get(m.sura - 1) as number };
  const juzs = meta.juz.map((m, i) => {
    const next = meta.juz[i + 1];
    const end = next ? before(next) : { surah: lastSura.index, verse: lastSura.ayas };
    return { number: m.index, startSurah: m.sura, startVerse: m.aya, endSurah: end.surah, endVerse: end.verse };
  });

  const version = /Version\s+([\d.]+)/i.exec(header)?.[1];
  const textFile = input.files[0]?.sha256 ?? sha256Hex(input.text);
  const provenance = input.files.map((f) => `- ${f.name} sha256=${f.sha256}`).join("\n");

  const translations: QuranDataset["translations"] = [];
  if (input.translation) {
    const t = input.translation;
    if (!t.license.trim()) throw new TanzilFormatError("Lisensi terjemahan wajib diisi eksplisit");
    const parsed = parseText(t.text);
    if (parsed.entries.length !== total) throw new TanzilFormatError(`Terjemahan memuat ${parsed.entries.length} ayat, seharusnya ${total}`);
    parsed.entries.forEach((e, i) => {
      if (globalIndex(e.sura, e.aya, "Terjemahan") !== i) throw new TanzilFormatError(`Terjemahan: baris ke-${i + 1} (${e.sura}:${e.aya}) tidak berurutan/tidak lengkap`);
    });
    translations.push({
      name: t.name,
      language: t.language,
      version: `tanzil-${t.language}-${t.fileSha256.slice(0, 12)}`,
      source: { name: t.sourceName ?? "Tanzil.net", publisher: "Tanzil Project", license: t.license, attribution: `${parsed.header}\n\nBerkas sumber:\n${provenance}`, url: "https://tanzil.net" },
      items: parsed.entries.map((e) => ({ surah: e.sura, verse: e.aya, text: e.text })),
    });
  }

  return datasetSchema.parse({
    format: "nur-quran-dataset/1",
    version: `tanzil-uthmani-${version ?? textFile.slice(0, 12)}`,
    source: { name: "Tanzil Quran Text (Uthmani)", publisher: "Tanzil Project", license: TANZIL_TEXT_LICENSE, attribution: `${header}\n\nBerkas sumber:\n${provenance}`, url: "https://tanzil.net" },
    surahs,
    juzs,
    translations,
  });
}
