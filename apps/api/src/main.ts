import "reflect-metadata";
import "dotenv/config";
import { resolve } from "node:path";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { loadConfig } from "./config";

export async function createApp(): Promise<NestExpressApplication> {
  const cfg = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: cfg.NODE_ENV === "test" ? false : ["log", "warn", "error"] });
  app.set("trust proxy", cfg.TRUST_PROXY);
  app.disable("x-powered-by");
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser("json", { limit: "1mb" });
  app.enableCors({ origin: cfg.WEB_ORIGIN.split(",").map((o) => o.trim()), credentials: true, methods: ["GET", "POST", "PATCH", "DELETE"], allowedHeaders: ["Content-Type", "X-CSRF-Token"] });
  // Berkas media (audio) dilayani statis dengan dukungan Range; prefix global tidak berlaku di sini.
  app.useStaticAssets(resolve(cfg.STORAGE_DIR), { prefix: cfg.ASSET_BASE_URL, index: false, dotfiles: "deny", maxAge: "7d", immutable: true });
  app.enableShutdownHooks();
  return app;
}

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const cfg = loadConfig();
  await app.listen(cfg.PORT, "0.0.0.0");
  new Logger("Bootstrap").log(`NUR API berjalan di http://localhost:${cfg.PORT}/api/v1 (${cfg.NODE_ENV})`);
}

if (require.main === module) {
  bootstrap().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
