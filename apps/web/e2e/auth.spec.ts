import { expect, login, test } from "./fixtures";

test.describe("Autentikasi", () => {
  test("validasi formulir login dan kredensial salah", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText("Email wajib diisi")).toBeVisible();
    await page.getByLabel("Email").fill("demo@nur.local");
    await page.getByLabel("Kata sandi", { exact: true }).fill("salah123");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Email atau kata sandi salah." })).toBeVisible();
  });

  test("login → dashboard → logout", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { level: 1, name: /Pengguna/ })).toBeVisible();
    await page.getByRole("button", { name: /Menu akun/ }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/login(\?.*)?$/);
    await expect(page.getByRole("heading", { name: "Masuk ke NUR" })).toBeVisible();
    // Setelah logout, rute aplikasi kembali terkunci.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?next=/);
  });

  test("registrasi menampilkan instruksi verifikasi email", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nama").fill("Hamba Allah");
    await page.getByLabel("Email").fill(`user${Date.now()}@nur.local`);
    await page.getByLabel("Kata sandi", { exact: true }).fill("rahasia123");
    await page.getByLabel("Konfirmasi kata sandi").fill("rahasia123");
    await page.getByRole("button", { name: "Daftar" }).click();
    await expect(page.getByRole("heading", { name: "Periksa email Anda" })).toBeVisible();
  });

  test("halaman lupa & reset kata sandi", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("demo@nur.local");
    await page.getByRole("button", { name: "Kirim tautan reset" }).click();
    await expect(page.getByText(/Jika email tersebut terdaftar/)).toBeVisible();
    await page.goto("/reset-password");
    await expect(page.getByRole("heading", { name: "Tautan tidak valid" })).toBeVisible();
  });
});
