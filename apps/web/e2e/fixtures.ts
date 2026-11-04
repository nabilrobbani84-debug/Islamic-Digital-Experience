import { test as base, expect, type Page } from "@playwright/test";

/** Pesan console yang berasal dari driver GPU/headless, bukan bug aplikasi. */
const IGNORED = [/WebGL/i, /GPU stall/i, /THREE\./, /GL_INVALID/i, /swiftshader/i, /Automatic fallback to software WebGL/i];

export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        // Request 401 /users/me saat belum login adalah perilaku yang diharapkan pada adapter HTTP.
        if (IGNORED.some((r) => r.test(text))) return;
        errors.push(text);
      });
      page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
      await use(errors);
      expect(errors, `Console error:\n${errors.join("\n")}`).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function login(page: Page, email = "demo@nur.local", password = "demo12345"): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "halaman tidak boleh memiliki horizontal overflow").toBeLessThanOrEqual(1);
}

/** Navigasi sisi klien (tanpa reload) agar sesi mock di memori tetap ada. */
export async function navigateClient(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
