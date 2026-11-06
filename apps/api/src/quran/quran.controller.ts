import { Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { Enveloped, parse, Public } from "../common/http";
import { QuranService } from "./quran.service";

const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

@Controller()
@Public()
export class QuranController {
  constructor(private readonly quran: QuranService) {}

  @Get("quran/surahs")
  async surahs() {
    const { data, meta } = await this.quran.surahs();
    return new Enveloped(data, meta);
  }

  @Get("quran/editions")
  editions() {
    return this.quran.editions();
  }

  @Get("quran/surahs/:number")
  async surah(@Param("number") number: string, @Query("editionId") editionId?: string) {
    const { data, meta } = await this.quran.surah(parse(int(1, 114), number), editionId ? parse(z.string().uuid(), editionId) : undefined);
    return new Enveloped(data, meta);
  }

  @Get("quran/search")
  search(@Query("q") q?: string) {
    return this.quran.search(parse(z.string().min(2).max(100), q ?? ""));
  }

  @Get("quran/juz/:number")
  juz(@Param("number") number: string) {
    return this.quran.juz(parse(int(1, 30), number));
  }

  /** Kunci "surah:ayat", misalnya /tafsir/verses/2:255. */
  @Get("tafsir/verses/:key")
  tafsir(@Param("key") key: string) {
    const m = /^(\d{1,3}):(\d{1,3})$/.exec(key);
    if (!m) parse(z.never(), key);
    return this.quran.tafsir(Number(m?.[1]), Number(m?.[2]));
  }

  @Get("audio/qaris")
  qaris() {
    return this.quran.qaris();
  }

  @Get("audio/surah/:number")
  audio(@Param("number") number: string, @Query("qariId") qariId?: string) {
    return this.quran.audio(parse(int(1, 114), number), parse(z.string().uuid(), qariId));
  }
}
