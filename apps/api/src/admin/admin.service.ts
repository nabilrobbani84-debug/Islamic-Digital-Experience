import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { ApiException, forbidden, notFound } from "../common/http";
import type { AuthContext } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

const source = z.string().trim().min(3, "Sumber/referensi wajib diisi").max(500);
const text = z.string().trim().min(1).max(10_000);

/** Jenis konten yang penerapannya sudah didukung backend. Jenis lain ditolak saat pengajuan, bukan diterbitkan tanpa efek. */
const REVISION_SCHEMAS = {
  DAILY_DUA: z.object({ title: z.string().trim().min(2).max(200), arabicText: text, transliteration: text, translation: text, source }),
  DHIKR_ITEM: z.object({ categoryId: z.number().int().positive(), arabicText: text, transliteration: text, translation: text, recommendedCount: z.number().int().min(1).max(10_000), source }),
  ASMAUL_HUSNA: z.object({ number: z.number().int().min(1).max(99), arabicName: z.string().trim().min(1).max(100), transliteration: z.string().trim().min(1).max(100), meaning: z.string().trim().min(1).max(300), explanation: z.string().max(5000).optional(), source }),
} as const;
type SupportedType = keyof typeof REVISION_SCHEMAS;

export const createRevisionSchema = z.object({
  entityType: z.string().min(1).max(60),
  entityId: z.string().max(64).nullable(),
  action: z.enum(["CREATE", "UPDATE", "DELETE"]),
  payload: z.record(z.string(), z.unknown()),
});

