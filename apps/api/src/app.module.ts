import { Controller, Get, Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AdminController } from "./admin/admin.controller";
import { AdminService } from "./admin/admin.service";
import { AuthController, UsersController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { AllExceptionsFilter, EnvelopeInterceptor } from "./common/envelope";
import { Public } from "./common/http";
import { createMailer, MAILER } from "./common/mailer";
import { AuthGuard, CsrfGuard, RateLimitGuard, RateLimitService, RolesGuard } from "./common/security";
import { CONFIG, ConfigModule } from "./config";
import { KnowledgeController } from "./knowledge/knowledge.controller";
import { PrismaModule, PrismaService } from "./prisma/prisma.service";
import { QuranController } from "./quran/quran.controller";
import { QuranService } from "./quran/quran.service";
import { SyncController } from "./sync/sync.controller";
import { SyncService } from "./sync/sync.service";

@Controller("health")
@Public()
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
}

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [HealthController, AuthController, UsersController, QuranController, KnowledgeController, SyncController, AdminController],
  providers: [
    { provide: MAILER, useFactory: createMailer, inject: [CONFIG] },
    RateLimitService,
    AuthService,
    QuranService,
    SyncService,
    AdminService,
    // Urutan eksekusi guard global: laju → CSRF → autentikasi → peran.
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: EnvelopeInterceptor },
  ],
})
export class AppModule {}
