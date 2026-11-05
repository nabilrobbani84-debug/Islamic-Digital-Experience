import { Injectable } from "@nestjs/common";
import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { ApiException } from "../common/http";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;
type Json = Prisma.InputJsonObject;

export const changeSchema = z.object({
  entityType: z.enum(["BOOKMARK", "READING_PROGRESS", "READING_HISTORY", "DHIKR_SESSION", "ZAKAT_CALCULATION", "PRAYER_LOCATION", "USER_SETTING", "USER_FAVORITE"]),
  entityId: z.string().min(1).max(64),
  operation: z.enum(["UPSERT", "DELETE"]),
  payload: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(8).max(100),
  baseVersion: z.number().int().min(0).nullable(),
  clientCreatedAt: z.string().datetime({ offset: true }),
});
export const pushSchema = z.object({ changes: z.array(changeSchema).min(1).max(100) });
type Change = z.infer<typeof changeSchema>;

export interface PushResultItem {
  idempotencyKey: string;
  status: "APPLIED" | "CONFLICT" | "REJECTED";
  resultVersion?: number | null;
  serverRecord?: Record<string, unknown> | null;
  reason?: string | null;
}

/** Hasil penerapan satu perubahan. `deliver=false` → tercatat tetapi tidak dikirim ke perangkat lain. */
interface Outcome {
  status: "APPLIED" | "CONFLICT" | "REJECTED";
  version?: number;
  reason?: string;
  serverRecord?: Record<string, unknown>;
  logPayload?: Json;
  deliver?: boolean;
}

const rejected = (reason: string): Outcome => ({ status: "REJECTED", reason });
const iso = z.string().datetime({ offset: true });
const money = z.string().regex(/^\d{1,18}(\.\d{1,2})?$/);
const uuid = z.string().uuid();

