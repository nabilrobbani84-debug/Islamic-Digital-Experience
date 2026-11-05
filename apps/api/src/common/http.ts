import { createParamDecorator, ExecutionContext, HttpException, SetMetadata } from "@nestjs/common";
import type { Request } from "express";
import { z } from "zod";
import type { AuthContext, Role } from "./types";

/** Error aplikasi dengan kode mesin yang stabil; dipetakan ke envelope error oleh filter. */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super({ code, message, details }, status);
  }
}

export const unauthorized = (message = "Sesi tidak valid atau telah berakhir", code = "UNAUTHORIZED"): ApiException => new ApiException(401, code, message);
export const forbidden = (message = "Anda tidak memiliki izin untuk tindakan ini"): ApiException => new ApiException(403, "FORBIDDEN", message);
export const notFound = (message = "Data tidak ditemukan"): ApiException => new ApiException(404, "NOT_FOUND", message);

/** Validasi input pada batas kepercayaan. Gagal → 400 VALIDATION_ERROR dengan daftar masalah. */
export function parse<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApiException(
      400,
      "VALIDATION_ERROR",
      "Data permintaan tidak valid",
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    );
  }
  return result.data;
}

/** Respons yang membawa `meta` (versi dataset, sumber, lisensi). */
export class Enveloped<T> {
  constructor(
    readonly data: T,
    readonly meta: Record<string, unknown> = {},
  ) {}
}

export const PUBLIC_KEY = "nur:public";
export const SKIP_CSRF_KEY = "nur:skip-csrf";
export const ROLES_KEY = "nur:roles";
export const RATE_GROUP_KEY = "nur:rate-group";

/** Endpoint tanpa sesi (login, register, dll.). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_KEY, true);
/** Endpoint pra-sesi yang tidak memiliki cookie CSRF. */
export const SkipCsrf = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_CSRF_KEY, true);
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
export const RateGroup = (group: "auth"): MethodDecorator & ClassDecorator => SetMetadata(RATE_GROUP_KEY, group);

export const CurrentAuth = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthContext => {
  const req = ctx.switchToHttp().getRequest<Request>();
  if (!req.auth) throw unauthorized();
  return req.auth;
});
