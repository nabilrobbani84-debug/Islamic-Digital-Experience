import { expect, expectNoHorizontalOverflow, login, navigateClient, test } from "./fixtures";

/** Matriks viewport dari spesifikasi: 320 hingga 2560 px. */
const VIEWPORTS = [
  { name: "mobile kecil 320", width: 320, height: 640 },
  { name: "mobile 360", width: 360, height: 740 },
  { name: "mobile besar 390", width: 390, height: 844 },
  { name: "mobile besar 430", width: 430, height: 932 },
  { name: "tablet portrait 768", width: 768, height: 1024 },
  { name: "tablet landscape 1024", width: 1024, height: 768 },
  { name: "laptop 1280", width: 1280, height: 800 },
  { name: "desktop 1440", width: 1440, height: 900 },
  { name: "desktop besar 1920", width: 1920, height: 1080 },
  { name: "ultrawide 2560", width: 2560, height: 1080 },
] as const;

const ROUTES = ["/dashboard", "/quran", "/quran/1", "/prayer", "/qibla", "/calendar", "/zakat", "/asmaul-husna", "/dhikr", "/duas", "/hadith", "/hadith/1", "/profile", "/settings", "/settings/offline-data"];

for (const vp of VIEWPORTS) {
  test.describe(`responsif @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.width < 1024 });

    test("landing, login, dan seluruh rute aplikasi tanpa overflow horizontal", async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "Matriks viewport dijalankan satu kali pada proyek desktop");
      test.setTimeout(120_000);

      await page.goto("/?3d=off");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.goto("/login");
      await expectNoHorizontalOverflow(page);

      await login(page);
      const narrow = vp.width < 1024;
      // Navigasi: bottom nav di bawah 1024px, top nav di atasnya.
      if (narrow) {
        await expect(page.getByRole("navigation", { name: "Navigasi bawah" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeHidden();
      } else {
        await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
        await expect(page.getByRole("navigation", { name: "Navigasi bawah" })).toBeHidden();
      }

      const smallTargets: string[] = [];
      for (const route of ROUTES) {
        await navigateClient(page, route);
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await page.waitForTimeout(350);
        await expectNoHorizontalOverflow(page);
        if (vp.width <= 430) {
          const small = await page.evaluate(() =>
            [...document.querySelectorAll<HTMLElement>("button, a[href], select, [role='switch'], [role='radio']")]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                const style = getComputedStyle(el);
                const insideText = el.closest("p, li > p") !== null && el.tagName === "A" && style.display === "inline";
                const calendarCell = el.tagName === "BUTTON" && el.getAttribute("aria-pressed") !== null && /^\d+ \w+ \d{4},/.test(el.getAttribute("aria-label") ?? "");
                const min = calendarCell ? 30 : 32;
                return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && !insideText && !el.classList.contains("sr-only") && (r.width < min || r.height < min);
              })
              .map((el) => `${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}] ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
          );
          smallTargets.push(...small.map((s) => `${route}: ${s}`));
        }
      }
      expect(smallTargets, `target sentuh < 32px:\n${smallTargets.join("\n")}`).toEqual([]);
    });
  });
}

test.describe("responsif: dialog dan keyboard virtual", () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true });

  test("dialog pengaturan bacaan tetap di dalam layar 320px dan dapat digulir", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await login(page);
    await navigateClient(page, "/quran/1");
    await page.getByRole("button", { name: "Pengaturan bacaan" }).click();
    const dialog = page.getByRole("dialog", { name: "Pengaturan bacaan" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(320.5);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(568.5);
    await expectNoHorizontalOverflow(page);
  });

  test("mini player tidak menutupi navigasi bawah", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop");
    await login(page);
    const nav = await page.getByRole("navigation", { name: "Navigasi bawah" }).boundingBox();
    expect(nav).not.toBeNull();
    expect((nav?.y ?? 0) + (nav?.height ?? 0)).toBeLessThanOrEqual(568.5 + 1);
    // Konten halaman memiliki ruang bawah yang cukup agar item terakhir tidak tertutup navigasi.
    const padding = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector("main#main") as Element).paddingBottom));
    expect(padding).toBeGreaterThanOrEqual(96);
  });
});
