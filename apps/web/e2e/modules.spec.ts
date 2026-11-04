import { expect, expectNoHorizontalOverflow, login, navigateClient, test } from "./fixtures";

test.describe("Modul ibadah", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("semua rute utama dapat dibuka tanpa error dan tanpa overflow", async ({ page }) => {
    const routes: [string, RegExp][] = [
      ["/quran", /Al-Qur'an Al-Karim/],
      ["/prayer", /Waktu Sholat/],
      ["/qibla", /Arah Kiblat/],
      ["/calendar", /Kalender Hijriah/],
      ["/zakat", /Kalkulator Zakat/],
      ["/asmaul-husna", /Asmaul Husna/],
      ["/dhikr", /Penghitung Dzikir/],
      ["/duas", /Doa Harian/],
      ["/hadith", /Hadis Arba'in Nawawi/],
      ["/profile", /Profil & Riwayat/],
      ["/settings", /Pengaturan/],
      ["/settings/offline-data", /Data Offline/],
    ];
    for (const [path, heading] of routes) {
      await navigateClient(page, path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("Quran: daftar → reader → bookmark → pengaturan bacaan", async ({ page }) => {
    await navigateClient(page, "/quran");
    await page.getByRole("link", { name: /Contoh Surah 1/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Contoh Surah 1" })).toBeVisible();
    await page.getByRole("button", { name: "Bookmark ayat 2" }).click();
    await expect(page.getByText("Bookmark disimpan")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hapus bookmark ayat 2" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Pengaturan bacaan" }).click();
    await expect(page.getByRole("dialog", { name: "Pengaturan bacaan" })).toBeVisible();
    await page.getByRole("button", { name: "Perbesar Ukuran teks Arab" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Audio: backend mock tidak menyediakan qari → status jelas, bukan error.
    await expect(page.getByText("Audio belum tersedia")).toBeVisible();
  });

  test("Prayer & Qibla: atur lokasi, hitung jadwal dan arah kiblat secara lokal", async ({ page }) => {
    await navigateClient(page, "/prayer");
    await page.getByRole("button", { name: "Atur lokasi" }).click();
    await page.getByLabel("Kota").selectOption("Jakarta");
    await page.getByRole("button", { name: "Simpan lokasi" }).click();
    await expect(page.getByRole("timer")).toHaveText(/\d{2}:\d{2}:\d{2}/);
    await expect(page.getByRole("table")).toBeVisible();
    await navigateClient(page, "/qibla");
    await expect(page.getByText("295.15°")).toBeVisible();
    await expect(page.getByText("Barat Laut")).toBeVisible();
  });

  test("Zakat tabungan dihitung dengan benar", async ({ page }) => {
    await navigateClient(page, "/zakat");
    await page.getByRole("radio", { name: "Tabungan" }).click();
    await page.getByLabel("Saldo tabungan").fill("150.000.000");
    await page.getByLabel("Utang jatuh tempo").fill("10.000.000");
    await page.getByLabel("Harga emas per gram").fill("1.300.000");
    await page.getByRole("switch", { name: /haul/ }).click();
    await page.getByRole("button", { name: "Hitung zakat" }).click();
    await expect(page.getByTestId("zakat-payable")).toHaveText(/3\.500\.000/);
    await page.getByRole("button", { name: "Simpan hasil" }).click();
    await expect(page.getByText("Hasil disimpan")).toBeVisible();
  });

  test("Dzikir: hitung, reset dengan konfirmasi", async ({ page }) => {
    await navigateClient(page, "/dhikr");
    const counter = page.getByRole("button", { name: /Tambah hitungan/ });
    await counter.click();
    await counter.click();
    await counter.click();
    await expect(page.locator("#dhikr-count")).toHaveText("3");
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    await page.getByRole("dialog", { name: "Reset hitungan?" }).getByRole("button", { name: "Reset" }).click();
    await expect(page.locator("#dhikr-count")).toHaveText("0");
  });

  test("Kalender: navigasi bulan", async ({ page }) => {
    await navigateClient(page, "/calendar");
    const title = page.getByTestId("calendar-title");
    const before = await title.textContent();
    await page.getByRole("button", { name: "Bulan berikutnya" }).click();
    await expect(title).not.toHaveText(before ?? "");
  });

  test("Admin: pengguna biasa ditolak", async ({ page }) => {
    await navigateClient(page, "/admin");
    await expect(page.getByText("Akses ditolak")).toBeVisible();
  });
});

test("Admin: super admin dapat membuka panel dan mengajukan revisi", async ({ page }) => {
  await login(page, "admin@nur.local", "admin12345");
  await navigateClient(page, "/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Admin NUR" })).toBeVisible();
  await page.getByRole("link", { name: "Konten & revisi" }).click();
  await page.getByRole("button", { name: "Revisi baru" }).click();
  await page.getByLabel("ID entitas").fill("dua-1");
  await page.getByLabel("Payload (JSON)").fill('{"title":"Contoh","source":"Referensi"}');
  await page.getByRole("button", { name: "Ajukan" }).click();
  await expect(page.getByText("Revisi diajukan untuk review")).toBeVisible();
  await page.getByRole("link", { name: "Pengguna" }).click();
  await expect(page.getByRole("table", { name: "Daftar pengguna" })).toBeVisible();
});
