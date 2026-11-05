import { Body, Controller, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { z } from "zod";
import { CurrentAuth, parse, Roles } from "../common/http";
import type { AuthContext } from "../common/types";
import { AdminService, createRevisionSchema } from "./admin.service";

const uuid = z.string().uuid();

/** Seluruh endpoint admin: ADMIN atau SUPER_ADMIN. Aturan yang lebih ketat diperiksa di service. */
@Controller("admin")
@Roles("ADMIN", "SUPER_ADMIN")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("datasets")
  datasets() {
    return this.admin.datasets();
  }

  @Post("datasets/:id/approve")
  @HttpCode(200)
  approve(@CurrentAuth() auth: AuthContext, @Param("id") id: string) {
    return this.admin.approveDataset(auth, parse(uuid, id));
  }

  @Get("content-sources")
  sources() {
    return this.admin.contentSources();
  }

  @Get("users")
  users() {
    return this.admin.users();
  }

  @Patch("users/:id")
  updateUser(@CurrentAuth() auth: AuthContext, @Param("id") id: string, @Body() body: unknown) {
    const patch = parse(z.object({ role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(), isActive: z.boolean().optional() }).refine((v) => v.role !== undefined || v.isActive !== undefined, "Tidak ada perubahan"), body);
    return this.admin.updateUser(auth, parse(uuid, id), patch);
  }

  @Get("audit-logs")
  audit() {
    return this.admin.auditLogs();
  }

  @Get("revisions")
  revisions() {
    return this.admin.revisions();
  }

  @Post("revisions")
  createRevision(@CurrentAuth() auth: AuthContext, @Body() body: unknown) {
    return this.admin.createRevision(auth, parse(createRevisionSchema, body));
  }

  @Post("revisions/:id/review")
  @HttpCode(200)
  review(@CurrentAuth() auth: AuthContext, @Param("id") id: string, @Body() body: unknown) {
    const input = parse(z.object({ decision: z.enum(["APPROVE", "REJECT"]), note: z.string().max(1000).optional() }), body);
    return this.admin.reviewRevision(auth, parse(uuid, id), input.decision, input.note);
  }

  @Get("sync-status")
  syncStatus() {
    return this.admin.syncStatus();
  }
}
