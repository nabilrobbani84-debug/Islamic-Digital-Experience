process.env.AUTH_RATE_LIMIT = "1000";
process.env.GLOBAL_RATE_LIMIT = "100000";

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import request from "supertest";
import { api, boot, del, login, makeUser, patch, post, reset, shutdown, type Ctx, type Session } from "./helpers";

let ctx: Ctx;
let superAdmin: Session;
let admin: Session;
let user: Session;
let ids: { superAdmin: string; admin: string; user: string };

before(async () => {
  ctx = await boot();
});
after(async () => shutdown(ctx));
beforeEach(async () => {
  await reset(ctx.prisma);
  const s = await makeUser(ctx.prisma, { email: "super@contoh.id", role: "SUPER_ADMIN", name: "Super" });
  const a = await makeUser(ctx.prisma, { email: "admin@contoh.id", role: "ADMIN", name: "Admin" });
  const u = await makeUser(ctx.prisma, { email: "user@contoh.id", name: "Pengguna" });
  ids = { superAdmin: s.id, admin: a.id, user: u.id };
  superAdmin = await login(ctx.http, "super@contoh.id");
  admin = await login(ctx.http, "admin@contoh.id");
  user = await login(ctx.http, "user@contoh.id");
});

describe("pengguna & peran", () => {
  it("admin melihat ringkasan dan daftar pengguna tanpa hash kata sandi", async () => {
    const overview = await admin.agent.get(api("/admin/overview"));
    assert.equal(overview.status, 200);
    assert.equal(overview.body.data.users, 3);
    assert.equal(overview.body.data.activeSessions, 3);
    const users = await admin.agent.get(api("/admin/users"));
    assert.equal(users.body.data.length, 3);
    assert.ok(users.body.data.every((u: Record<string, unknown>) => !("passwordHash" in u)));
  });

  it("hanya Super Admin yang dapat mengubah peran; tidak dapat mengubah diri sendiri", async () => {
    assert.equal((await patch(admin, `/admin/users/${ids.user}`, { role: "ADMIN" })).status, 403);
    assert.equal((await patch(superAdmin, `/admin/users/${ids.superAdmin}`, { role: "USER" })).status, 400);
    const ok = await patch(superAdmin, `/admin/users/${ids.user}`, { role: "ADMIN" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.role, "ADMIN");
    const logs = await superAdmin.agent.get(api("/admin/audit-logs"));
    assert.deepEqual(logs.body.data.map((l: { action: string }) => l.action), ["USER_ROLE_CHANGED"]);
    assert.equal(logs.body.data[0].actorName, "Super");
    assert.equal((await patch(superAdmin, `/admin/users/${ids.user}`, { role: "SUPERUSER" })).status, 400);
    assert.equal((await patch(superAdmin, `/admin/users/${ids.user}`, {})).status, 400);
  });

  it("Admin tidak dapat mengelola sesama admin; menonaktifkan akun mencabut sesinya seketika", async () => {
    assert.equal((await patch(admin, `/admin/users/${ids.superAdmin}`, { isActive: false })).status, 403);
    assert.equal((await user.agent.get(api("/users/me"))).status, 200);
    assert.equal((await patch(admin, `/admin/users/${ids.user}`, { isActive: false })).status, 200);
    assert.equal((await user.agent.get(api("/users/me"))).status, 401);
    const relog = await request(ctx.http).post(api("/auth/login")).send({ email: "user@contoh.id", password: "Passw0rd-nur-test" });
    assert.equal(relog.body.error.code, "ACCOUNT_DISABLED");
    assert.equal((await patch(admin, `/admin/users/${ids.user}`, { isActive: true })).status, 200);
  });

  it("audit log append-only di tingkat database (UPDATE/DELETE ditolak trigger)", async () => {
    await patch(superAdmin, `/admin/users/${ids.user}`, { isActive: false });
    await assert.rejects(ctx.prisma.$executeRawUnsafe(`UPDATE admin_audit_logs SET action = 'dihapus'`), /append-only/);
    await assert.rejects(ctx.prisma.$executeRawUnsafe(`DELETE FROM admin_audit_logs`), /append-only/);
    assert.equal(await ctx.prisma.adminAuditLog.count(), 1);
  });
});

describe("persetujuan dataset", () => {
  it("dataset REVIEW → PUBLISHED oleh admin; versi lama diarsipkan; tidak dapat diterbitkan dua kali", async () => {
    const old = await ctx.prisma.datasetVersion.create({ data: { datasetName: "quran-text", version: "1", checksum: "a".repeat(64), status: "PUBLISHED", approvedById: ids.superAdmin, approvedAt: new Date() } });
    const next = await ctx.prisma.datasetVersion.create({ data: { datasetName: "quran-text", version: "2", checksum: "b".repeat(64), status: "REVIEW", recordCount: 10 } });
    assert.equal((await user.agent.post(api(`/admin/datasets/${next.id}/approve`)).set("X-CSRF-Token", user.csrf)).status, 403);
    const approved = await post(admin, `/admin/datasets/${next.id}/approve`);
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, "PUBLISHED");
    assert.notEqual(approved.body.data.approvedAt, null);
    assert.equal((await ctx.prisma.datasetVersion.findUniqueOrThrow({ where: { id: old.id } })).status, "ARCHIVED");
    assert.equal((await ctx.prisma.datasetVersion.findUniqueOrThrow({ where: { id: next.id } })).approvedById, ids.admin);
    assert.equal((await post(admin, `/admin/datasets/${next.id}/approve`)).status, 409);
    assert.equal((await post(admin, `/admin/datasets/${crypto.randomUUID()}/approve`)).status, 404);
    assert.ok((await admin.agent.get(api("/admin/audit-logs"))).body.data.some((l: { action: string }) => l.action === "DATASET_PUBLISHED"));
  });

  it("menyetujui dataset terjemahan menerbitkan edisinya", async () => {
    await ctx.prisma.quranEdition.create({ data: { name: "Terjemahan X", language: "id", version: "3", source: "Fixture", status: "REVIEW" } });
    const ds = await ctx.prisma.datasetVersion.create({ data: { datasetName: "quran-translation:Terjemahan X", version: "3", checksum: "e".repeat(64), status: "REVIEW" } });
    await post(admin, `/admin/datasets/${ds.id}/approve`);
    assert.equal((await ctx.prisma.quranEdition.findFirstOrThrow()).status, "PUBLISHED");
  });
});

