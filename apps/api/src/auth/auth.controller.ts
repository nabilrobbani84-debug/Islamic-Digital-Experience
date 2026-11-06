import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { CurrentAuth, parse, Public, RateGroup, SkipCsrf } from "../common/http";
import type { AuthContext } from "../common/types";
import { clearSessionCookies } from "../common/security";
import { Inject } from "@nestjs/common";
import { CONFIG, type AppConfig } from "../config";
import { AuthService } from "./auth.service";

const email = z.string().trim().toLowerCase().min(1, "Email wajib diisi").max(255).email("Format email tidak valid");
const password = z
  .string()
  .min(8, "Minimal 8 karakter")
  .max(128, "Maksimal 128 karakter")
  .regex(/[A-Za-z]/, "Harus mengandung huruf")
  .regex(/\d/, "Harus mengandung angka");
const token = z.string().min(20).max(200);

const registerSchema = z.object({ name: z.string().trim().min(2, "Nama minimal 2 karakter").max(120), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(128), deviceName: z.string().trim().max(120).optional() });
const uuid = z.string().uuid();

@Controller("auth")
@Public()
@SkipCsrf()
@RateGroup("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: unknown) {
    return this.auth.register(parse(registerSchema, body));
  }

  @Post("login")
  @HttpCode(200)
  login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    return this.auth.login(req, res, parse(loginSchema, body));
  }

  @Post("refresh")
  @HttpCode(204)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.refresh(req, res);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req, res);
  }

  @Post("verify-email")
  @HttpCode(204)
  async verify(@Body() body: unknown): Promise<void> {
    await this.auth.verifyEmail(parse(z.object({ token }), body).token);
  }

  @Post("verify-email/resend")
  @HttpCode(204)
  async resend(@Body() body: unknown): Promise<void> {
    await this.auth.resendVerification(parse(z.object({ email }), body).email);
  }

  @Post("forgot-password")
  @HttpCode(204)
  async forgot(@Body() body: unknown): Promise<void> {
    await this.auth.forgotPassword(parse(z.object({ email }), body).email);
  }

  @Post("reset-password")
  @HttpCode(204)
  async reset(@Body() body: unknown): Promise<void> {
    const input = parse(z.object({ token, password }), body);
    await this.auth.resetPassword(input.token, input.password);
  }
}

@Controller("users/me")
export class UsersController {
  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly cfg: AppConfig,
  ) {}

  @Get()
  me(@CurrentAuth() auth: AuthContext) {
    return this.auth.me(auth.userId);
  }

  @Patch()
  update(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return this.auth.updateName(auth.userId, parse(z.object({ name: z.string().trim().min(2).max(120) }), body).name);
  }

  @Post("password")
  @HttpCode(204)
  async changePassword(@CurrentAuth() auth: AuthContext, @Body() body: unknown): Promise<void> {
    const input = parse(z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }), body);
    await this.auth.changePassword(auth.userId, auth.sessionId, input.currentPassword, input.newPassword);
  }

  @Get("sessions")
  sessions(@CurrentAuth() auth: AuthContext) {
    return this.auth.listSessions(auth.userId, auth.sessionId);
  }

  @Delete("sessions/:id")
  @HttpCode(204)
  async revoke(@CurrentAuth() auth: AuthContext, @Param("id") id: string, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.revokeSession(auth.userId, parse(uuid, id));
    if (id === auth.sessionId) clearSessionCookies(res, this.cfg);
  }
}
