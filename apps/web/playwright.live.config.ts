import { defineConfig, devices } from "@playwright/test";

/** E2E full-stack: build produksi frontend (vite preview) → proxy /api → backend NestJS + PostgreSQL nyata. */
export default defineConfig({
  testDir: "./e2e-live",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "playwright-report-live" }]] : "list",
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure", locale: "id-ID", timezoneId: "Asia/Jakarta" },
  projects: [{ name: "live-desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
