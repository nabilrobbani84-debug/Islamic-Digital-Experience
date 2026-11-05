import { Global, Module } from "@nestjs/common";
import { z } from "zod";

export const CONFIG = Symbol("CONFIG");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter"),
    ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
    REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
    APP_BASE_URL: z.string().default("http://localhost:5173"),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    MAIL_TRANSPORT: z.enum(["log", "smtp", "memory"]).default("log"),
    MAIL_FROM: z.string().default("NUR <no-reply@nur.local>"),
    SMTP_URL: z.string().optional(),
    AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(10),
    GLOBAL_RATE_LIMIT: z.coerce.number().int().min(1).default(300),
    STORAGE_DIR: z.string().default("./storage"),
    ASSET_BASE_URL: z.string().default("/media"),
  })
  .superRefine((env, ctx) => {
    if (env.MAIL_TRANSPORT === "smtp" && !env.SMTP_URL) {
      ctx.addIssue({ code: "custom", path: ["SMTP_URL"], message: "SMTP_URL wajib jika MAIL_TRANSPORT=smtp" });
    }
    if (env.NODE_ENV === "production" && env.MAIL_TRANSPORT !== "smtp") {
      ctx.addIssue({ code: "custom", path: ["MAIL_TRANSPORT"], message: "Produksi wajib memakai MAIL_TRANSPORT=smtp" });
    }
    if (env.NODE_ENV === "production" && /ganti-dengan|change-?me|secret-secret/i.test(env.JWT_SECRET)) {
      ctx.addIssue({ code: "custom", path: ["JWT_SECRET"], message: "JWT_SECRET produksi tidak boleh memakai nilai contoh" });
    }
  });

export type AppConfig = z.infer<typeof schema> & { cookieSecure: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Konfigurasi tidak valid: ${detail}`);
  }
  return { ...parsed.data, cookieSecure: parsed.data.NODE_ENV === "production" };
}

/** Konfigurasi tersedia global: dibaca sekali saat modul dibuat. */
@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: (): AppConfig => loadConfig() }],
  exports: [CONFIG],
})
export class ConfigModule {}
