import { describe, expect, it } from "vitest";
import { splitBismillah } from "./bismillah";

const verses = [
  { number: 1, textUthmani: "PREFIX sisa ayat satu" },
  { number: 2, textUthmani: "PREFIX bukan ayat pertama" },
];

describe("splitBismillah", () => {
  it("memisahkan awalan dari ayat 1 saja dan tidak mengubah ayat lain", () => {
    const out = splitBismillah(verses, "PREFIX");
    expect(out[0]?.textUthmani).toBe("sisa ayat satu");
    expect(out[1]?.textUthmani).toBe("PREFIX bukan ayat pertama");
  });

  it("tanpa awalan, atau awalan tidak cocok, data tidak berubah", () => {
    expect(splitBismillah(verses, null)).toEqual(verses);
    expect(splitBismillah(verses, undefined)).toEqual(verses);
    expect(splitBismillah(verses, "LAIN")).toEqual(verses);
  });

  it("tidak mengosongkan ayat: bila hanya berisi awalan, teks dibiarkan utuh", () => {
    const only = [{ number: 1, textUthmani: "PREFIX " }];
    expect(splitBismillah(only, "PREFIX")).toEqual(only);
  });

  it("tidak memutasi masukan", () => {
    const copy = JSON.parse(JSON.stringify(verses)) as typeof verses;
    splitBismillah(copy, "PREFIX");
    expect(copy).toEqual(verses);
  });
});
