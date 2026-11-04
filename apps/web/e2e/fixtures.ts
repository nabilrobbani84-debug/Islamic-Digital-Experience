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
  const report = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const overflow = document.documentElement.scrollWidth - width;
    // Elemen terdalam yang melewati tepi kanan viewport, untuk diagnosis.
    const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.right <= width + 1 || r.width === 0) return false;
        const style = getComputedStyle(el);
        if (style.position === "fixed") return false;
        return ![...el.children].some((c) => c.getBoundingClientRect().right > width + 1);
      })
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 80)} (right=${Math.round(el.getBoundingClientRect().right)})`);
    return { overflow, offenders };
  });
  expect(report.overflow, `horizontal overflow ${report.overflow}px di ${page.url()}:\n${report.offenders.join("\n")}`).toBeLessThanOrEqual(1);
}

/** Navigasi sisi klien (tanpa reload) agar sesi mock di memori tetap ada. */
export async function navigateClient(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}
