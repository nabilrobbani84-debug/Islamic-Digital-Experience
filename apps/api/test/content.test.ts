process.env.AUTH_RATE_LIMIT = "1000";
process.env.GLOBAL_RATE_LIMIT = "100000";

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import request from "supertest";
import { api, boot, makeUser, reset, seedQuranFixture, shutdown, type Ctx } from "./helpers";

let ctx: Ctx;
before(async () => {
  ctx = await boot();
});
after(async () => shutdown(ctx));
beforeEach(async () => reset(ctx.prisma));

const get = (path: string) => request(ctx.http).get(api(path));

describe("Al-Qur'an", () => {
  it("sebelum dataset diterbitkan: daftar kosong dan surah 404 (tidak ada data palsu)", async () => {
    const list = await get("/quran/surahs");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data, []);
    assert.equal((await get("/quran/surahs/1")).status, 404);
    assert.deepEqual((await get("/quran/search?q=kitab")).body.data, []);
  });

  it("dataset berstatus REVIEW tidak dilayani sampai disetujui", async () => {
    await ctx.prisma.surah.create({ data: { id: 1, number: 1, nameArabic: "x", nameLatin: "Draft", revelationType: "MAKKIYAH", totalVerses: 1 } });
    await ctx.prisma.datasetVersion.create({ data: { datasetName: "quran-text", version: "r1", checksum: "b".repeat(64), status: "REVIEW" } });
    assert.deepEqual((await get("/quran/surahs")).body.data, []);
  });

  it("melayani surah, ayat, terjemahan, dan metadata sumber setelah diterbitkan", async () => {
    const admin = await makeUser(ctx.prisma, { email: "a@contoh.id", role: "SUPER_ADMIN" });
    await seedQuranFixture(ctx.prisma, admin.id);

    const list = await get("/quran/surahs");
    assert.equal(list.body.data.length, 2);
    assert.equal(list.body.data[0].nameLatin, "Surah Uji");
    assert.equal(list.body.meta.datasetVersion, "test-1");
    assert.equal(list.body.meta.license, "TEST-ONLY");

    const detail = await get("/quran/surahs/1");
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.verses.length, 3);
    assert.equal(detail.body.data.verses[1].number, 2);
    assert.equal(detail.body.data.verses[1].textUthmani, "عِلْمٌ نَافِعٌ", "teks Arab beserta harakat tidak diubah");
    assert.match(detail.body.data.verses[0].translation, /^\[TEST\]/);
    assert.equal(detail.body.data.editionName, "Terjemahan Uji");
    assert.equal(typeof detail.body.data.verses[0].id, "string", "BigInt diserialisasi sebagai string");

    const juz = await get("/quran/juz/1");
    assert.deepEqual(juz.body.data, { number: 1, startSurah: 1, startVerse: 1, endSurah: 2, endVerse: 1 });
    assert.equal((await get("/quran/editions")).body.data.length, 1);
  });

  it("basmalah di awal ayat 1 ditunjukkan sebagai awalan, teks tetap verbatim; surah 1 dan 9 tanpa awalan", async () => {
    const admin = await makeUser(ctx.prisma, { email: "a@contoh.id", role: "SUPER_ADMIN" });
    await seedQuranFixture(ctx.prisma, admin.id);
    const opener = "كِتَابٌ مُبَارَكٌ"; // teks ayat 1:1 pada fixture
    await ctx.prisma.verse.updateMany({ where: { surahId: 2, verseNumber: 1 }, data: { textUthmani: `${opener} نُورٌ` } });
    await ctx.prisma.surah.create({ data: { id: 9, number: 9, nameArabic: "ط", nameLatin: "Surah Sembilan", revelationType: "MADANIYAH", totalVerses: 1 } });
    await ctx.prisma.verse.create({ data: { surahId: 9, verseNumber: 1, globalNumber: 99, textUthmani: `${opener} bukan-awalan`, textNormalized: "x", pageNumber: 3, juzNumber: 1 } });

    const two = (await get("/quran/surahs/2")).body.data;
    assert.equal(two.bismillahPrefix, opener);
    assert.equal(two.verses[0].textUthmani, `${opener} نُورٌ`, "API tidak mengubah teks");
    assert.equal((await get("/quran/surahs/1")).body.data.bismillahPrefix, null);
    assert.equal((await get("/quran/surahs/9")).body.data.bismillahPrefix, null, "surah 9 tidak memakai basmalah");
  });

  it("atribusi: tautan sumber teks (meta.sourceUrl) dan sumber terjemahan (editionSource) ikut dikirim", async () => {
    const admin = await makeUser(ctx.prisma, { email: "a@contoh.id", role: "SUPER_ADMIN" });
    const { edition } = await seedQuranFixture(ctx.prisma, admin.id);
    await ctx.prisma.contentSource.updateMany({ where: { name: "Fixture Test" }, data: { url: "https://example.org/teks" } });
    const tsource = await ctx.prisma.contentSource.create({ data: { name: "Penerjemah Uji", license: "CC-BY", url: "https://example.org/terjemahan" } });
    await ctx.prisma.quranEdition.update({ where: { id: edition.id }, data: { contentSourceId: tsource.id } });

    const body = (await get("/quran/surahs/1")).body;
    assert.equal(body.meta.sourceUrl, "https://example.org/teks");
    assert.deepEqual(body.data.editionSource, { name: "Penerjemah Uji", url: "https://example.org/terjemahan", license: "CC-BY" });
    assert.equal((await get("/quran/surahs")).body.meta.sourceUrl, "https://example.org/teks");
  });

  it("basmalah dengan penulisan harakat berbeda (mis. tasydid tambahan) tetap terdeteksi; awalan dikembalikan apa adanya", async () => {
    const admin = await makeUser(ctx.prisma, { email: "a@contoh.id", role: "SUPER_ADMIN" });
    await seedQuranFixture(ctx.prisma, admin.id);
    const variant = "كِتَّابٌ مُبَارَكٌ"; // tasydid tambahan; setelah normalisasi sama dengan ayat 1:1
    await ctx.prisma.surah.create({ data: { id: 3, number: 3, nameArabic: "ث", nameLatin: "Surah Ketiga", revelationType: "MAKKIYAH", totalVerses: 1 } });
    await ctx.prisma.verse.create({ data: { surahId: 3, verseNumber: 1, globalNumber: 98, textUthmani: `${variant} نُورٌ`, textNormalized: "x", pageNumber: 3, juzNumber: 1 } });

    const three = (await get("/quran/surahs/3")).body.data;
    assert.equal(three.bismillahPrefix, variant, "awalan literal dari ayat itu sendiri, bukan salinan ayat 1:1");
    assert.equal(three.verses[0].textUthmani, `${variant} نُورٌ`, "API tidak mengubah teks");
  });

  it("validasi parameter: surah di luar rentang, juz tidak valid, query pencarian pendek", async () => {
    assert.equal((await get("/quran/surahs/0")).status, 400);
    assert.equal((await get("/quran/surahs/115")).status, 400);
    assert.equal((await get("/quran/surahs/abc")).status, 400);
    assert.equal((await get("/quran/juz/31")).status, 400);
    assert.equal((await get("/quran/search?q=a")).status, 400);
    assert.equal((await get("/tafsir/verses/bukan-kunci")).status, 400);
  });

  it("pencarian: referensi surah:ayat, Arab tanpa harakat, dan terjemahan Indonesia (full-text)", async () => {
    const admin = await makeUser(ctx.prisma, { email: "a@contoh.id", role: "SUPER_ADMIN" });
    await seedQuranFixture(ctx.prisma, admin.id);

    const ref = await get("/quran/search?q=1:2");
    assert.equal(ref.body.data.length, 1);
    assert.equal(ref.body.data[0].verseNumber, 2);

    const arabic = await get(`/quran/search?q=${encodeURIComponent("كتاب")}`);
    assert.equal(arabic.body.data.length, 1, "pencarian tanpa harakat menemukan teks berharakat");
    assert.equal(arabic.body.data[0].surahName, "Surah Uji");

    const withMarks = await get(`/quran/search?q=${encodeURIComponent("نَافِعٌ")}`);
    assert.equal(withMarks.body.data.length, 1, "kueri berharakat dinormalisasi");

    const fts = await get("/quran/search?q=percobaan nomor 4");
    assert.ok(fts.body.data.length >= 1);
    assert.equal(fts.status, 200);

    const injection = await get(`/quran/search?q=${encodeURIComponent("'; DROP TABLE verses; --")}`);
    assert.equal(injection.status, 200);
    assert.equal(await ctx.prisma.verse.count(), 4, "kueri diparameterisasi");
    const wildcard = await get("/quran/search?q=%25%25");
    assert.equal(wildcard.status, 200);
  });

  it("tafsir hanya dari sumber PUBLISHED", async () => {
    const admin = await makeUser(ctx.prisma, { email: "a@contoh.id", role: "SUPER_ADMIN" });
    const { verses } = await seedQuranFixture(ctx.prisma, admin.id);
    const pub = await ctx.prisma.tafsirSource.create({ data: { name: "Tafsir Uji", author: "Penulis Uji", reference: "Ref-1", status: "PUBLISHED" } });
    const draft = await ctx.prisma.tafsirSource.create({ data: { name: "Tafsir Draft", author: "X", status: "DRAFT" } });
    const first = verses[0];
    assert.ok(first);
    await ctx.prisma.tafsirContent.create({ data: { verseId: first.id, sourceId: pub.id, content: "[TEST] isi tafsir" } });
    await ctx.prisma.tafsirContent.create({ data: { verseId: first.id, sourceId: draft.id, content: "[TEST] rahasia" } });
    const res = await get("/tafsir/verses/1:1");
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].sourceName, "Tafsir Uji");
    assert.equal(res.body.data[0].reference, "Ref-1");
    assert.deepEqual((await get("/tafsir/verses/1:3")).body.data, []);
  });

  it("audio: hanya qari PUBLISHED, URL ke /media, checksum dan segmen per ayat", async () => {
    const admin = await makeUser(ctx.prisma, { email: "a@contoh.id", role: "SUPER_ADMIN" });
    const { verses } = await seedQuranFixture(ctx.prisma, admin.id);
    const qari = await ctx.prisma.qari.create({ data: { name: "Qari Uji", country: "ID", status: "PUBLISHED" } });
    const hidden = await ctx.prisma.qari.create({ data: { name: "Qari Draft", status: "DRAFT" } });
    const asset = await ctx.prisma.audioAsset.create({ data: { qariId: qari.id, surahId: 1, filePath: "uji/001.mp3", fileFormat: "mp3", fileSize: 1234n, checksum: "c".repeat(64), durationMs: 9000 } });
    const first = verses[0];
    assert.ok(first);
    await ctx.prisma.audioSegment.create({ data: { audioAssetId: asset.id, verseId: first.id, startMs: 0, endMs: 3000 } });

    const qaris = await get("/audio/qaris");
    assert.deepEqual(qaris.body.data.map((q: { name: string }) => q.name), ["Qari Uji"]);
    const track = await get(`/audio/surah/1?qariId=${qari.id}`);
    assert.equal(track.status, 200);
    assert.equal(track.body.data.url, "/media/uji/001.mp3");
    assert.equal(track.body.data.checksum, "c".repeat(64));
    assert.deepEqual(track.body.data.segments, [{ verseNumber: 1, startMs: 0, endMs: 3000 }]);
    assert.equal((await get(`/audio/surah/2?qariId=${qari.id}`)).status, 404);
    assert.equal((await get(`/audio/surah/1?qariId=${hidden.id}`)).status, 404);
    assert.equal((await get("/audio/surah/1")).status, 400);
  });
});

