import { expect, expectNoHorizontalOverflow, test } from "./fixtures";

test.describe("Landing immersive", () => {
  test("menampilkan hero, CTA, dan sticky scroll tanpa overflow", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: /Your Spiritual Journey, Reimagined/ })).toBeVisible();
    await expect(page.getByText("Explore the beauty of Islam through a more meaningful digital experience.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Explore NUR/ })).toBeVisible();
    // Scene 3D (canvas) atau fallback 2D harus tampil.
    await expect(page.locator("[data-scene-mode]").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    // Scroll sinematik: bab "Al-Qur'an" muncul di ~32% progres sticky section.
    await page.evaluate(() => {
      const section = document.querySelector("section");
      if (section) window.scrollTo(0, (section.scrollHeight - window.innerHeight) * 0.32);
    });
    const chapter = page.getByRole("heading", { name: "Membaca dengan tenang, tanpa gangguan." });
    await expect
      .poll(async () => Number(await chapter.evaluate((el) => getComputedStyle(el.closest("article") ?? el).opacity)), { timeout: 10_000 })
      .toBeGreaterThan(0.6);
    // Hero sudah memudar.
    await expect
      .poll(async () => Number(await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el.closest(".absolute") ?? el).opacity)))
      .toBeLessThan(0.2);
  });

  test("Start Reading Quran mewajibkan login dan kembali ke tujuan", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Start Reading Quran/ }).click();
    await expect(page).toHaveURL(/\/login\?next=%2Fquran/);
    await page.getByLabel("Email").fill("demo@nur.local");
    await page.getByLabel("Kata sandi", { exact: true }).fill("demo12345");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL(/\/quran$/);
  });

  test("fallback 2D dipakai saat 3D dimatikan (?3d=off)", async ({ page }) => {
    await page.goto("/?3d=off");
    await expect(page.getByTestId("hero-fallback")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
  });

  test("reduced motion tetap menampilkan konten", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
