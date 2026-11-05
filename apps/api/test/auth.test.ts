process.env.AUTH_RATE_LIMIT = "1000";
process.env.GLOBAL_RATE_LIMIT = "100000";

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import request from "supertest";
import { memoryOutbox } from "../src/common/mailer";
import { api, boot, cookieValue, login, makeUser, PASSWORD, post, reset, shutdown, type Ctx } from "./helpers";

let ctx: Ctx;
before(async () => {
  ctx = await boot();
});
after(async () => shutdown(ctx));
beforeEach(async () => {
  await reset(ctx.prisma);
  memoryOutbox.length = 0;
});

const tokenFrom = (text: string): string => /token=([\w-]+)/.exec(text)?.[1] ?? "";

describe("registrasi & verifikasi email", () => {
  it("mendaftar, tidak bisa login sebelum verifikasi, lalu bisa login setelah verifikasi", async () => {
    const reg = await request(ctx.http).post(api("/auth/register")).send({ name: "Hamba Allah", email: "Baru@Contoh.ID", password: PASSWORD });
    assert.equal(reg.status, 201);
    assert.equal(reg.body.data.email, "baru@contoh.id");
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: "baru@contoh.id" } });
    assert.match(user.passwordHash, /^\$argon2id\$/);
    assert.equal(user.role, "USER");

    const blocked = await request(ctx.http).post(api("/auth/login")).send({ email: "baru@contoh.id", password: PASSWORD });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, "EMAIL_NOT_VERIFIED");

    assert.equal(memoryOutbox.length, 1);
    const token = tokenFrom(memoryOutbox[0]?.text ?? "");
    assert.ok(token.length > 20);
    const stored = await ctx.prisma.userToken.findFirstOrThrow({ where: { userId: user.id } });
    assert.notEqual(stored.tokenHash, token, "token mentah tidak boleh disimpan");

    assert.equal((await request(ctx.http).post(api("/auth/verify-email")).send({ token })).status, 204);
    assert.equal((await request(ctx.http).post(api("/auth/verify-email")).send({ token })).status, 400, "token sekali pakai");
    assert.equal((await request(ctx.http).post(api("/auth/login")).send({ email: "baru@contoh.id", password: PASSWORD })).status, 200);
  });

  it("pendaftaran email yang sudah ada tidak membocorkan keberadaan akun", async () => {
    await makeUser(ctx.prisma, { email: "ada@contoh.id" });
    const res = await request(ctx.http).post(api("/auth/register")).send({ name: "Penyusup", email: "ada@contoh.id", password: PASSWORD });
    assert.equal(res.status, 201);
    assert.equal(await ctx.prisma.user.count(), 1);
    assert.match(memoryOutbox[0]?.text ?? "", /sudah ada/);
  });

  it("menolak input tidak valid dengan envelope VALIDATION_ERROR", async () => {
    const res = await request(ctx.http).post(api("/auth/register")).send({ name: "A", email: "bukan-email", password: "pendek" });
    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
    assert.ok(Array.isArray(res.body.error.details) && res.body.error.details.length >= 3);
  });
});