describe("revisi konten (empat mata)", () => {
  const dua = { title: "Doa Uji", arabicText: "دعاء", transliteration: "du'a", translation: "[TEST] terjemahan", source: "Fixture Uji" };

  it("penulis tidak dapat menyetujui revisinya; reviewer lain menerbitkan dan konten langsung tampil", async () => {
    const created = await post(admin, "/admin/revisions", { entityType: "DAILY_DUA", entityId: null, action: "CREATE", payload: dua });
    assert.equal(created.status, 201);
    assert.equal(created.body.data.status, "REVIEW");
    assert.equal(created.body.data.authorName, "Admin");
    const id = created.body.data.id as string;

    assert.deepEqual((await request(ctx.http).get(api("/duas"))).body.data, [], "belum terbit sebelum disetujui");
    const self = await post(admin, `/admin/revisions/${id}/review`, { decision: "APPROVE" });
    assert.equal(self.status, 400);
    assert.match(self.body.error.message, /berbeda/);

    const approved = await post(superAdmin, `/admin/revisions/${id}/review`, { decision: "APPROVE", note: "Sumber sesuai" });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.status, "PUBLISHED");
    assert.equal(approved.body.data.reviewerName, "Super");
    const duas = (await request(ctx.http).get(api("/duas"))).body.data;
    assert.equal(duas.length, 1);
    assert.equal(duas[0].source, "Fixture Uji");
    assert.equal((await post(superAdmin, `/admin/revisions/${id}/review`, { decision: "APPROVE" })).status, 409);
    const actions = (await superAdmin.agent.get(api("/admin/audit-logs"))).body.data.map((l: { action: string }) => l.action);
    assert.ok(actions.includes("REVISION_SUBMITTED") && actions.includes("REVISION_PUBLISHED"));
  });

  it("revisi ditolak tidak mengubah konten dan kembali ke draft", async () => {
    const created = await post(admin, "/admin/revisions", { entityType: "DAILY_DUA", entityId: null, action: "CREATE", payload: dua });
    const rejected = await post(superAdmin, `/admin/revisions/${created.body.data.id}/review`, { decision: "REJECT", note: "Sumber kurang" });
    assert.equal(rejected.body.data.status, "DRAFT");
    assert.equal(await ctx.prisma.dailyDua.count(), 0);
  });

  it("update dan arsip (DELETE) konten yang ada", async () => {
    const existing = await ctx.prisma.dailyDua.create({ data: { ...dua, status: "PUBLISHED" } });
    const upd = await post(admin, "/admin/revisions", { entityType: "DAILY_DUA", entityId: existing.id, action: "UPDATE", payload: { ...dua, translation: "[TEST] diperbarui" } });
    await post(superAdmin, `/admin/revisions/${upd.body.data.id}/review`, { decision: "APPROVE" });
    assert.equal((await ctx.prisma.dailyDua.findUniqueOrThrow({ where: { id: existing.id } })).translation, "[TEST] diperbarui");
    const arch = await post(admin, "/admin/revisions", { entityType: "DAILY_DUA", entityId: existing.id, action: "DELETE", payload: {} });
    await post(superAdmin, `/admin/revisions/${arch.body.data.id}/review`, { decision: "APPROVE" });
    assert.equal((await ctx.prisma.dailyDua.findUniqueOrThrow({ where: { id: existing.id } })).status, "ARCHIVED");
    assert.deepEqual((await request(ctx.http).get(api("/duas"))).body.data, []);
  });

  it("menolak sumber kosong dan jenis konten yang belum didukung (tidak diterbitkan tanpa efek)", async () => {
    const noSource = await post(admin, "/admin/revisions", { entityType: "DAILY_DUA", entityId: null, action: "CREATE", payload: { ...dua, source: "" } });
    assert.equal(noSource.status, 400);
    const unsupported = await post(admin, "/admin/revisions", { entityType: "VERSE_TRANSLATION", entityId: null, action: "CREATE", payload: {} });
    assert.equal(unsupported.status, 422);
    assert.equal(unsupported.body.error.code, "NOT_SUPPORTED");
    assert.equal((await post(admin, "/admin/revisions", { entityType: "DAILY_DUA", entityId: null, action: "UPDATE", payload: dua })).status, 400, "UPDATE wajib entityId");
    assert.equal(await ctx.prisma.contentRevision.count(), 0);
  });

  it("basis data menolak reviewer yang sama dengan penulis walau aplikasi dilewati", async () => {
    await assert.rejects(
      ctx.prisma.contentRevision.create({ data: { entityType: "DAILY_DUA", action: "CREATE", payload: {}, status: "REVIEW", authorId: ids.admin, reviewerId: ids.admin } }),
    );
  });
});

describe("status sinkronisasi & sumber", () => {
  it("ringkasan sinkronisasi dan daftar sumber konten", async () => {
    await ctx.prisma.contentSource.create({ data: { name: "Sumber Uji", license: "CC-BY", licenseVerifiedAt: new Date() } });
    const status = await admin.agent.get(api("/admin/sync-status"));
    assert.deepEqual(status.body.data, { changesLast24h: 0, conflictsLast24h: 0, rejectedLast24h: 0, lastChangeAt: null });
    const sources = await admin.agent.get(api("/admin/content-sources"));
    assert.equal(sources.body.data[0].name, "Sumber Uji");
    assert.notEqual(sources.body.data[0].licenseVerifiedAt, null);
    assert.equal((await del(user, `/users/me/sessions/${crypto.randomUUID()}`)).status, 404);
  });
});
