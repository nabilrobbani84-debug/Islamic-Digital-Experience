process.env.AUTH_RATE_LIMIT = "1000";
process.env.GLOBAL_RATE_LIMIT = "100000";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import request from "supertest";
import { api, boot, login, makeUser, post, reset, seedQuranFixture, shutdown, type Ctx, type Session } from "./helpers";

let ctx: Ctx;
let a1: Session; // pengguna A, perangkat 1
let a2: Session; // pengguna A, perangkat 2
let b: Session; // pengguna B

before(async () => {
  ctx = await boot();
});
after(async () => shutdown(ctx));
beforeEach(async () => {
  await reset(ctx.prisma);
  const admin = await makeUser(ctx.prisma, { email: "admin@contoh.id", role: "SUPER_ADMIN" });
  await seedQuranFixture(ctx.prisma, admin.id);
  await makeUser(ctx.prisma, { email: "a@contoh.id" });
  await makeUser(ctx.prisma, { email: "b@contoh.id" });
  a1 = await login(ctx.http, "a@contoh.id");
  a2 = await login(ctx.http, "a@contoh.id");
  b = await login(ctx.http, "b@contoh.id");
});

interface Change {
  entityType: string;
  entityId: string;
  operation: "UPSERT" | "DELETE";
  payload: Record<string, unknown>;
  baseVersion: number | null;
  idempotencyKey?: string;
}
const change = (c: Change) => ({ idempotencyKey: randomUUID(), clientCreatedAt: new Date().toISOString(), ...c });
const push = async (s: Session, ...changes: Change[]) => {
  const res = await post(s, "/sync/push", { changes: changes.map(change) });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data as { status: string; resultVersion: number | null; reason: string | null; serverRecord: Record<string, unknown> | null; idempotencyKey: string }[];
};
const pull = async (s: Session, cursor = "0") => (await s.agent.get(api(`/sync/pull?cursor=${cursor}`))).body.data as { cursor: string; hasMore: boolean; changes: { entityType: string; entityId: string; operation: string; payload: Record<string, unknown>; version: number }[] };
const bookmark = (note: string | null, baseVersion: number | null): Change => ({ entityType: "BOOKMARK", entityId: "1:2", operation: "UPSERT", payload: { surahNumber: 1, verseNumber: 2, note }, baseVersion });

describe("idempotensi & pengiriman antar-perangkat", () => {
  it("perubahan yang sama dikirim ulang (retry jaringan) tidak diterapkan dua kali", async () => {
    const key = randomUUID();
    const c = { ...change(bookmark(null, null)), idempotencyKey: key };
    const first = await post(a1, "/sync/push", { changes: [c] });
    const replay = await post(a1, "/sync/push", { changes: [c] });
    assert.equal(first.body.data[0].status, "APPLIED");
    assert.deepEqual(replay.body.data[0], { idempotencyKey: key, status: "APPLIED", resultVersion: 1, serverRecord: null, reason: null });
    assert.equal(await ctx.prisma.syncChange.count(), 1);
    assert.equal(await ctx.prisma.bookmark.count(), 1);
  });

  it("perangkat lain menerima perubahan; perangkat asal tidak menerima gema; pengguna lain tidak melihat apa pun", async () => {
    await push(a1, bookmark("catatan", null));
    const other = await pull(a2);
    assert.equal(other.changes.length, 1);
    assert.equal(other.changes[0]?.entityType, "BOOKMARK");
    assert.equal(other.changes[0]?.entityId, "1:2");
    assert.equal(other.changes[0]?.payload.note, "catatan");
    assert.equal(other.changes[0]?.version, 1);

    const own = await pull(a1);
    assert.equal(own.changes.length, 0);
    assert.equal(own.cursor, other.cursor, "kursor maju melewati perubahan milik sendiri");

    assert.equal((await pull(b)).changes.length, 0, "isolasi antar pengguna");
    assert.equal((await pull(a2, other.cursor)).changes.length, 0, "tidak ada pengiriman ulang setelah kursor");
  });

  it("push memerlukan sesi dan token CSRF; batch dibatasi", async () => {
    assert.equal((await request(ctx.http).post(api("/sync/push")).send({ changes: [change(bookmark(null, null))] })).status, 401);
    const noCsrf = await a1.agent.post(api("/sync/push")).send({ changes: [change(bookmark(null, null))] });
    assert.equal(noCsrf.status, 403);
    assert.equal((await post(a1, "/sync/push", { changes: [] })).status, 400);
    assert.equal((await post(a1, "/sync/push", { changes: Array.from({ length: 101 }, () => change(bookmark(null, null))) })).status, 400);
  });
});

