import AxeBuilder from "@axe-core/playwright";
import { expect, login, navigateClient, test } from "./fixtures";

test.describe("Offline", () => {
  test("fitur lokal tetap berjalan saat koneksi terputus", async ({ page, context }) => {
    await login(page);
    await navigateClient(page, "/prayer");
    await page.getByRole("button", { name: "Atur lokasi" }).click();
    await page.getByRole("button", { name: "Simpan lokasi" }).click();
    // Modul yang sudah dibuka (kode sudah tersedia di perangkat) harus tetap berfungsi saat offline.
    for (const path of ["/qibla", "/calendar", "/dhikr", "/prayer"]) {
      await navigateClient(page, path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    await context.setOffline(true);
    await expect(page.getByRole("timer")).toHaveText(/\d{2}:\d{2}:\d{2}/);
    await expect(page.getByText(/Mode offline/)).toBeVisible();
    await navigateClient(page, "/qibla");
    await expect(page.getByRole("heading", { level: 1, name: "Arah Kiblat" })).toBeVisible();
    await navigateClient(page, "/calendar");
    await expect(page.getByTestId("calendar-title")).toBeVisible();
    await navigateClient(page, "/dhikr");
    await page.getByRole("button", { name: /Tambah hitungan/ }).click();
    await expect(page.locator("#dhikr-count")).toHaveText("1");
    await context.setOffline(false);
    await expect(page.getByText(/Mode offline/)).toHaveCount(0);
  });
});

test.describe("Aksesibilitas dasar (axe)", () => {
  const pages: [string, boolean][] = [
    ["/", false],
    ["/login", false],
    ["/dashboard", true],
    ["/quran", true],
    ["/prayer", true],
    ["/zakat", true],
  ];
  for (const [path, needsLogin] of pages) {
    test(`tidak ada pelanggaran serious/critical: ${path}`, async ({ page }) => {
      if (needsLogin) {
        await login(page);
        await navigateClient(page, path);
      } else {
        await page.goto(`${path}${path === "/" ? "?3d=off" : ""}`);
      }
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).disableRules(["color-contrast"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
    });
  }

  test("navigasi keyboard: skip link dan fokus terlihat", async ({ page }) => {
    await login(page);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Lewati ke konten utama" })).toBeFocused();
  });
});
