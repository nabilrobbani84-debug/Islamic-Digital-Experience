import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Fallback hanya untuk `prisma generate` di mesin tanpa .env. Deployment WAJIB mengisi DATABASE_URL.
    url: process.env.DATABASE_URL ?? "postgresql://nur:nur@localhost:5432/nur",
  },
});
