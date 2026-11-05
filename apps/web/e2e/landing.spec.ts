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
    // Hero tidak boleh bertumpuk dengan kartu bab: disembunyikan sepenuhnya (bukan sekadar memudar).
    await expect(page.getByRole("heading", { level: 1, name: /Your Spiritual Journey/ })).toBeHidden();
    // Gulir kembali ke atas: hero tampil lagi dan bab disembunyikan (tidak ada tumpang tindih).
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole("heading", { level: 1, name: /Your Spiritual Journey/ })).toBeVisible();
    await expect(chapter).toBeHidden();
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

  test("fallback 2D dipakai saat 3D dimatikan (?3d=off) dan three.js tidak diunduh", async ({ page }) => {
    const scripts: string[] = [];
    page.on("request", (req) => {
      if (req.resourceType() === "script") scripts.push(req.url());
    });
    await page.goto("/?3d=off");
    await expect(page.getByTestId("hero-fallback")).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    expect(scripts.filter((u) => /\/assets\/(three|r3f)-/.test(u))).toEqual([]);
  });

  test("scene 3D dimuat lazy saat WebGL tersedia", async ({ page }) => {
    await page.goto("/");
    const mode = await page.locator("[data-scene-mode]").first().getAttribute("data-scene-mode");
    test.skip(mode !== "3d", "Browser CI tanpa WebGL memakai fallback 2D");
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });

  test("reduced motion tetap menampilkan konten", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