describe("login & sesi", () => {
  it("cookie sesi HttpOnly; refresh token Strict dan terbatas pada /auth", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const res = await request(ctx.http).post(api("/auth/login")).send({ email: "a@contoh.id", password: PASSWORD });
    assert.equal(res.status, 200);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    const at = cookies.find((c) => c.startsWith("nur_at="));
    const rt = cookies.find((c) => c.startsWith("nur_rt="));
    const csrf = cookies.find((c) => c.startsWith("nur_csrf="));
    assert.match(at ?? "", /HttpOnly/);
    assert.match(rt ?? "", /HttpOnly/);
    assert.match(rt ?? "", /SameSite=Strict/);
    assert.match(rt ?? "", /Path=\/api\/v1\/auth/);
    assert.doesNotMatch(csrf ?? "", /HttpOnly/);
    assert.equal(res.body.data.passwordHash, undefined);
    assert.equal(res.body.data.role, "USER");
  });

  it("kredensial salah dan email tidak dikenal menghasilkan respons yang sama", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const wrong = await request(ctx.http).post(api("/auth/login")).send({ email: "a@contoh.id", password: "SalahTotal123" });
    const unknown = await request(ctx.http).post(api("/auth/login")).send({ email: "tidak@ada.id", password: "SalahTotal123" });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, unknown.body);
  });

  it("akun nonaktif tidak dapat masuk", async () => {
    await makeUser(ctx.prisma, { email: "off@contoh.id", active: false });
    const res = await request(ctx.http).post(api("/auth/login")).send({ email: "off@contoh.id", password: PASSWORD });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, "ACCOUNT_DISABLED");
  });

  it("endpoint terlindungi memerlukan sesi", async () => {
    assert.equal((await request(ctx.http).get(api("/users/me"))).status, 401);
    assert.equal((await request(ctx.http).get(api("/sync/pull"))).status, 401);
  });

  it("refresh merotasi token: token lama ditandai terpakai dan menunjuk penggantinya", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const s = await login(ctx.http, "a@contoh.id");
    const refreshed = await s.agent.post(api("/auth/refresh"));
    assert.equal(refreshed.status, 204);
    assert.ok(cookieValue(refreshed.headers["set-cookie"], "nur_rt"));
    assert.equal((await s.agent.get(api("/users/me"))).status, 200);
    const tokens = await ctx.prisma.refreshToken.findMany({ orderBy: { createdAt: "asc" } });
    assert.equal(tokens.length, 2);
    assert.ok(tokens[0]?.usedAt && tokens[0].replacedById === tokens[1]?.id);
    assert.equal(tokens[1]?.usedAt, null);
  });

  it("refresh token yang sudah dipakai ditolak dan sesinya dicabut", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const res = await request(ctx.http).post(api("/auth/login")).send({ email: "a@contoh.id", password: PASSWORD });
    const original = cookieValue(res.headers["set-cookie"], "nur_rt") ?? "";
    const ok = await request(ctx.http).post(api("/auth/refresh")).set("Cookie", `nur_rt=${original}`);
    assert.equal(ok.status, 204);
    const reuse = await request(ctx.http).post(api("/auth/refresh")).set("Cookie", `nur_rt=${original}`);
    assert.equal(reuse.status, 401);
    const session = await ctx.prisma.authSession.findFirstOrThrow();
    assert.equal(session.revokeReason, "REFRESH_REUSE");
    // Token pengganti yang sah kini juga tidak berlaku.
    const legit = cookieValue(ok.headers["set-cookie"], "nur_rt") ?? "";
    assert.equal((await request(ctx.http).post(api("/auth/refresh")).set("Cookie", `nur_rt=${legit}`)).status, 401);
  });

  it("logout mencabut sesi di server (token akses lama tidak lagi berlaku)", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const s = await login(ctx.http, "a@contoh.id");
    const access = (await ctx.prisma.authSession.findFirstOrThrow()).id;
    assert.ok(access);
    assert.equal((await post(s, "/auth/logout")).status, 204);
    assert.equal((await s.agent.get(api("/users/me"))).status, 401);
    assert.equal((await ctx.prisma.authSession.findFirstOrThrow()).revokeReason, "LOGOUT");
  });

  it("daftar & cabut sesi perangkat; tidak dapat mencabut sesi milik pengguna lain", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    await makeUser(ctx.prisma, { email: "b@contoh.id" });
    const a1 = await login(ctx.http, "a@contoh.id");
    const a2 = await login(ctx.http, "a@contoh.id");
    const b = await login(ctx.http, "b@contoh.id");
    const list = await a1.agent.get(api("/users/me/sessions"));
    assert.equal(list.body.data.length, 2);
    assert.equal(list.body.data.filter((x: { current: boolean }) => x.current).length, 1);
    const other = list.body.data.find((x: { current: boolean }) => !x.current) as { id: string };

    const bSessions = (await b.agent.get(api("/users/me/sessions"))).body.data as { id: string }[];
    const foreign = await a1.agent.delete(api(`/users/me/sessions/${bSessions[0]?.id}`)).set("X-CSRF-Token", a1.csrf);
    assert.equal(foreign.status, 404);

    assert.equal((await a1.agent.delete(api(`/users/me/sessions/${other.id}`)).set("X-CSRF-Token", a1.csrf)).status, 204);
    assert.equal((await a2.agent.get(api("/users/me"))).status, 401);
    assert.equal((await a1.agent.get(api("/users/me"))).status, 200);
  });
});

