import { Inject, Injectable } from "@nestjs/common";
import argon2 from "argon2";
import type { Request, Response } from "express";
import { CONFIG, type AppConfig } from "../config";
import { ApiException, notFound, unauthorized } from "../common/http";
import { MAILER, type Mailer } from "../common/mailer";
import { clearSessionCookies, COOKIE_REFRESH, randomToken, setSessionCookies, sha256, signAccessToken } from "../common/security";
import type { Role } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

const ARGON_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const VERIFY_TTL_MS = 48 * 3_600_000;
const RESET_TTL_MS = 60 * 60_000;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  avatarUrl: null;
  createdAt: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

export const toPublicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role as Role,
  emailVerified: u.emailVerifiedAt !== null,
  avatarUrl: null,
  createdAt: u.createdAt.toISOString(),
});

@Injectable()
export class AuthService {
  /** Hash palsu agar waktu respons login sama untuk email terdaftar dan tidak terdaftar. */
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON_OPTIONS);
  }

  async register(input: { name: string; email: string; password: string }): Promise<{ email: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      // Respons identik agar keberadaan akun tidak bocor; pemilik akun diberi tahu lewat email.
      await this.mailer.send({
        to: input.email,
        subject: "Pendaftaran NUR",
        text: `Seseorang mencoba mendaftar dengan email ini, tetapi akun sudah ada.\nJika itu Anda, silakan masuk atau atur ulang kata sandi: ${this.cfg.APP_BASE_URL}/forgot-password`,
      });
      return { email: input.email };
    }
    const user = await this.prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash: await this.hashPassword(input.password) },
    });
    await this.issueEmailToken(user.id, user.email, "EMAIL_VERIFICATION");
    return { email: user.email };
  }

  private async issueEmailToken(userId: string, email: string, purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET"): Promise<void> {
    const token = randomToken();
    // Token lama untuk tujuan yang sama dibatalkan agar hanya tautan terbaru yang berlaku.
    await this.prisma.userToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.userToken.create({
      data: { userId, purpose, tokenHash: sha256(token), expiresAt: new Date(Date.now() + (purpose === "EMAIL_VERIFICATION" ? VERIFY_TTL_MS : RESET_TTL_MS)) },
    });
    const isVerify = purpose === "EMAIL_VERIFICATION";
    const link = `${this.cfg.APP_BASE_URL}/${isVerify ? "verify-email" : "reset-password"}?token=${token}`;
    await this.mailer.send({
      to: email,
      subject: isVerify ? "Verifikasi email NUR" : "Atur ulang kata sandi NUR",
      text: isVerify
        ? `Selamat datang di NUR.\nBuka tautan berikut untuk memverifikasi email Anda (berlaku 48 jam):\n${link}`
        : `Buka tautan berikut untuk membuat kata sandi baru (berlaku 1 jam). Abaikan email ini jika Anda tidak memintanya:\n${link}`,
    });
  }

  private async consumeToken(rawToken: string, purpose: "EMAIL_VERIFICATION" | "PASSWORD_RESET"): Promise<string> {
    const tokenHash = sha256(rawToken);
    // Pemakaian atomik: hanya satu permintaan yang bisa menandai token terpakai.
    const claimed = await this.prisma.userToken.updateMany({
      where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new ApiException(400, "TOKEN_INVALID", "Tautan tidak valid atau sudah kedaluwarsa");
    const row = await this.prisma.userToken.findUniqueOrThrow({ where: { tokenHash }, select: { userId: true } });
    return row.userId;
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.consumeToken(token, "EMAIL_VERIFICATION");
    await this.prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }

  async resendVerification(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.isActive && !user.emailVerifiedAt) await this.issueEmailToken(user.id, user.email, "EMAIL_VERIFICATION");
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.isActive) await this.issueEmailToken(user.id, user.email, "PASSWORD_RESET");
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const userId = await this.consumeToken(token, "PASSWORD_RESET");
    const passwordHash = await this.hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, emailVerifiedAt: new Date() } }),
      this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "PASSWORD_RESET" } }),
    ]);
  }

  async login(req: Request, res: Response, input: { email: string; password: string; deviceName?: string }): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    this.dummyHash ??= this.hashPassword("nur-dummy-password");
    const valid = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), input.password).catch(() => false);
    if (!user || !valid) throw new ApiException(401, "INVALID_CREDENTIALS", "Email atau kata sandi salah");
    if (!user.isActive) throw new ApiException(403, "ACCOUNT_DISABLED", "Akun dinonaktifkan");
    if (!user.emailVerifiedAt) throw new ApiException(403, "EMAIL_NOT_VERIFIED", "Email belum diverifikasi");

    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        deviceName: input.deviceName?.slice(0, 120) ?? null,
        userAgent: req.header("user-agent")?.slice(0, 512) ?? null,
        ipAddress: req.ip ?? null,
        expiresAt: new Date(Date.now() + this.cfg.REFRESH_TTL_DAYS * 86_400_000),
      },
    });
    const refresh = await this.newRefreshToken(session.id);
    setSessionCookies(res, this.cfg, { access: signAccessToken(this.cfg, { sub: user.id, sid: session.id }), refresh });
    return toPublicUser(user);
  }

  private async newRefreshToken(sessionId: string): Promise<string> {
    const token = randomToken();
    await this.prisma.refreshToken.create({
      data: { sessionId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + this.cfg.REFRESH_TTL_DAYS * 86_400_000) },
    });
    return token;
  }

  /**
   * Rotasi refresh token. Token yang sudah dipakai lalu muncul lagi dianggap dicuri:
   * seluruh sesi (perangkat) dicabut.
   */
  async refresh(req: Request, res: Response): Promise<void> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESH];
    if (!raw) throw unauthorized();
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
      include: { session: { include: { user: { select: { isActive: true } } } } },
    });
    if (!stored || stored.session.revokedAt || stored.session.expiresAt <= new Date() || !stored.session.user.isActive) {
      clearSessionCookies(res, this.cfg);
      throw unauthorized();
    }
    if (stored.usedAt || stored.expiresAt <= new Date()) {
      if (stored.usedAt) {
        await this.prisma.authSession.update({ where: { id: stored.sessionId }, data: { revokedAt: new Date(), revokeReason: "REFRESH_REUSE" } });
      }
      clearSessionCookies(res, this.cfg);
      throw unauthorized();
    }
    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: stored.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) {
      await this.prisma.authSession.update({ where: { id: stored.sessionId }, data: { revokedAt: new Date(), revokeReason: "REFRESH_REUSE" } });
      clearSessionCookies(res, this.cfg);
      throw unauthorized();
    }
    const next = randomToken();
    const created = await this.prisma.refreshToken.create({
      data: { sessionId: stored.sessionId, tokenHash: sha256(next), expiresAt: new Date(Date.now() + this.cfg.REFRESH_TTL_DAYS * 86_400_000) },
    });
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { replacedById: created.id } });
    await this.prisma.authSession.update({ where: { id: stored.sessionId }, data: { lastUsedAt: new Date() } });
    setSessionCookies(res, this.cfg, { access: signAccessToken(this.cfg, { sub: stored.session.userId, sid: stored.sessionId }), refresh: next });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESH];
    if (raw) {
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, select: { sessionId: true } });
      if (stored) {
        await this.prisma.authSession.updateMany({ where: { id: stored.sessionId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "LOGOUT" } });
      }
    }
    clearSessionCookies(res, this.cfg);
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound();
    return toPublicUser(user);
  }

  async updateName(userId: string, name: string): Promise<PublicUser> {
    return toPublicUser(await this.prisma.user.update({ where: { id: userId }, data: { name } }));
  }

  async changePassword(userId: string, sessionId: string, current: string, next: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, current).catch(() => false))) {
      throw new ApiException(400, "VALIDATION_ERROR", "Kata sandi saat ini salah");
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashPassword(next) } }),
      // Sesi lain dicabut; sesi saat ini dipertahankan.
      this.prisma.authSession.updateMany({ where: { userId, revokedAt: null, id: { not: sessionId } }, data: { revokedAt: new Date(), revokeReason: "PASSWORD_CHANGED" } }),
    ]);
  }

  async listSessions(userId: string, currentId: string) {
    const rows = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
    });
    return rows.map((s) => ({ id: s.id, deviceName: s.deviceName, userAgent: s.userAgent, lastUsedAt: s.lastUsedAt.toISOString(), current: s.id === currentId }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.prisma.authSession.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "USER_REVOKED" } });
    if (result.count === 0) throw notFound("Sesi tidak ditemukan");
  }
}
