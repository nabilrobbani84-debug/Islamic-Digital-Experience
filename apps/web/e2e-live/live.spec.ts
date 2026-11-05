import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const OUTBOX = process.env.MAIL_OUTBOX_FILE ?? "/tmp/nur-outbox.jsonl";
const ADMIN = { email: "admin@live.nur", password: process.env.SEED_ADMIN_PASSWORD ?? "LiveAdmin-12345" };
const PASSWORD = "Rahasia-12345";

/** Console error yang diharapkan: 401 saat belum login (cek sesi) bukan bug. */
const consoleErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/status of 401/.test(text) || /WebGL|GPU stall|swiftshader|THREE\./i.test(text)) return;
    errors.push(text);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
};

async function emailToken(to: string, kind: "verify-email" | "reset-password"): Promise<string> {
  for (let i = 0; i < 40; i++) {
    try {
      const lines = readFileSync(OUTBOX, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as { to: string; text: string });
      const mail = [...lines].reverse().find((m) => m.to === to && m.text.includes(`/${kind}?token=`));
      const token = mail && new RegExp(`/${kind}\\?token=([\\w-]+)`).exec(mail.text)?.[1];
      if (token) return token;
    } catch {
      /* berkas belum ada */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Email ${kind} untuk ${to} tidak ditemukan`);
}

async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post("/api/v1/auth/login", { data: { email, password } });
  expect(res.status(), await res.text()).toBe(200);
  const cookies = (await request.storageState()).cookies;
  return cookies.find((c) => c.name === "nur_csrf")?.value ?? "";
}

async function uiLogin(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
}

test.describe.serial("frontend ↔ backend nyata", () => {
  const email = `live${Date.now()}@nur.test`;

  test("admin menerbitkan dataset hasil impor (REVIEW → PUBLISHED) lewat API", async ({ playwright, baseURL }) => {
    const admin = await playwright.request.newContext({ baseURL });
    const csrf = await apiLogin(admin, ADMIN.email, ADMIN.password);
    const list = await admin.get("/api/v1/admin/datasets");
    expect(list.status()).toBe(200);
    const datasets = (await list.json()).data as { id: string; datasetName: string; status: string }[];
    expect(datasets.length).toBeGreaterThanOrEqual(2);
    for (const d of datasets.filter((x) => x.status === "REVIEW")) {
      const res = await admin.post(`/api/v1/admin/datasets/${d.id}/approve`, { headers: { "X-CSRF-Token": csrf } });
      expect(res.status(), await res.text()).toBe(200);
    }
    const surahs = await admin.get("/api/v1/quran/surahs");
    expect((await surahs.json()).data.length).toBe(2);
    await admin.dispose();
  });

  test("daftar → verifikasi email → masuk lewat UI dengan cookie HttpOnly dan tanpa token di storage", async ({ page, context }) => {
    const errors = consoleErrors(page);
    await page.goto("/register");
    await page.getByLabel("Nama").fill("Hamba Uji");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Kata sandi", { exact: true }).fill(PASSWORD);
    await page.getByLabel("Konfirmasi kata sandi").fill(PASSWORD);
    await page.getByRole("button", { name: "Daftar" }).click();
    await expect(page.getByRole("heading", { name: "Periksa email Anda" })).toBeVisible();

    // Belum terverifikasi → backend menolak login.
    await uiLogin(page, email, PASSWORD);
    await expect(page.getByRole("alert").filter({ hasText: "Email belum diverifikasi" })).toBeVisible();

    await page.goto(`/verify-email?token=${await emailToken(email, "verify-email")}`);
    await expect(page.getByRole("heading", { name: "Email terverifikasi" })).toBeVisible();

    await uiLogin(page, email, "salah-total-1");
    await expect(page.getByRole("alert").filter({ hasText: "Email atau kata sandi salah." })).toBeVisible();
    await uiLogin(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: /Hamba/ })).toBeVisible();

    const cookies = await context.cookies();
    const at = cookies.find((c) => c.name === "nur_at");
    const rt = cookies.find((c) => c.name === "nur_rt");
    expect(at?.httpOnly).toBe(true);
    expect(rt?.httpOnly).toBe(true);
    expect(rt?.sameSite).toBe("Strict");
    expect(cookies.find((c) => c.name === "nur_csrf")?.httpOnly).toBe(false);

    const leaked = await page.evaluate(async () => {
      const text = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
      const dbs = (await indexedDB.databases?.()) ?? [];
      const rows: string[] = [];
      for (const info of dbs.filter((d) => d.name === "nur_local_db")) {
        await new Promise<void>((resolve) => {
          const open = indexedDB.open(info.name as string);
          open.onsuccess = () => {
            const db = open.result;
            const names = [...db.objectStoreNames];
            let pending = names.length;
            if (pending === 0) resolve();
            for (const n of names) {
              const req = db.transaction(n).objectStore(n).getAll();
              req.onsuccess = () => {
                rows.push(JSON.stringify(req.result));
                if (--pending === 0) resolve();
              };
            }
          };
        });
      }
      return text + rows.join("");
    });
    expect(leaked).not.toMatch(/password|refresh|token|argon2|nur_rt|nur_at/i);
    // Satu-satunya error konsol yang sah: 403 dari login SENGAJA sebelum email diverifikasi.
    expect(errors).toEqual(["Failed to load resource: the server responded with a status of 403 (Forbidden)"]);
  });

  test("Al-Qur'an dari backend: daftar, reader, terjemahan, tafsir kosong, pencarian", async ({ page }) => {
    const errors = consoleErrors(page);
    await uiLogin(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("link", { name: "Al-Qur'an" }).first().click();
    const list = page.getByRole("list", { name: "Daftar surah" });
    await expect(list.getByRole("link", { name: /Surah Percobaan/ })).toBeVisible();
    await expect(page.getByText(/Lisensi: TEST-ONLY/)).toBeVisible();
    await list.getByRole("link", { name: /Surah Percobaan/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Surah Percobaan" })).toBeVisible();
    await expect(page.getByText("عِلْمٌ نَافِعٌ")).toBeVisible();
    await expect(page.getByText("[TEST] terjemahan percobaan dua")).toBeVisible();
    await expect(page.getByText("Audio belum tersedia")).toBeVisible();
    await page.getByRole("button", { name: "Tafsir ayat 1" }).click();
    await expect(page.getByText("Tafsir belum tersedia")).toBeVisible();
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });

  test("bookmark offline-first tersinkron ke server dan terlihat dari sesi lain", async ({ page, context, playwright, baseURL }) => {
    await uiLogin(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goto("/quran/1");
    await expect(page.getByText("عِلْمٌ نَافِعٌ")).toBeVisible();

    // Offline: tindakan tetap berhasil lokal dan masuk antrean.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Bookmark ayat 2" }).click();
    await expect(page.getByRole("button", { name: "Hapus bookmark ayat 2" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("sync-status")).toHaveAttribute("data-kind", "offline");

    // Online kembali: tersinkron otomatis.
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByTestId("sync-status")).toHaveAttribute("data-kind", /success|online/, { timeout: 20_000 });

    // Sesi/perangkat lain melihat perubahan itu dari server.
    const other = await playwright.request.newContext({ baseURL });
    await apiLogin(other, email, PASSWORD);
    const pulled = await other.get("/api/v1/sync/pull?cursor=0");
    const changes = (await pulled.json()).data.changes as { entityType: string; entityId: string; operation: string }[];
    expect(changes.some((c) => c.entityType === "BOOKMARK" && c.entityId === "1:2" && c.operation === "UPSERT")).toBe(true);
    await other.dispose();
  });

  test("sesi yang dicabut dari perangkat lain mengeluarkan pengguna di UI", async ({ page, playwright, baseURL }) => {
    await uiLogin(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
    const other = await playwright.request.newContext({ baseURL });
    const csrf = await apiLogin(other, email, PASSWORD);
    const sessions = (await (await other.get("/api/v1/users/me/sessions")).json()).data as { id: string; current: boolean }[];
    for (const s of sessions.filter((x) => !x.current)) {
      const res = await other.delete(`/api/v1/users/me/sessions/${s.id}`, { headers: { "X-CSRF-Token": csrf } });
      expect(res.status()).toBe(204);
    }
    await other.dispose();
    await page.goto("/profile?tab=devices");
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout mencabut sesi di server dan mengunci rute", async ({ page }) => {
    await uiLogin(page, email, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.getByRole("button", { name: /Menu akun/ }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page.getByRole("heading", { name: "Masuk ke NUR" })).toBeVisible();
    const me = await page.request.get("/api/v1/users/me");
    expect(me.status()).toBe(401);
    await page.goto("/quran");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("admin UI: pengguna biasa ditolak; super admin melihat panel dan audit log dataset", async ({ page }) => {
    await uiLogin(page, email, PASSWORD);
    await page.goto("/admin");
    await expect(page.getByText("Akses ditolak")).toBeVisible();
    await page.getByRole("button", { name: /Menu akun/ }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();

    await uiLogin(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/audit");
    await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
    await expect(page.getByText("DATASET_PUBLISHED").first()).toBeVisible();
    await page.goto("/admin/datasets");
    await expect(page.getByRole("table", { name: "Versi dataset" })).toBeVisible();
  });
});
