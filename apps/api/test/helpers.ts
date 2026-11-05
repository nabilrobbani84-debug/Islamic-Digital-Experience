import "reflect-metadata";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import request from "supertest";
import type { Server } from "node:http";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { PrismaClient } from "../src/generated/prisma/client";
import { createApp } from "../src/main";
import { normalizeArabic } from "../src/common/arabic";

export const PASSWORD = "Passw0rd-nur-test";
export const api = (path: string): string => `/api/v1${path}`;
export type Agent = ReturnType<typeof request.agent>;

export interface Ctx {
  app: NestExpressApplication;
  http: Server;
  prisma: PrismaClient;
}

export async function boot(): Promise<Ctx> {
  const app = await createApp();
  await app.init();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL wajib diisi untuk test");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  return { app, http: app.getHttpServer() as Server, prisma };
}

export async function shutdown(ctx: Ctx): Promise<void> {
  await ctx.prisma.$disconnect();
  await ctx.app.close();
}

/** Kosongkan seluruh data. TRUNCATE tidak memicu trigger append-only pada audit log. */
export async function reset(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE users, surahs, juzs, content_sources, dataset_versions, quran_editions, tafsir_sources, qaris, hadith_collections,
       dhikr_categories, dhikr_items, daily_duas, dua_categories, asmaul_husna, admin_audit_logs, content_revisions, sync_changes
     RESTART IDENTITY CASCADE`,
  );
}

type Role = "USER" | "ADMIN" | "SUPER_ADMIN";

export async function makeUser(prisma: PrismaClient, opts: { email: string; role?: Role; verified?: boolean; active?: boolean; name?: string }) {
  return prisma.user.create({
    data: {
      name: opts.name ?? opts.email.split("@")[0] ?? "Tester",
      email: opts.email,
      role: opts.role ?? "USER",
      isActive: opts.active ?? true,
      emailVerifiedAt: opts.verified === false ? null : new Date(),
      passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }),
    },
  });
}

export function cookieValue(setCookie: unknown, name: string): string | undefined {
  const list = Array.isArray(setCookie) ? (setCookie as string[]) : [];
  const entry = list.find((c) => c.startsWith(`${name}=`));
  return entry?.slice(name.length + 1).split(";")[0];
}

export interface Session {
  agent: Agent;
  csrf: string;
  userId: string;
}

export async function login(http: Server, email: string, password = PASSWORD): Promise<Session> {
  const agent = request.agent(http);
  const res = await agent.post(api("/auth/login")).send({ email, password });
  if (res.status !== 200) throw new Error(`login ${email} gagal: ${res.status} ${JSON.stringify(res.body)}`);
  const csrf = cookieValue(res.headers["set-cookie"], "nur_csrf");
  if (!csrf) throw new Error("cookie CSRF tidak diset");
  return { agent, csrf, userId: (res.body as { data: { id: string } }).data.id };
}

export const post = (s: Session, path: string, body?: unknown) => s.agent.post(api(path)).set("X-CSRF-Token", s.csrf).send(body ?? {});
export const patch = (s: Session, path: string, body?: unknown) => s.agent.patch(api(path)).set("X-CSRF-Token", s.csrf).send(body ?? {});
export const del = (s: Session, path: string) => s.agent.delete(api(path)).set("X-CSRF-Token", s.csrf);

/** Dataset Al-Qur'an FIXTURE untuk test: teks Arab generik (bukan ayat), terjemahan bertanda [TEST]. */
export async function seedQuranFixture(prisma: PrismaClient, approverId: string) {
  const source = await prisma.contentSource.create({ data: { name: "Fixture Test", license: "TEST-ONLY" } });
  await prisma.datasetVersion.create({
    data: { datasetName: "quran-text", version: "test-1", checksum: "a".repeat(64), recordCount: 3, contentSourceId: source.id, status: "PUBLISHED", approvedById: approverId, approvedAt: new Date() },
  });
  await prisma.surah.create({ data: { id: 1, number: 1, nameArabic: "سورة اختبار", nameLatin: "Surah Uji", meaning: "Fixture", revelationType: "MAKKIYAH", totalVerses: 3 } });
  await prisma.surah.create({ data: { id: 2, number: 2, nameArabic: "سورة ثانية", nameLatin: "Surah Dua", revelationType: "MADANIYAH", totalVerses: 1 } });
  const texts = ["كِتَابٌ مُبَارَكٌ", "عِلْمٌ نَافِعٌ", "قَلْبٌ سَلِيمٌ"];
  for (const [i, text] of texts.entries()) {
    await prisma.verse.create({ data: { surahId: 1, verseNumber: i + 1, globalNumber: i + 1, textUthmani: text, textNormalized: normalizeArabic(text), pageNumber: 1, juzNumber: 1 } });
  }
  await prisma.verse.create({ data: { surahId: 2, verseNumber: 1, globalNumber: 4, textUthmani: "نُورٌ", textNormalized: normalizeArabic("نُورٌ"), pageNumber: 2, juzNumber: 1 } });
  await prisma.juz.create({ data: { number: 1, startSurahId: 1, startVerse: 1, endSurahId: 2, endVerse: 1 } });
  const edition = await prisma.quranEdition.create({ data: { name: "Terjemahan Uji", language: "id", version: "1", source: "Fixture", status: "PUBLISHED" } });
  const verses = await prisma.verse.findMany({ orderBy: { globalNumber: "asc" } });
  for (const v of verses) {
    await prisma.verseTranslation.create({ data: { verseId: v.id, editionId: edition.id, translationText: `[TEST] terjemahan percobaan nomor ${v.globalNumber}` } });
  }
  return { edition, verses };
}
