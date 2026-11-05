import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeArabic } from "../src/common/arabic";
import { datasetSchema, STANDARD, validateDataset, type QuranDataset } from "../src/quran/dataset";
import { loadConfig } from "../src/config";

const base = (): QuranDataset =>
  datasetSchema.parse({
    format: "nur-quran-dataset/1",
    version: "t1",
    source: { name: "Fixture", license: "TEST-ONLY" },
    surahs: [
      { number: 1, nameArabic: "ا", nameLatin: "Satu", revelationType: "MAKKIYAH", verses: [{ number: 1, textUthmani: "أ", page: 1, juz: 1 }, { number: 2, textUthmani: "ب", page: 1, juz: 1 }] },
      { number: 2, nameArabic: "ب", nameLatin: "Dua", revelationType: "MADANIYAH", verses: [{ number: 1, textUthmani: "ج", page: 2, juz: 1 }] },
    ],
    juzs: [{ number: 1, startSurah: 1, startVerse: 1, endSurah: 2, endVerse: 1 }],
    translations: [{ name: "T", language: "id", version: "1", source: { name: "S", license: "LIC-TEST" }, items: [{ surah: 1, verse: 1, text: "a" }, { surah: 1, verse: 2, text: "b" }, { surah: 2, verse: 1, text: "c" }] }],
  });

describe("validator dataset Al-Qur'an", () => {
  it("standar mushaf: 114 surah, 6.236 ayat, 30 juz", () => {
    assert.deepEqual(STANDARD, { surahs: 114, verses: 6236, juzs: 30 });
  });

  it("dataset parsial yang konsisten lolos hanya dengan --partial", () => {
    assert.deepEqual(validateDataset(base(), { partial: true }), []);
    const strict = validateDataset(base());
    assert.ok(strict.some((e) => e.includes("Jumlah surah 2")));
    assert.ok(strict.some((e) => e.includes("Jumlah ayat 3")));
  });

  it("mendeteksi nomor ayat duplikat atau melompat", () => {
    const d = base();
    d.surahs[0]?.verses.push({ number: 2, textUthmani: "x", page: 1, juz: 1 });
    assert.ok(validateDataset(d, { partial: true }).some((e) => e.includes("tidak berurutan")));
    const gap = base();
    if (gap.surahs[0]) gap.surahs[0].verses = [{ number: 1, textUthmani: "a", page: 1, juz: 1 }, { number: 3, textUthmani: "c", page: 1, juz: 1 }];
    assert.ok(validateDataset(gap, { partial: true }).some((e) => e.includes("tidak berurutan")));
  });

  it("mendeteksi halaman/juz yang mundur dan batas juz ke ayat yang tidak ada", () => {
    const d = base();
    if (d.surahs[1]?.verses[0]) d.surahs[1].verses[0].page = 1;
    if (d.surahs[0]?.verses[1]) d.surahs[0].verses[1].page = 5;
    assert.ok(validateDataset(d, { partial: true }).some((e) => e.includes("halaman mundur")));
    const j = base();
    if (j.juzs[0]) j.juzs[0].endVerse = 99;
    assert.ok(validateDataset(j, { partial: true }).some((e) => e.includes("Juz 1")));
  });

  it("terjemahan tidak boleh mengacu ke ayat tak dikenal, duplikat, atau tidak lengkap", () => {
    const orphan = base();
    orphan.translations[0]?.items.push({ surah: 9, verse: 9, text: "x" });
    assert.ok(validateDataset(orphan, { partial: true }).some((e) => e.includes("9:9 tidak ada")));
    const dup = base();
    dup.translations[0]?.items.push({ surah: 1, verse: 1, text: "lagi" });
    assert.ok(validateDataset(dup, { partial: true }).some((e) => e.includes("duplikat")));
    const incomplete = base();
    incomplete.translations[0]?.items.pop();
    assert.deepEqual(validateDataset(incomplete, { partial: true }), []);
  });

  it("lisensi sumber wajib ada", () => {
    assert.equal(datasetSchema.safeParse({ ...base(), source: { name: "X" } }).success, false);
  });
});

describe("normalisasi Arab", () => {
  it("menghapus harakat dan tanda baca Qur'an, menyamakan alif dan ya", () => {
    assert.equal(normalizeArabic("كِتَابٌ مُبَارَكٌ"), "كتاب مبارك");
    assert.equal(normalizeArabic("أَإِآ ٱ"), "ااا ا");
    assert.equal(normalizeArabic("هُدًى"), "هدي");
    assert.equal(normalizeArabic("  ا   ب  "), "ا ب");
  });
});

describe("konfigurasi", () => {
  const ok = { DATABASE_URL: "postgresql://x", JWT_SECRET: "x".repeat(40) };

  it("menolak JWT_SECRET pendek dan DATABASE_URL kosong", () => {
    assert.throws(() => loadConfig({ ...ok, JWT_SECRET: "pendek" }), /JWT_SECRET/);
    assert.throws(() => loadConfig({ JWT_SECRET: ok.JWT_SECRET }), /DATABASE_URL/);
  });

  it("produksi mewajibkan SMTP, secret non-contoh, dan cookie Secure", () => {
    assert.throws(() => loadConfig({ ...ok, NODE_ENV: "production" }), /MAIL_TRANSPORT/);
    assert.throws(() => loadConfig({ ...ok, NODE_ENV: "production", MAIL_TRANSPORT: "smtp" }), /SMTP_URL/);
    assert.throws(() => loadConfig({ ...ok, NODE_ENV: "production", MAIL_TRANSPORT: "smtp", SMTP_URL: "smtp://x", JWT_SECRET: "ganti-dengan-secret-acak-minimal-32-karakter" }), /contoh/);
    const prod = loadConfig({ ...ok, NODE_ENV: "production", MAIL_TRANSPORT: "smtp", SMTP_URL: "smtp://x" });
    assert.equal(prod.cookieSecure, true);
    assert.equal(loadConfig({ ...ok, NODE_ENV: "development" }).cookieSecure, false);
  });
});