const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  private audit(tx: Prisma.TransactionClient | PrismaService, actorId: string, action: string, entityType: string, entityId: string | null, metadata?: Prisma.InputJsonObject) {
    return tx.adminAuditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
  }

  async overview() {
    const since = new Date(Date.now() - 86_400_000);
    const [users, activeSessions, publishedDatasets, pendingRevisions, pendingSyncConflicts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.authSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.datasetVersion.count({ where: { status: "PUBLISHED" } }),
      this.prisma.contentRevision.count({ where: { status: "REVIEW" } }),
      this.prisma.syncChange.count({ where: { status: "CONFLICT", createdAt: { gte: since } } }),
    ]);
    return { users, activeSessions, publishedDatasets, pendingRevisions, pendingSyncConflicts };
  }

  private datasetDto(d: { id: string; datasetName: string; version: string; checksum: string; recordCount: number | null; status: string; source: string | null; importedAt: Date; approvedAt: Date | null }) {
    return { id: d.id, datasetName: d.datasetName, version: d.version, checksum: d.checksum, recordCount: d.recordCount, status: d.status, source: d.source, importedAt: d.importedAt.toISOString(), approvedAt: iso(d.approvedAt) };
  }

  async datasets() {
    const rows = await this.prisma.datasetVersion.findMany({ orderBy: { importedAt: "desc" }, take: 200 });
    return rows.map((d) => this.datasetDto(d));
  }

  /** Persetujuan manusia sebelum dataset dilayani ke pengguna. Versi terbit sebelumnya diarsipkan. */
  async approveDataset(auth: AuthContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const ds = await tx.datasetVersion.findUnique({ where: { id } });
      if (!ds) throw notFound("Dataset tidak ditemukan");
      if (ds.status === "PUBLISHED") throw new ApiException(409, "CONFLICT", "Dataset sudah terbit");
      if (ds.status === "ARCHIVED") throw new ApiException(409, "CONFLICT", "Dataset sudah diarsipkan");
      await tx.datasetVersion.updateMany({ where: { datasetName: ds.datasetName, status: "PUBLISHED" }, data: { status: "ARCHIVED" } });
      const approved = await tx.datasetVersion.update({ where: { id }, data: { status: "PUBLISHED", approvedById: auth.userId, approvedAt: new Date() } });
      // Persetujuan dataset terjemahan sekaligus menerbitkan edisi terkait.
      const prefix = "quran-translation:";
      if (ds.datasetName.startsWith(prefix)) {
        await tx.quranEdition.updateMany({ where: { name: ds.datasetName.slice(prefix.length), version: ds.version }, data: { status: "PUBLISHED", publishedAt: new Date() } });
      }
      await this.audit(tx, auth.userId, "DATASET_PUBLISHED", "DatasetVersion", id, { datasetName: ds.datasetName, version: ds.version, checksum: ds.checksum });
      return this.datasetDto(approved);
    });
  }

  async contentSources() {
    const rows = await this.prisma.contentSource.findMany({ orderBy: { name: "asc" } });
    return rows.map((s) => ({ id: s.id, name: s.name, publisher: s.publisher, license: s.license, attribution: s.attribution, licenseVerifiedAt: iso(s.licenseVerifiedAt) }));
  }

  private userDto(u: { id: string; name: string; email: string; role: string; isActive: boolean; emailVerifiedAt: Date | null; createdAt: Date }) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, isActive: u.isActive, emailVerified: u.emailVerifiedAt !== null, createdAt: u.createdAt.toISOString() };
  }

  async users() {
    const rows = await this.prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    return rows.map((u) => this.userDto(u));
  }

  async updateUser(auth: AuthContext, id: string, patch: { role?: "USER" | "ADMIN" | "SUPER_ADMIN"; isActive?: boolean }) {
    if (id === auth.userId) throw new ApiException(400, "VALIDATION_ERROR", "Tidak dapat mengubah akun sendiri");
    if (patch.role !== undefined && auth.role !== "SUPER_ADMIN") throw forbidden("Hanya Super Admin yang dapat mengubah peran");
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id } });
      if (!target) throw notFound("Pengguna tidak ditemukan");
      if (auth.role === "ADMIN" && target.role !== "USER") throw forbidden("Admin hanya dapat mengelola akun pengguna biasa");
      const updated = await tx.user.update({ where: { id }, data: { ...(patch.role !== undefined ? { role: patch.role } : {}), ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}) } });
      if (patch.isActive === false) {
        await tx.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokeReason: "ACCOUNT_DEACTIVATED" } });
      }
      if (patch.role !== undefined && patch.role !== target.role) await this.audit(tx, auth.userId, "USER_ROLE_CHANGED", "User", id, { from: target.role, to: patch.role });
      if (patch.isActive !== undefined && patch.isActive !== target.isActive) await this.audit(tx, auth.userId, patch.isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED", "User", id);
      return this.userDto(updated);
    });
  }

  async auditLogs() {
    const rows = await this.prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { name: true } } } });
    return rows.map((l) => ({ id: l.id, actorName: l.actor.name, action: l.action, entityType: l.entityType, entityId: l.entityId, createdAt: l.createdAt.toISOString() }));
  }

  private revisionDto(r: { id: string; entityType: string; entityId: string | null; action: string; status: string; payload: unknown; reviewNote: string | null; createdAt: Date; author: { name: string }; reviewer: { name: string } | null }) {
    return { id: r.id, entityType: r.entityType, entityId: r.entityId, action: r.action, status: r.status, payload: r.payload, authorName: r.author.name, reviewerName: r.reviewer?.name ?? null, reviewNote: r.reviewNote, createdAt: r.createdAt.toISOString() };
  }

  async revisions() {
    const rows = await this.prisma.contentRevision.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { author: { select: { name: true } }, reviewer: { select: { name: true } } } });
    return rows.map((r) => this.revisionDto(r));
  }

  async createRevision(auth: AuthContext, input: z.infer<typeof createRevisionSchema>) {
    const schema = REVISION_SCHEMAS[input.entityType as SupportedType];
    if (!schema) throw new ApiException(422, "NOT_SUPPORTED", `Jenis konten ${input.entityType} belum didukung untuk revisi. Didukung: ${Object.keys(REVISION_SCHEMAS).join(", ")}.`);
    if (input.action !== "DELETE") {
      const parsed = schema.safeParse(input.payload);
      if (!parsed.success) throw new ApiException(400, "VALIDATION_ERROR", "Payload revisi tidak valid", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
    }
    if (input.action !== "CREATE" && !input.entityId) throw new ApiException(400, "VALIDATION_ERROR", "entityId wajib untuk UPDATE/DELETE");
    const created = await this.prisma.$transaction(async (tx) => {
      const rev = await tx.contentRevision.create({
        data: { entityType: input.entityType, entityId: input.action === "CREATE" ? null : input.entityId, action: input.action, payload: input.payload as Prisma.InputJsonObject, status: "REVIEW", authorId: auth.userId },
        include: { author: { select: { name: true } }, reviewer: { select: { name: true } } },
      });
      await this.audit(tx, auth.userId, "REVISION_SUBMITTED", input.entityType, rev.id);
      return rev;
    });
    return this.revisionDto(created);
  }

  async reviewRevision(auth: AuthContext, id: string, decision: "APPROVE" | "REJECT", note?: string) {
    return this.prisma.$transaction(async (tx) => {
      const rev = await tx.contentRevision.findUnique({ where: { id } });
      if (!rev) throw notFound("Revisi tidak ditemukan");
      if (rev.status !== "REVIEW") throw new ApiException(409, "CONFLICT", "Revisi tidak sedang menunggu review");
      if (rev.authorId === auth.userId) throw new ApiException(400, "VALIDATION_ERROR", "Reviewer harus berbeda dari penulis revisi");

      if (decision === "APPROVE") await this.applyRevision(tx, rev.entityType as SupportedType, rev.action, rev.entityId, rev.payload as Record<string, unknown>);
      const now = new Date();
      const updated = await tx.contentRevision.update({
        where: { id },
        data: decision === "APPROVE" ? { status: "PUBLISHED", reviewerId: auth.userId, reviewedAt: now, publishedAt: now, reviewNote: note ?? null } : { status: "DRAFT", reviewerId: auth.userId, reviewedAt: now, reviewNote: note ?? null },
        include: { author: { select: { name: true } }, reviewer: { select: { name: true } } },
      });
      await this.audit(tx, auth.userId, decision === "APPROVE" ? "REVISION_PUBLISHED" : "REVISION_REJECTED", rev.entityType, id, { target: rev.entityId });
      return this.revisionDto(updated);
    });
  }

  /** Menerapkan payload ke tabel konten dalam transaksi yang sama dengan persetujuan. */
  private async applyRevision(tx: Prisma.TransactionClient, type: SupportedType, action: string, entityId: string | null, payload: Record<string, unknown>): Promise<void> {
    const schema = REVISION_SCHEMAS[type];
    if (!schema) throw new ApiException(422, "NOT_SUPPORTED", "Jenis konten belum didukung");
    const data = action === "DELETE" ? null : schema.parse(payload);
    switch (type) {
      case "DAILY_DUA": {
        if (action === "CREATE") await tx.dailyDua.create({ data: { ...(data as z.infer<(typeof REVISION_SCHEMAS)["DAILY_DUA"]>), status: "PUBLISHED" } });
        else if (action === "UPDATE") await tx.dailyDua.update({ where: { id: entityId ?? "" }, data: { ...(data as z.infer<(typeof REVISION_SCHEMAS)["DAILY_DUA"]>), status: "PUBLISHED" } });
        else await tx.dailyDua.update({ where: { id: entityId ?? "" }, data: { status: "ARCHIVED" } });
        return;
      }
      case "DHIKR_ITEM": {
        if (action === "CREATE") await tx.dhikrItem.create({ data: { ...(data as z.infer<(typeof REVISION_SCHEMAS)["DHIKR_ITEM"]>), status: "PUBLISHED" } });
        else if (action === "UPDATE") await tx.dhikrItem.update({ where: { id: entityId ?? "" }, data: { ...(data as z.infer<(typeof REVISION_SCHEMAS)["DHIKR_ITEM"]>), status: "PUBLISHED" } });
        else await tx.dhikrItem.update({ where: { id: entityId ?? "" }, data: { status: "ARCHIVED" } });
        return;
      }
      case "ASMAUL_HUSNA": {
        const d = data as z.infer<(typeof REVISION_SCHEMAS)["ASMAUL_HUSNA"]> | null;
        if (action === "CREATE" && d) await tx.asmaulHusna.create({ data: { ...d, status: "PUBLISHED" } });
        else if (action === "UPDATE" && d) await tx.asmaulHusna.update({ where: { number: Number(entityId) }, data: { ...d, status: "PUBLISHED" } });
        else await tx.asmaulHusna.update({ where: { number: Number(entityId) }, data: { status: "ARCHIVED" } });
        return;
      }
    }
  }

  async syncStatus() {
    const since = new Date(Date.now() - 86_400_000);
    const [changes, conflicts, rejected, last] = await Promise.all([
      this.prisma.syncChange.count({ where: { createdAt: { gte: since } } }),
      this.prisma.syncChange.count({ where: { createdAt: { gte: since }, status: "CONFLICT" } }),
      this.prisma.syncChange.count({ where: { createdAt: { gte: since }, status: "REJECTED" } }),
      this.prisma.syncChange.aggregate({ _max: { createdAt: true } }),
    ]);
    return { changesLast24h: changes, conflictsLast24h: conflicts, rejectedLast24h: rejected, lastChangeAt: iso(last._max.createdAt) };
  }
}