const bookmarkPayload = z.object({ surahNumber: z.number().int().min(1).max(114), verseNumber: z.number().int().min(1).max(286), note: z.string().max(1000).nullable().optional() });
const progressPayload = z.object({ surahNumber: z.number().int().min(1).max(114), verseNumber: z.number().int().min(1).max(286), updatedAt: iso });
const dhikrPayload = z.object({
  dhikrItemId: uuid.nullable().optional(),
  label: z.string().trim().min(1).max(120),
  count: z.number().int().min(0).max(1_000_000),
  targetCount: z.number().int().min(1).max(100_000),
  startedAt: iso,
  completedAt: iso.nullable().optional(),
});
const zakatPayload = z.object({
  type: z.enum(["FITRAH", "MAAL", "INCOME", "TRADE", "GOLD", "SILVER", "SAVINGS"]),
  totalAssets: money,
  deductibleDebt: money,
  netAssets: money,
  nisabValue: money,
  payableAmount: money,
  eligible: z.boolean(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("IDR"),
  ruleVersion: z.string().min(1).max(20),
  calculatedAt: iso,
});
const favoritePayload = z.object({ contentType: z.enum(["ASMAUL_HUSNA", "DHIKR_ITEM", "DAILY_DUA", "HADITH", "PRAYER_CONTENT"]), contentId: z.string().min(1).max(64) });

@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}

  async push(userId: string, sessionId: string, changes: Change[]): Promise<PushResultItem[]> {
    const results: PushResultItem[] = [];
    // Berurutan: urutan perubahan dari satu perangkat bermakna.
    for (const change of changes) results.push(await this.pushOne(userId, sessionId, change));
    return results;
  }

  private stored(row: { idempotencyKey: string; status: string; resultVersion: number | null; conflictReason: string | null }): PushResultItem {
    const status = row.status as PushResultItem["status"];
    // SUPERSEDED/NOOP adalah catatan internal; bagi klien perubahan ini tetap APPLIED.
    const internal = row.status === "APPLIED" && row.conflictReason !== null;
    return { idempotencyKey: row.idempotencyKey, status, resultVersion: row.resultVersion, reason: internal ? null : row.conflictReason };
  }

  private async pushOne(userId: string, sessionId: string, change: Change): Promise<PushResultItem> {
    const existing = await this.prisma.syncChange.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: change.idempotencyKey } } });
    if (existing) return this.stored(existing);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const outcome = await this.apply(tx, userId, change);
        const internalNote = outcome.status === "APPLIED" && outcome.deliver === false ? "SUPERSEDED" : null;
        await tx.syncChange.create({
          data: {
            userId,
            sessionId,
            entityType: change.entityType,
            entityId: change.entityId,
            operation: change.operation,
            payload: outcome.logPayload ?? (change.payload as Json),
            baseVersion: change.baseVersion,
            resultVersion: outcome.version ?? null,
            idempotencyKey: change.idempotencyKey,
            status: outcome.status,
            conflictReason: internalNote ?? outcome.reason ?? null,
            clientCreatedAt: new Date(change.clientCreatedAt),
          },
        });
        return {
          idempotencyKey: change.idempotencyKey,
          status: outcome.status,
          resultVersion: outcome.version ?? null,
          serverRecord: outcome.serverRecord ?? null,
          reason: outcome.reason ?? null,
        };
      });
    } catch (error) {
      // Dua permintaan dengan idempotency key sama berlomba: pemenang sudah tercatat.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await this.prisma.syncChange.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: change.idempotencyKey } } });
        if (winner) return this.stored(winner);
      }
      throw error;
    }
  }

  private async apply(tx: Tx, userId: string, change: Change): Promise<Outcome> {
    const invalid = (e: z.ZodError): Outcome => rejected(`INVALID_PAYLOAD:${e.issues[0]?.path.join(".") ?? ""}`);
    switch (change.entityType) {
      case "BOOKMARK": {
        const p = bookmarkPayload.safeParse(change.payload);
        return p.success ? this.bookmark(tx, userId, change, p.data) : invalid(p.error);
      }
      case "READING_PROGRESS": {
        const p = progressPayload.safeParse(change.payload);
        return p.success ? this.progress(tx, userId, change, p.data) : invalid(p.error);
      }
      case "DHIKR_SESSION": {
        const p = dhikrPayload.safeParse(change.payload);
        return p.success ? this.dhikr(tx, userId, change, p.data) : invalid(p.error);
      }
      case "ZAKAT_CALCULATION": {
        const p = zakatPayload.safeParse(change.payload);
        return p.success || change.operation === "DELETE" ? this.zakat(tx, userId, change, p.success ? p.data : null) : invalid(p.error);
      }
      case "USER_FAVORITE": {
        const p = favoritePayload.safeParse(change.payload);
        return p.success ? this.favorite(tx, userId, change, p.data) : invalid(p.error);
      }
      default:
        return rejected("UNSUPPORTED_ENTITY");
    }
  }

  // ---- Bookmark: catatan tidak boleh tertimpa diam-diam (konflik versi → CONFLICT) ----
  private async bookmark(tx: Tx, userId: string, c: Change, p: z.infer<typeof bookmarkPayload>): Promise<Outcome> {
    if (c.entityId !== `${p.surahNumber}:${p.verseNumber}`) return rejected("INVALID_ENTITY_ID");
    const verse = await tx.verse.findFirst({ where: { verseNumber: p.verseNumber, surah: { number: p.surahNumber } }, select: { id: true } });
    if (!verse) return rejected("VERSE_NOT_FOUND");
    const row = await tx.bookmark.findUnique({ where: { userId_verseId: { userId, verseId: verse.id } } });
    const note = p.note ?? null;
    const view = (r: { note: string | null; version: number }) => ({ note: r.note, version: r.version });

    if (c.operation === "DELETE") {
      if (!row || row.deletedAt) return { status: "APPLIED", version: row?.version ?? 0, deliver: false };
      if (c.baseVersion !== null && c.baseVersion !== row.version) return { status: "CONFLICT", version: row.version, reason: "VERSION_MISMATCH", serverRecord: view(row) };
      const updated = await tx.bookmark.update({ where: { id: row.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      return { status: "APPLIED", version: updated.version, logPayload: { surahNumber: p.surahNumber, verseNumber: p.verseNumber } };
    }

    const log = (r: { note: string | null; createdAt: Date; updatedAt: Date }): Json => ({ surahNumber: p.surahNumber, verseNumber: p.verseNumber, note: r.note, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(), deletedAt: null });
    if (!row) {
      const created = await tx.bookmark.create({ data: { userId, verseId: verse.id, note } });
      return { status: "APPLIED", version: created.version, logPayload: log(created) };
    }
    if (row.deletedAt) {
      const revived = await tx.bookmark.update({ where: { id: row.id }, data: { deletedAt: null, note, version: { increment: 1 } } });
      return { status: "APPLIED", version: revived.version, logPayload: log(revived) };
    }
    if (row.note === note) return { status: "APPLIED", version: row.version, deliver: false };
    if (c.baseVersion === row.version) {
      const updated = await tx.bookmark.update({ where: { id: row.id }, data: { note, version: { increment: 1 } } });
      return { status: "APPLIED", version: updated.version, logPayload: log(updated) };
    }
    return { status: "CONFLICT", version: row.version, reason: "VERSION_MISMATCH", serverRecord: view(row) };
  }

  // ---- Progres bacaan: posisi terbaru menang (berdasarkan waktu posisi, bukan waktu tiba) ----
  private async progress(tx: Tx, userId: string, c: Change, p: z.infer<typeof progressPayload>): Promise<Outcome> {
    if (c.operation === "DELETE") return rejected("UNSUPPORTED_OPERATION");
    const verse = await tx.verse.findFirst({ where: { verseNumber: p.verseNumber, surah: { number: p.surahNumber } }, select: { id: true, pageNumber: true, surahId: true } });
    if (!verse) return rejected("VERSE_NOT_FOUND");
    // Jam perangkat yang maju tidak boleh mengalahkan posisi sah berikutnya.
    const positionAt = new Date(Math.min(Date.parse(p.updatedAt), Date.now()));
    const [row, newest] = await Promise.all([
      tx.readingProgress.findUnique({ where: { userId_surahId: { userId, surahId: verse.surahId } } }),
      tx.readingProgress.aggregate({ where: { userId }, _max: { positionAt: true } }),
    ]);
    let version = row?.version ?? 1;
    if (!row) {
      const created = await tx.readingProgress.create({ data: { userId, surahId: verse.surahId, verseId: verse.id, lastPage: verse.pageNumber, positionAt } });
      version = created.version;
    } else if (positionAt >= row.positionAt) {
      const updated = await tx.readingProgress.update({ where: { id: row.id }, data: { verseId: verse.id, lastPage: verse.pageNumber, positionAt, version: { increment: 1 } } });
      version = updated.version;
    }
    const isNewest = !newest._max.positionAt || positionAt >= newest._max.positionAt;
    return { status: "APPLIED", version, deliver: isNewest, logPayload: { surahNumber: p.surahNumber, verseNumber: p.verseNumber, updatedAt: positionAt.toISOString() } };
  }

  // ---- Sesi dzikir: hitungan hanya naik (gabungkan, ambil yang terbesar) ----
  private async dhikr(tx: Tx, userId: string, c: Change, p: z.infer<typeof dhikrPayload>): Promise<Outcome> {
    if (!uuid.safeParse(c.entityId).success) return rejected("INVALID_ENTITY_ID");
    const row = await tx.dhikrSession.findUnique({ where: { id: c.entityId } });
    if (row && row.userId !== userId) return rejected("ID_CONFLICT");
    if (c.operation === "DELETE") {
      if (!row || row.deletedAt) return { status: "APPLIED", version: row?.version ?? 0, deliver: false };
      const gone = await tx.dhikrSession.update({ where: { id: row.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      return { status: "APPLIED", version: gone.version, logPayload: {} };
    }
    const item = p.dhikrItemId ? await tx.dhikrItem.findUnique({ where: { id: p.dhikrItemId }, select: { id: true } }) : null;
    const base = { dhikrItemId: item?.id ?? null, label: p.label, targetCount: p.targetCount, startedAt: new Date(p.startedAt) };
    const completedAt = p.completedAt ? new Date(p.completedAt) : null;
    const saved = row
      ? await tx.dhikrSession.update({
          where: { id: row.id },
          data: { ...base, count: Math.max(row.count, p.count), completedAt: row.completedAt ?? completedAt, deletedAt: null, version: { increment: 1 } },
        })
      : await tx.dhikrSession.create({ data: { id: c.entityId, userId, ...base, count: p.count, completedAt } });
    return {
      status: "APPLIED",
      version: saved.version,
      logPayload: { dhikrItemId: saved.dhikrItemId, label: saved.label, count: saved.count, targetCount: saved.targetCount, startedAt: saved.startedAt.toISOString(), completedAt: saved.completedAt?.toISOString() ?? null, updatedAt: saved.updatedAt.toISOString() },
    };
  }

  // ---- Riwayat zakat: catatan tidak berubah setelah dibuat (hanya dapat dihapus) ----
  private async zakat(tx: Tx, userId: string, c: Change, p: z.infer<typeof zakatPayload> | null): Promise<Outcome> {
    if (!uuid.safeParse(c.entityId).success) return rejected("INVALID_ENTITY_ID");
    const row = await tx.zakatCalculation.findUnique({ where: { id: c.entityId } });
    if (row && row.userId !== userId) return rejected("ID_CONFLICT");
    if (c.operation === "DELETE") {
      if (!row || row.deletedAt) return { status: "APPLIED", version: row?.version ?? 0, deliver: false };
      const gone = await tx.zakatCalculation.update({ where: { id: row.id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      return { status: "APPLIED", version: gone.version, logPayload: {} };
    }
    if (!p) return rejected("INVALID_PAYLOAD");
    if (row) return { status: "APPLIED", version: row.version, deliver: false };
    const created = await tx.zakatCalculation.create({
      data: { id: c.entityId, userId, type: p.type, ruleVersion: p.ruleVersion, totalAssets: p.totalAssets, deductibleDebt: p.deductibleDebt, netAssets: p.netAssets, nisabValue: p.nisabValue, payableAmount: p.payableAmount, eligible: p.eligible, currency: p.currency, calculatedAt: new Date(p.calculatedAt) },
    });
    return {
      status: "APPLIED",
      version: created.version,
      logPayload: { type: p.type, totalAssets: p.totalAssets, deductibleDebt: p.deductibleDebt, netAssets: p.netAssets, nisabValue: p.nisabValue, payableAmount: p.payableAmount, eligible: p.eligible, currency: p.currency, ruleVersion: p.ruleVersion, calculatedAt: p.calculatedAt, updatedAt: created.updatedAt.toISOString() },
    };
  }

  // ---- Favorit polimorfik: keberadaan konten divalidasi di sini (tidak ada FK) ----
  private async favoriteExists(tx: Tx, type: z.infer<typeof favoritePayload>["contentType"], id: string): Promise<boolean> {
    switch (type) {
      case "ASMAUL_HUSNA":
        return /^\d{1,3}$/.test(id) && (await tx.asmaulHusna.findUnique({ where: { number: Number(id) }, select: { id: true } })) !== null;
      case "HADITH":
        return /^\d{1,4}$/.test(id) && (await tx.hadith.findFirst({ where: { number: Number(id), collection: { status: "PUBLISHED" } }, select: { id: true } })) !== null;
      case "DAILY_DUA":
        return uuid.safeParse(id).success && (await tx.dailyDua.findUnique({ where: { id }, select: { id: true } })) !== null;
      case "DHIKR_ITEM":
        return uuid.safeParse(id).success && (await tx.dhikrItem.findUnique({ where: { id }, select: { id: true } })) !== null;
      case "PRAYER_CONTENT":
        return uuid.safeParse(id).success && (await tx.prayerContent.findUnique({ where: { id }, select: { id: true } })) !== null;
    }
  }

  private async favorite(tx: Tx, userId: string, c: Change, p: z.infer<typeof favoritePayload>): Promise<Outcome> {
    if (c.entityId !== `${p.contentType}:${p.contentId}`) return rejected("INVALID_ENTITY_ID");
    const key = { userId_contentType_contentId: { userId, contentType: p.contentType, contentId: p.contentId } };
    const row = await tx.userFavorite.findUnique({ where: key });
    if (c.operation === "DELETE") {
      if (!row || row.deletedAt) return { status: "APPLIED", version: row?.version ?? 0, deliver: false };
      const gone = await tx.userFavorite.update({ where: key, data: { deletedAt: new Date(), version: { increment: 1 } } });
      return { status: "APPLIED", version: gone.version, logPayload: { contentType: p.contentType, contentId: p.contentId } };
    }
    if (row && !row.deletedAt) return { status: "APPLIED", version: row.version, deliver: false };
    if (!(await this.favoriteExists(tx, p.contentType, p.contentId))) return rejected("CONTENT_NOT_FOUND");
    const saved = row
      ? await tx.userFavorite.update({ where: key, data: { deletedAt: null, version: { increment: 1 } } })
      : await tx.userFavorite.create({ data: { userId, contentType: p.contentType, contentId: p.contentId } });
    return { status: "APPLIED", version: saved.version, logPayload: { contentType: p.contentType, contentId: p.contentId, createdAt: saved.createdAt.toISOString() } };
  }

  /** Perubahan sejak `cursor` dari perangkat LAIN, berurutan. Klien menerapkan berurutan; yang terakhir menang. */
  async pull(userId: string, sessionId: string, cursor: bigint, limit: number) {
    const rows = await this.prisma.syncChange.findMany({
      where: { userId, seq: { gt: cursor }, status: "APPLIED", conflictReason: null, OR: [{ sessionId: null }, { sessionId: { not: sessionId } }] },
      orderBy: { seq: "asc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    let next = page.at(-1)?.seq ?? cursor;
    if (page.length === 0) {
      // Lewati perubahan milik perangkat ini agar tidak dipindai ulang.
      const latest = await this.prisma.syncChange.aggregate({ where: { userId }, _max: { seq: true } });
      next = latest._max.seq !== null && latest._max.seq > cursor ? latest._max.seq : cursor;
    }
    return {
      cursor: next.toString(),
      hasMore,
      changes: page.map((r) => ({ entityType: r.entityType, entityId: r.entityId, operation: r.operation, payload: r.payload as Record<string, unknown>, version: r.resultVersion ?? 0 })),
    };
  }
}

export function parseCursor(raw: string | undefined): bigint {
  if (raw === undefined || raw === "") return 0n;
  if (!/^\d{1,18}$/.test(raw)) throw new ApiException(400, "VALIDATION_ERROR", "Cursor tidak valid");
  return BigInt(raw);
}
