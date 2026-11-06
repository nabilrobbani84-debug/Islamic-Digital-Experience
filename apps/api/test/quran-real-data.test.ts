/**
 * Verifikasi pada DATA NYATA. Hanya berjalan di workflow "Quran source check" (QURAN_REAL_DATA=1) setelah
 * berkas Tanzil diunduh, dikonversi, dan diimpor ke database CI sementara. Dilewati pada CI biasa.
 */
process.env.AUTH_RATE_LIMIT = "1000";
process.env.GLOBAL_RATE_LIMIT = "100000";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { normalizeArabic } from "../src/common/arabic";
import { api, boot, login, post, shutdown, type Ctx, type Session } from "./helpers";

const enabled = process.env.QURAN_REAL_DATA === "1";

/** Parser sengaja ditulis ulang terpisah dari src/quran/tanzil.ts agar bug parser tidak lolos tanpa terdeteksi. */
function sourceLines(path: string): { s: number; a: number; t: string }[] {
  return readFileSync(path, "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .flatMap((line) => {
      const m = /^(\d+)\|(\d+)\|(.+)$/.exec(line);
      return m ? [{ s: Number(m[1]), a: Number(m[2]), t: m[3] as string }] : [];
    });
}

describe("Al-Qur'an data nyata (Tanzil) di PostgreSQL + API", { skip: !enabled }, () => {
  let ctx: Ctx;
  let admin: Session;
  const text = enabled ? sourceLines(process.env.TANZIL_TEXT ?? "") : [];
  const translation = enabled ? sourceLines(process.env.TANZIL_TRANSLATION ?? "") : [];

  before(async () => {
    ctx = await boot();
    admin = await login(ctx.http, process.env.SEED_ADMIN_EMAIL ?? "", process.env.SEED_ADMIN_PASSWORD ?? "");
  });
  after(async () => shutdown(ctx));

  it("berkas sumber lengkap: 6.236 ayat teks dan 6.236 terjemahan", () => {
    assert.equal(text.length, 6236);
    assert.equal(translation.length, 6236);
  });

  it("setiap ayat di database sama persis (karakter demi karakter) dengan berkas sumber", async () => {
    const rows = await ctx.prisma.verse.findMany({ select: { verseNumber: true, textUthmani: true, surah: { select: { number: true } } }, orderBy: { globalNumber: "asc" } });
    assert.equal(rows.length, text.length);
    const mismatches = rows.flatMap((r, i) => {
      const src = text[i];
      return src && r.surah.number === src.s && r.verseNumber === src.a && r.textUthmani === src.t ? [] : [`${r.surah.number}:${r.verseNumber}`];
    });
    assert.deepEqual(mismatches.slice(0, 10), [], `${mismatches.length} ayat berbeda dari sumber`);
  });

  it("setiap terjemahan di database sama persis dengan sumber dan menempel pada ayat yang benar", async () => {
    const rows = await ctx.prisma.verseTranslation.findMany({ select: { translationText: true, verse: { select: { verseNumber: true, globalNumber: true, surah: { select: { number: true } } } } }, orderBy: { verse: { globalNumber: "asc" } } });
    assert.equal(rows.length, translation.length);
    const mismatches = rows.flatMap((r, i) => {
      const src = translation[i];
      return src && r.verse.surah.number === src.s && r.verse.verseNumber === src.a && r.translationText === src.t ? [] : [`${r.verse.surah.number}:${r.verse.verseNumber}`];
    });
    assert.deepEqual(mismatches.slice(0, 10), [], `${mismatches.length} terjemahan berbeda dari sumber`);
  });

  it("struktur mushaf: 114 surah, 30 juz, 604 halaman, 60 hizb, penomoran tidak mundur", async () => {
    assert.equal(await ctx.prisma.surah.count(), 114);
    assert.equal(await ctx.prisma.juz.count(), 30);
    const verses = await ctx.prisma.verse.findMany({ select: { pageNumber: true, juzNumber: true, hizbNumber: true }, orderBy: { globalNumber: "asc" } });
    assert.equal(new Set(verses.map((v) => v.pageNumber)).size, 604);
    assert.equal(verses[0]?.pageNumber, 1);
    assert.equal(verses.at(-1)?.pageNumber, 604);
    assert.equal(Math.max(...verses.map((v) => v.juzNumber)), 30);
    assert.equal(Math.max(...verses.map((v) => v.hizbNumber ?? 0)), 60);
    assert.ok(verses.every((v, i) => i === 0 || (v.pageNumber >= (verses[i - 1]?.pageNumber ?? 0) && v.juzNumber >= (verses[i - 1]?.juzNumber ?? 0))));
    const perSurah = await ctx.prisma.surah.findMany({ select: { number: true, totalVerses: true, _count: { select: { verses: true } } } });
    assert.ok(perSurah.every((s) => s.totalVerses === s._count.verses), "jumlah ayat per surah konsisten");
  });

  it("dataset berstatus REVIEW tidak dilayani; setelah disetujui admin, API melayani seluruh data", async () => {
    assert.deepEqual((await request(ctx.http).get(api("/quran/surahs"))).body.data, []);
    const sets = (await admin.agent.get(api("/admin/datasets"))).body.data as { id: string; status: string }[];
    assert.ok(sets.length >= 2 && sets.every((d) => d.status === "REVIEW"));
    for (const d of sets) assert.equal((await post(admin, `/admin/datasets/${d.id}/approve`)).status, 200);

    const list = await request(ctx.http).get(api("/quran/surahs"));
    assert.equal(list.body.data.length, 114);
    assert.match(list.body.meta.license, /verbatim/);
    assert.match(list.body.meta.source, /Tanzil/);

    const surah2 = await request(ctx.http).get(api("/quran/surahs/2"));
    assert.equal(surah2.body.data.verses.length, 286);
    assert.equal(surah2.body.data.verses[254].textUthmani, text.find((l) => l.s === 2 && l.a === 255)?.t);
    assert.equal(surah2.body.data.verses[254].translation, translation.find((l) => l.s === 2 && l.a === 255)?.t);
    const last = await request(ctx.http).get(api("/quran/surahs/114"));
    assert.equal(last.body.data.verses.at(-1).number, 6);
    assert.deepEqual((await request(ctx.http).get(api("/quran/juz/30"))).body.data, { number: 30, startSurah: 78, startVerse: 1, endSurah: 114, endVerse: 6 });
    assert.deepEqual((await request(ctx.http).get(api("/quran/juz/1"))).body.data.startSurah, 1);
  });

  it("pencarian pada data nyata: referensi, Arab tanpa harakat, dan terjemahan Indonesia (full-text)", async () => {
    const ref = await request(ctx.http).get(api("/quran/search?q=2:255"));
    assert.equal(ref.body.data.length, 1);
    assert.equal(ref.body.data[0].textUthmani, text.find((l) => l.s === 2 && l.a === 255)?.t);

    // Frasa 4 kata diambil dari berkas sumber, dinormalisasi, lalu harus menemukan ayat asalnya.
    const phrase = normalizeArabic(text.find((l) => l.s === 2 && l.a === 255)?.t ?? "").split(" ").slice(0, 4).join(" ");
    const arabic = await request(ctx.http).get(api(`/quran/search?q=${encodeURIComponent(phrase)}`));
    assert.ok(arabic.body.data.some((r: { surahNumber: number; verseNumber: number }) => r.surahNumber === 2 && r.verseNumber === 255), `frasa "${phrase}" harus menemukan 2:255`);

    // Kata terpanjang dari terjemahan 1:2 (ayat awal, termasuk 30 hasil pertama) menguji FTS 'indonesian'.
    const word = (translation.find((l) => l.s === 1 && l.a === 2)?.t ?? "").replace(/[^\p{L}\s]/gu, "").split(/\s+/).sort((a, b) => b.length - a.length)[0] ?? "";
    assert.ok(word.length >= 5);
    const id = await request(ctx.http).get(api(`/quran/search?q=${encodeURIComponent(word)}`));
    assert.ok(id.body.data.some((r: { surahNumber: number; verseNumber: number }) => r.surahNumber === 1 && r.verseNumber === 2), `kata "${word}" harus menemukan 1:2`);
  });
});
