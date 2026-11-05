/**
 * Membuat akun SUPER_ADMIN pertama.
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run build && npm run seed:admin
 * Kata sandi tidak pernah dicetak atau disimpan selain sebagai hash Argon2id.
 */
import "dotenv/config";
import argon2 from "argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME?.trim() || "Super Admin";
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL dan SEED_ADMIN_PASSWORD wajib diisi");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL wajib diisi");
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new Error("Kata sandi admin minimal 12 karakter dan mengandung huruf serta angka");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    if (await prisma.user.findUnique({ where: { email } })) throw new Error(`Pengguna ${email} sudah ada`);
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
    await prisma.user.create({ data: { name, email, passwordHash, role: "SUPER_ADMIN", emailVerifiedAt: new Date() } });
    console.log(`SUPER_ADMIN dibuat: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
