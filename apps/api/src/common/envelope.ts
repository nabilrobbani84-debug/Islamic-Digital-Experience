import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Injectable, Logger, NestInterceptor, CallHandler, ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { map, type Observable } from "rxjs";
import { ApiException, Enveloped } from "./http";

const STATUS_CODES: Record<number, string> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "VALIDATION_ERROR",
  422: "VALIDATION_ERROR",
  429: "RATE_LIMITED",
};

/** Seragamkan semua error ke envelope { success:false, error:{ code, message, details } }. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500;
    let code = "SERVER_ERROR";
    let message = "Terjadi kesalahan pada server";
    let details: unknown;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      const body = exception.getResponse() as { message: string };
      message = body.message;
      details = exception.details;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code = STATUS_CODES[status] ?? "SERVER_ERROR";
      message = status === 404 ? "Data tidak ditemukan" : exception.message;
    } else if (typeof exception === "object" && exception !== null && "status" in exception && typeof (exception as { status: unknown }).status === "number") {
      // Error body-parser (JSON rusak, payload terlalu besar).
      status = (exception as { status: number }).status;
      code = STATUS_CODES[status] ?? "VALIDATION_ERROR";
      message = status === 413 ? "Ukuran permintaan terlalu besar" : "Permintaan tidak dapat dibaca";
    } else {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    }

    if (status === 429 && details && typeof details === "object" && "retryAfter" in details) {
      res.setHeader("Retry-After", String((details as { retryAfter: number }).retryAfter));
    }
    res.status(status).json({ success: false, error: { code, message, ...(details !== undefined ? { details } : {}) } });
  }
}

/** Bungkus respons sukses ke envelope { success:true, data, meta }. `undefined` = tanpa body (204). */
@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value === undefined) return undefined;
        if (value instanceof Enveloped) return { success: true, data: value.data, meta: value.meta };
        return { success: true, data: value, meta: {} };
      }),
    );
  }
}