describe("konten ibadah", () => {
  it("dzikir, doa, hadis, dan Asmaul Husna: hanya PUBLISHED, kosong bila belum ada dataset", async () => {
    for (const path of ["/dhikr", "/duas", "/hadith/nawawi", "/asmaul-husna"]) {
      const res = await get(path);
      assert.equal(res.status, 200, path);
    }
    assert.deepEqual((await get("/duas")).body.data, []);
    assert.deepEqual((await get("/hadith/nawawi")).body.data, []);

    const cat = await ctx.prisma.dhikrCategory.create({ data: { name: "Uji" } });
    await ctx.prisma.dhikrItem.create({ data: { categoryId: cat.id, arabicText: "ذكر", transliteration: "Dzikir Uji", translation: "[TEST]", recommendedCount: 33, source: "Fixture", status: "PUBLISHED" } });
    await ctx.prisma.dhikrItem.create({ data: { categoryId: cat.id, arabicText: "ذكر", transliteration: "Draft", translation: "[TEST]", status: "DRAFT" } });
    const dua = await ctx.prisma.dailyDua.create({ data: { title: "Doa Uji", arabicText: "دعاء", transliteration: "du'a", translation: "[TEST]", source: "Fixture", status: "PUBLISHED" } });
    const dcat = await ctx.prisma.duaCategory.create({ data: { name: "Pagi" } });
    await ctx.prisma.duaCategoryMap.create({ data: { duaId: dua.id, categoryId: dcat.id } });
    const coll = await ctx.prisma.hadithCollection.create({ data: { name: "Arba'in Nawawi (uji)", author: "Fixture", totalHadith: 1, status: "PUBLISHED" } });
    const had = await ctx.prisma.hadith.create({ data: { collectionId: coll.id, number: 1, arabicText: "حديث", translation: "[TEST]", reference: "Ref-uji" } });
    await ctx.prisma.hadithExplanation.create({ data: { hadithId: had.id, explanation: "[TEST] penjelasan", lessons: "[TEST] pelajaran" } });
    await ctx.prisma.asmaulHusna.create({ data: { number: 1, arabicName: "اسم", transliteration: "Nama Uji", meaning: "[TEST]", status: "PUBLISHED" } });
    await ctx.prisma.asmaulHusna.create({ data: { number: 2, arabicName: "اسم", transliteration: "Draft", meaning: "[TEST]", status: "DRAFT" } });

    const dhikr = (await get("/dhikr")).body.data;
    assert.equal(dhikr.items.length, 1);
    assert.equal(dhikr.items[0].transliteration, "Dzikir Uji");
    assert.deepEqual((await get("/duas")).body.data[0].categories, ["Pagi"]);
    const hadith = (await get("/hadith/nawawi")).body.data[0];
    assert.equal(hadith.number, 1);
    assert.equal(hadith.explanation, "[TEST] penjelasan");
    assert.equal(hadith.reference, "Ref-uji");
    assert.equal((await get("/asmaul-husna")).body.data.length, 1);
  });
});

describe("integritas database (migration SQL tambahan)", () => {
  it("CHECK constraint menolak halaman mushaf di luar 1–604 dan segmen audio terbalik", async () => {
    const admin = await makeUser(ctx.prisma, { email: "a@contoh.id", role: "SUPER_ADMIN" });
    await seedQuranFixture(ctx.prisma, admin.id);
    await assert.rejects(ctx.prisma.verse.create({ data: { surahId: 1, verseNumber: 9, globalNumber: 99, textUthmani: "x", textNormalized: "x", pageNumber: 700, juzNumber: 1 } }));
    await assert.rejects(ctx.prisma.verse.create({ data: { surahId: 1, verseNumber: 9, globalNumber: 99, textUthmani: "x", textNormalized: "x", pageNumber: 5, juzNumber: 31 } }));
  });

  it("dataset PUBLISHED tanpa persetujuan ditolak database", async () => {
    await assert.rejects(ctx.prisma.datasetVersion.create({ data: { datasetName: "x", version: "1", checksum: "d".repeat(64), status: "PUBLISHED" } }));
  });
});