describe("reset & ganti kata sandi", () => {
  it("reset kata sandi: token sekali pakai, mencabut sesi lama, kata sandi baru berlaku", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const old = await login(ctx.http, "a@contoh.id");
    const forgot = await request(ctx.http).post(api("/auth/forgot-password")).send({ email: "a@contoh.id" });
    assert.equal(forgot.status, 204);
    const unknown = await request(ctx.http).post(api("/auth/forgot-password")).send({ email: "tidak@ada.id" });
    assert.equal(unknown.status, 204, "respons sama untuk email tidak terdaftar");
    assert.equal(memoryOutbox.length, 1);

    const token = tokenFrom(memoryOutbox[0]?.text ?? "");
    const weak = await request(ctx.http).post(api("/auth/reset-password")).send({ token, password: "pendek" });
    assert.equal(weak.status, 400);
    assert.equal((await request(ctx.http).post(api("/auth/reset-password")).send({ token, password: "KataSandiBaru-99" })).status, 204);
    assert.equal((await request(ctx.http).post(api("/auth/reset-password")).send({ token, password: "KataSandiBaru-99" })).status, 400);

    assert.equal((await old.agent.get(api("/users/me"))).status, 401, "sesi lama dicabut");
    assert.equal((await request(ctx.http).post(api("/auth/login")).send({ email: "a@contoh.id", password: PASSWORD })).status, 401);
    assert.equal((await request(ctx.http).post(api("/auth/login")).send({ email: "a@contoh.id", password: "KataSandiBaru-99" })).status, 200);
  });

  it("ganti kata sandi memerlukan kata sandi lama dan mempertahankan sesi saat ini saja", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const here = await login(ctx.http, "a@contoh.id");
    const elsewhere = await login(ctx.http, "a@contoh.id");
    assert.equal((await post(here, "/users/me/password", { currentPassword: "SalahTotal123", newPassword: "KataSandiBaru-99" })).status, 400);
    assert.equal((await post(here, "/users/me/password", { currentPassword: PASSWORD, newPassword: "KataSandiBaru-99" })).status, 204);
    assert.equal((await here.agent.get(api("/users/me"))).status, 200);
    assert.equal((await elsewhere.agent.get(api("/users/me"))).status, 401);
  });
});

describe("keamanan lintas-endpoint", () => {
  it("CSRF: request yang mengubah data tanpa header ditolak", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const s = await login(ctx.http, "a@contoh.id");
    const noHeader = await s.agent.patch(api("/users/me")).send({ name: "Nama Baru" });
    assert.equal(noHeader.status, 403);
    assert.equal(noHeader.body.error.code, "CSRF_INVALID");
    const wrong = await s.agent.patch(api("/users/me")).set("X-CSRF-Token", "salah").send({ name: "Nama Baru" });
    assert.equal(wrong.status, 403);
    const ok = await s.agent.patch(api("/users/me")).set("X-CSRF-Token", s.csrf).send({ name: "Nama Baru" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.name, "Nama Baru");
  });

  it("RBAC: pengguna biasa ditolak di endpoint admin", async () => {
    await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const s = await login(ctx.http, "a@contoh.id");
    for (const path of ["/admin/overview", "/admin/users", "/admin/audit-logs", "/admin/datasets"]) {
      const res = await s.agent.get(api(path));
      assert.equal(res.status, 403, path);
      assert.equal(res.body.error.code, "FORBIDDEN");
    }
  });

  it("perubahan peran berlaku seketika tanpa login ulang (peran dibaca dari database)", async () => {
    const user = await makeUser(ctx.prisma, { email: "a@contoh.id" });
    const s = await login(ctx.http, "a@contoh.id");
    assert.equal((await s.agent.get(api("/admin/overview"))).status, 403);
    await ctx.prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    assert.equal((await s.agent.get(api("/admin/overview"))).status, 200);
  });

  it("header keamanan dan envelope error 404", async () => {
    const res = await request(ctx.http).get(api("/tidak-ada"));
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.headers["x-powered-by"], undefined);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    const health = await request(ctx.http).get(api("/health"));
    assert.equal(health.body.data.status, "ok");
  });

  it("JSON rusak dan body terlalu besar menghasilkan envelope, bukan stack trace", async () => {
    const bad = await request(ctx.http).post(api("/auth/login")).set("Content-Type", "application/json").send("{bukan json");
    assert.equal(bad.status, 400);
    assert.equal(bad.body.success, false);
    const big = await request(ctx.http).post(api("/auth/login")).send({ email: "a@b.id", password: "x".repeat(2_000_000) });
    assert.equal(big.status, 413);
    assert.equal(big.body.error.code, "VALIDATION_ERROR");
  });
});
