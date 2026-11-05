import { mkdirSync } from "node:fs";
import { expect, login, navigateClient, test } from "./fixtures";

/**
 * Tangkapan layar untuk tinjauan visual manusia (diunggah sebagai artifact CI).
 * Test ini juga memastikan scene 3D benar-benar memasang <canvas> dan menggambar piksel non-kosong.
 */
const DIR = "screenshots";
mkdirSync(DIR, { recursive: true });

async function canvasHasPixels(page: import("@playwright/test").Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return false;
    const probe = document.createElement("canvas");
    probe.width = 64;
    probe.height = 64;
    const ctx = probe.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(canvas, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) if ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0) > 60) lit++;
    return lit > 40;
  });
}

for (const vp of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test.describe(`visual @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.name === "mobile" });

    test("landing 3D: hero, bab sticky scroll, portal modul", async ({ page }, info) => {
      test.skip(info.project.name !== "desktop");
      test.setTimeout(90_000);
      await page.goto("/");
      const mode = await page.locator("[data-scene-mode]").first().getAttribute("data-scene-mode");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (mode === "3d") {
        await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(4500); // animasi pembukaan kamera ±3,2 dtk
        expect(await canvasHasPixels(page), "canvas 3D harus berisi piksel yang tergambar").toBe(true);
      }
      await page.screenshot({ path: `${DIR}/landing-hero-${vp.name}.png` });

      await page.evaluate(() => {
        const s = document.querySelector("section");
        if (s) window.scrollTo(0, (s.scrollHeight - window.innerHeight) * 0.34);
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${DIR}/landing-chapter-${vp.name}.png` });

      await page.locator("#modules").scrollIntoViewIfNeeded();
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${DIR}/landing-modules-${vp.name}.png` });
    });

    test("halaman aplikasi: dashboard, kiblat, zakat", async ({ page }, info) => {
      test.skip(info.project.name !== "desktop");
      await login(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${DIR}/dashboard-${vp.name}.png` });
      await navigateClient(page, "/qibla");
      await page.getByRole("button", { name: "Atur lokasi" }).click();
      await page.getByRole("button", { name: "Simpan lokasi" }).click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${DIR}/qibla-${vp.name}.png` });
      await navigateClient(page, "/zakat");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${DIR}/zakat-${vp.name}.png` });
    });
  });
}
