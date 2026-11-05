import { Controller, Get } from "@nestjs/common";
import { Enveloped, Public } from "../common/http";
import { PrismaService } from "../prisma/prisma.service";

/** Konten ibadah. Hanya baris berstatus PUBLISHED yang dilayani. */
@Controller()
@Public()
export class KnowledgeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("dhikr")
  async dhikr() {
    const [categories, items] = await Promise.all([
      this.prisma.dhikrCategory.findMany({ orderBy: { id: "asc" } }),
      this.prisma.dhikrItem.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ categoryId: "asc" }, { transliteration: "asc" }] }),
    ]);
    return new Enveloped({
      categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description })),
      items: items.map((i) => ({
        id: i.id,
        categoryId: i.categoryId,
        arabicText: i.arabicText,
        transliteration: i.transliteration,
        translation: i.translation,
        recommendedCount: i.recommendedCount,
        source: i.source,
      })),
    });
  }

  @Get("duas")
  async duas() {
    const rows = await this.prisma.dailyDua.findMany({
      where: { status: "PUBLISHED" },
      include: { categories: { include: { category: true } } },
      orderBy: { title: "asc" },
    });
    return new Enveloped(
      rows.map((d) => ({
        id: d.id,
        title: d.title,
        arabicText: d.arabicText,
        transliteration: d.transliteration,
        translation: d.translation,
        source: d.source,
        categories: d.categories.map((c) => c.category.name),
      })),
    );
  }

  @Get("hadith/nawawi")
  async hadith() {
    const collection = await this.prisma.hadithCollection.findFirst({
      where: { status: "PUBLISHED", name: { contains: "Arba", mode: "insensitive" } },
      include: { contentSource: true },
      orderBy: { name: "asc" },
    });
    if (!collection) return new Enveloped([]);
    const rows = await this.prisma.hadith.findMany({ where: { collectionId: collection.id }, include: { explanations: { take: 1 } }, orderBy: { number: "asc" } });
    return new Enveloped(
      rows.map((h) => ({
        number: h.number,
        title: null,
        arabicText: h.arabicText,
        translation: h.translation,
        narrator: h.narrator,
        reference: h.reference,
        explanation: h.explanations[0]?.explanation ?? null,
        lessons: h.explanations[0]?.lessons ?? null,
      })),
      { source: collection.contentSource?.name ?? collection.source ?? undefined, license: collection.contentSource?.license ?? undefined },
    );
  }

  @Get("asmaul-husna")
  async asmaulHusna() {
    const rows = await this.prisma.asmaulHusna.findMany({ where: { status: "PUBLISHED" }, orderBy: { number: "asc" } });
    return new Enveloped(
      rows.map((n) => ({ number: n.number, arabicName: n.arabicName, transliteration: n.transliteration, meaning: n.meaning, explanation: n.explanation, source: n.source, audioUrl: null })),
    );
  }
}
