import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { CONFIG, type AppConfig } from "../config";
import { PrismaService } from "../prisma/prisma.service";
import { ApiException, forbidden, PUBLIC_KEY, RATE_GROUP_KEY, ROLES_KEY, SKIP_CSRF_KEY, unauthorized } from "./http";
import type { Role } from "./types";

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");
export const randomToken = (): string => randomBytes(32).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export const COOKIE_ACCESS = "nur_at";
export const COOKIE_REFRESH = "nur_rt";
export const COOKIE_CSRF = "nur_csrf";

export interface AccessClaims {
  sub: string;
  sid: string;
}

export function signAccessToken(cfg: AppConfig, claims: AccessClaims): string {
  return jwt.sign(claims, cfg.JWT_SECRET, { algorithm: "HS256", expiresIn: cfg.ACCESS_TTL_SECONDS });
}

export function verifyAccessToken(cfg: AppConfig, token: string): AccessClaims | null {
  try {
    const payload = jwt.verify(token, cfg.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload["sid"] !== "string") return null;
    return { sub: payload.sub, sid: payload["sid"] };
  } catch {
    return null;
  }
}

/** Cookie sesi: access (HttpOnly, Lax), refresh (HttpOnly, Strict, path /auth), csrf (terbaca JS untuk double-submit). */
export function setSessionCookies(res: Response, cfg: AppConfig, tokens: { access: string; refresh: string }): void {
  const secure = cfg.cookieSecure;
  const refreshMs = cfg.REFRESH_TTL_DAYS * 86_400_000;
  res.cookie(COOKIE_ACCESS, tokens.access, { httpOnly: true, secure, sameSite: "lax", path: "/api/v1", maxAge: cfg.ACCESS_TTL_SECONDS * 1000 });
  res.cookie(COOKIE_REFRESH, tokens.refresh, { httpOnly: true, secure, sameSite: "strict", path: "/api/v1/auth", maxAge: refreshMs });
  res.cookie(COOKIE_CSRF, randomToken(), { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: refreshMs });
}

export function clearSessionCookies(res: Response, cfg: AppConfig): void {
  const secure = cfg.cookieSecure;
  res.clearCookie(COOKIE_ACCESS, { httpOnly: true, secure, sameSite: "lax", path: "/api/v1" });
  res.clearCookie(COOKIE_REFRESH, { httpOnly: true, secure, sameSite: "strict", path: "/api/v1/auth" });
  res.clearCookie(COOKIE_CSRF, { httpOnly: false, secure, sameSite: "lax", path: "/" });
}

/** Pembatas laju in-memory (jendela geser). Cukup untuk satu instance; gunakan Redis bila di-scale-out. */
@Injectable()
export class RateLimitService {
  private readonly hits = new Map<string, number[]>();

  consume(key: string, limit: number, windowMs = 60_000): { ok: boolean; retryAfter: number } {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return { ok: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - (recent[0] ?? now))) / 1000)) };
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 20_000) this.prune(now, windowMs);
    return { ok: true, retryAfter: 0 };
  }

  private prune(now: number, windowMs: number): void {
    for (const [key, times] of this.hits) {
      if (times.every((t) => now - t >= windowMs)) this.hits.delete(key);
    }
  }
}

export function tooManyRequests(retryAfter: number): ApiException {
  return new ApiException(429, "RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi sebentar lagi.", { retryAfter });
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = req.ip ?? "unknown";
    const global = this.limiter.consume(`g:${ip}`, this.cfg.GLOBAL_RATE_LIMIT);
    if (!global.ok) throw tooManyRequests(global.retryAfter);
    const group = this.reflector.getAllAndOverride<string | undefined>(RATE_GROUP_KEY, [context.getHandler(), context.getClass()]);
    if (group === "auth") {
      const auth = this.limiter.consume(`a:${ip}`, this.cfg.AUTH_RATE_LIMIT);
      if (!auth.ok) throw tooManyRequests(auth.retryAfter);
    }
    return true;
  }
}

/** CSRF double-submit: header X-CSRF-Token harus sama dengan cookie nur_csrf untuk semua request yang mengubah data. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return true;
    if (this.reflector.getAllAndOverride<boolean | undefined>(SKIP_CSRF_KEY, [context.getHandler(), context.getClass()])) return true;
    const cookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE_CSRF];
    const header = req.header("x-csrf-token");
    if (!cookie || !header || !safeEqual(cookie, header)) throw new ApiException(403, "CSRF_INVALID", "Token CSRF tidak valid");
    return true;
  }
}

/** Autentikasi: JWT akses di cookie HttpOnly + sesi di database (pencabutan berlaku seketika). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean | undefined>(PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;
    const req = context.switchToHttp().getRequest<Request>();
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_ACCESS];
    const claims = token ? verifyAccessToken(this.cfg, token) : null;
    if (!claims) throw unauthorized();
    const session = await this.prisma.authSession.findFirst({
      where: { id: claims.sid, userId: claims.sub, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { user: { select: { role: true, isActive: true } } },
    });
    if (!session || !session.user.isActive) throw unauthorized();
    // Peran dibaca dari database, bukan dari token, sehingga perubahan peran berlaku langsung.
    req.auth = { userId: claims.sub, sessionId: claims.sid, role: session.user.role as Role };
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.auth || !roles.includes(req.auth.role)) throw forbidden();
    return true;
  }
}