describe("aturan konflik per jenis data", () => {
  it("bookmark: catatan yang diubah di perangkat lain tidak tertimpa diam-diam (CONFLICT)", async () => {
    assert.equal((await push(a1, bookmark(null, null)))[0]?.resultVersion, 1);
    const fromB = await push(a2, bookmark("catatan dari perangkat 2", 1));
    assert.equal(fromB[0]?.status, "APPLIED");
    assert.equal(fromB[0]?.resultVersion, 2);

    const stale = await push(a1, bookmark("catatan dari perangkat 1", 1));
    assert.equal(stale[0]?.status, "CONFLICT");
    assert.equal(stale[0]?.reason, "VERSION_MISMATCH");
    assert.equal(stale[0]?.resultVersion, 2);
    assert.equal(stale[0]?.serverRecord?.note, "catatan dari perangkat 2");
    assert.equal((await ctx.prisma.bookmark.findFirstOrThrow()).note, "catatan dari perangkat 2", "data server tetap utuh");

    const resolved = await push(a1, bookmark("catatan dari perangkat 1", 2));
    assert.equal(resolved[0]?.status, "APPLIED");
    assert.equal(resolved[0]?.resultVersion, 3);
  });

  it("bookmark: hapus lalu tandai ulang; ayat yang tidak ada ditolak", async () => {
    await push(a1, bookmark(null, null));
    const del = await push(a1, { ...bookmark(null, 1), operation: "DELETE" });
    assert.equal(del[0]?.status, "APPLIED");
    assert.equal((await ctx.prisma.bookmark.findFirstOrThrow()).deletedAt !== null, true, "soft delete");
    const pulled = await pull(a2);
    assert.deepEqual(pulled.changes.map((c) => c.operation), ["UPSERT", "DELETE"]);
    const revived = await push(a1, bookmark(null, null));
    assert.equal(revived[0]?.status, "APPLIED");
    assert.equal(await ctx.prisma.bookmark.count(), 1, "tidak ada baris ganda");

    const missing = await push(a1, { entityType: "BOOKMARK", entityId: "1:99", operation: "UPSERT", payload: { surahNumber: 1, verseNumber: 99 }, baseVersion: null });
    assert.equal(missing[0]?.status, "REJECTED");
    assert.equal(missing[0]?.reason, "VERSE_NOT_FOUND");
    const badId = await push(a1, { entityType: "BOOKMARK", entityId: "bukan-kunci", operation: "UPSERT", payload: { surahNumber: 1, verseNumber: 1 }, baseVersion: null });
    assert.equal(badId[0]?.reason, "INVALID_ENTITY_ID");
  });

  it("progres bacaan: posisi terbaru menang berdasarkan waktu posisi, bukan urutan tiba", async () => {
    const t = (offsetMs: number) => new Date(Date.now() - offsetMs).toISOString();
    const progress = (surahNumber: number, verseNumber: number, updatedAt: string): Change => ({ entityType: "READING_PROGRESS", entityId: "last-read", operation: "UPSERT", payload: { surahNumber, verseNumber, updatedAt }, baseVersion: null });

    // Perangkat 2 membaca surah 1 ayat 3 (lebih baru) dan mengirim lebih dulu.
    assert.equal((await push(a2, progress(1, 3, t(1_000))))[0]?.status, "APPLIED");
    // Perangkat 1 offline: membaca surah 2 ayat 1 lebih lama, tiba belakangan.
    const late = await push(a1, progress(2, 1, t(60_000)));
    assert.equal(late[0]?.status, "APPLIED", "klien menghapusnya dari antrean tanpa konflik");

    assert.equal(await ctx.prisma.readingProgress.count(), 2, "posisi per surah tetap tersimpan");
    const delivered = (await pull(b)).changes.length;
    assert.equal(delivered, 0);
    const viaA2 = await pull(a2);
    assert.equal(viaA2.changes.length, 0, "perangkat 2 tidak menerima posisi lama dari perangkat 1");
    const stateForNewDevice = await pull(await login(ctx.http, "a@contoh.id"));
    assert.equal(stateForNewDevice.changes.length, 1);
    assert.equal(stateForNewDevice.changes[0]?.payload.surahNumber, 1);
    assert.equal(stateForNewDevice.changes[0]?.payload.verseNumber, 3);
  });

  it("progres bacaan: jam perangkat di masa depan tidak mengalahkan posisi sah berikutnya", async () => {
    const future = new Date(Date.now() + 365 * 86_400_000).toISOString();
    await push(a1, { entityType: "READING_PROGRESS", entityId: "last-read", operation: "UPSERT", payload: { surahNumber: 1, verseNumber: 1, updatedAt: future }, baseVersion: null });
    const row = await ctx.prisma.readingProgress.findFirstOrThrow();
    assert.ok(row.positionAt.getTime() <= Date.now() + 1000);
  });

  it("sesi dzikir: hitungan hanya naik saat digabung dari dua perangkat", async () => {
    const id = randomUUID();
    const session = (count: number): Change => ({ entityType: "DHIKR_SESSION", entityId: id, operation: "UPSERT", payload: { dhikrItemId: null, label: "Hitungan bebas", count, targetCount: 33, startedAt: new Date().toISOString(), completedAt: null }, baseVersion: null });
    assert.equal((await push(a1, session(20)))[0]?.status, "APPLIED");
    assert.equal((await push(a2, session(5)))[0]?.status, "APPLIED");
    assert.equal((await ctx.prisma.dhikrSession.findUniqueOrThrow({ where: { id } })).count, 20);
    assert.equal((await push(a2, session(33)))[0]?.status, "APPLIED");
    assert.equal((await ctx.prisma.dhikrSession.findUniqueOrThrow({ where: { id } })).count, 33);
    const other = await push(b, session(1));
    assert.equal(other[0]?.reason, "ID_CONFLICT", "pengguna lain tidak dapat menimpa sesi milik pengguna A");
  });

  it("riwayat zakat: nominal desimal divalidasi ketat dan catatan tidak berubah setelah dibuat", async () => {
    const id = randomUUID();
    const rec = (payable: string): Change => ({ entityType: "ZAKAT_CALCULATION", entityId: id, operation: "UPSERT", payload: { type: "SAVINGS", totalAssets: "150000000", deductibleDebt: "10000000", netAssets: "140000000", nisabValue: "110500000", payableAmount: payable, eligible: true, currency: "IDR", ruleVersion: "nur-zakat-1.0.0", calculatedAt: new Date().toISOString() }, baseVersion: null });
    const bad = await push(a1, rec("1e5"));
    assert.equal(bad[0]?.status, "REJECTED");
    assert.match(bad[0]?.reason ?? "", /^INVALID_PAYLOAD/);
    assert.equal((await push(a1, rec("3500000")))[0]?.status, "APPLIED");
    assert.equal((await push(a2, rec("999")))[0]?.status, "APPLIED");
    const row = await ctx.prisma.zakatCalculation.findUniqueOrThrow({ where: { id } });
    assert.equal(row.payableAmount.toString(), "3500000", "catatan yang sudah ada tidak ditimpa");
    assert.equal(row.ruleId, null);
    assert.equal((await push(a1, { entityType: "ZAKAT_CALCULATION", entityId: id, operation: "DELETE", payload: {}, baseVersion: 1 }))[0]?.status, "APPLIED");
    assert.ok((await ctx.prisma.zakatCalculation.findUniqueOrThrow({ where: { id } })).deletedAt);
  });

  it("favorit: konten divalidasi di backend karena tidak ada foreign key", async () => {
    await ctx.prisma.asmaulHusna.create({ data: { number: 1, arabicName: "اسم", transliteration: "Nama Uji", meaning: "[TEST]", status: "PUBLISHED" } });
    const fav = (contentType: string, contentId: string): Change => ({ entityType: "USER_FAVORITE", entityId: `${contentType}:${contentId}`, operation: "UPSERT", payload: { contentType, contentId }, baseVersion: null });
    assert.equal((await push(a1, fav("ASMAUL_HUSNA", "1")))[0]?.status, "APPLIED");
    const missing = await push(a1, fav("ASMAUL_HUSNA", "77"));
    assert.equal(missing[0]?.reason, "CONTENT_NOT_FOUND");
    assert.equal((await push(a1, fav("DAILY_DUA", randomUUID())))[0]?.reason, "CONTENT_NOT_FOUND");
    assert.equal((await push(a1, { ...fav("ASMAUL_HUSNA", "1"), operation: "DELETE" }))[0]?.status, "APPLIED");
    assert.equal((await ctx.prisma.userFavorite.findFirstOrThrow()).deletedAt !== null, true);
  });

  it("jenis entitas yang belum didukung ditolak secara eksplisit, bukan diabaikan", async () => {
    const res = await push(a1, { entityType: "PRAYER_LOCATION", entityId: randomUUID(), operation: "UPSERT", payload: {}, baseVersion: null });
    assert.equal(res[0]?.status, "REJECTED");
    assert.equal(res[0]?.reason, "UNSUPPORTED_ENTITY");
  });
});
