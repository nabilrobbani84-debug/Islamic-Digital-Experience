process.env.AUTH_RATE_LIMIT = "5";
process.env.GLOBAL_RATE_LIMIT = "100000";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { api, boot, reset, shutdown, type Ctx } from "./helpers";

let ctx: Ctx;
before(async () => {
  ctx = await boot();
  await reset(ctx.prisma);
});
after(async () => shutdown(ctx));

describe("pembatasan laju", () => {
  it("endpoint autentikasi dibatasi per IP dan mengirim Retry-After", async () => {
    const statuses: number[] = [];
    let last = request(ctx.http).get(api("/health"));
    for (let i = 0; i < 8; i++) {
      last = request(ctx.http).post(api("/auth/login")).send({ email: "x@y.id", password: "SalahTotal123" });
      statuses.push((await last).status);
    }
    assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.ok(statuses.slice(5).every((s) => s === 429), `diterima: ${statuses.join(",")}`);
    const blocked = await request(ctx.http).post(api("/auth/login")).send({ email: "x@y.id", password: "SalahTotal123" });
    assert.equal(blocked.body.error.code, "RATE_LIMITED");
    assert.ok(Number(blocked.headers["retry-after"]) >= 1);
  });

  it("endpoint publik non-auth tidak terkena batas auth", async () => {
    assert.equal((await request(ctx.http).get(api("/quran/surahs"))).status, 200);
  });
});
