import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateDataset } from "../src/quran/dataset";
import { assignRanges, buildDataset, parseText, TanzilFormatError, type BuildInput } from "../src/quran/tanzil";

/** Fixture SINTETIS berformat Tanzil. Teks Arab generik (bukan ayat). */
const XML = `<?xml version="1.0" encoding="utf-8" ?>
<quran type="metadata" version="1.0" license="cc-by">
  <suras alias="chapters">
    <sura index="1" ayas="3" start="0" name="ا" tname="Satu" ename="First &amp; Foremost" type="Meccan" order="1" rukus="1" />
    <sura index="2" ayas="2" start="3" name="ب" tname="Dua" ename="Second" type="Medinan" order="2" rukus="1" />
  </suras>
  <juzs alias="parts"><juz index="1" sura="1" aya="1" /><juz index="2" sura="2" aya="1" /></juzs>
  <quarters><quarter index="1" sura="1" aya="1" /></quarters>
  <pages><page index="1" sura="1" aya="1" /><page index="2" sura="1" aya="3" /><page index="3" sura="2" aya="2" /></pages>
</quran>`;

const LINES = ["1|1|كِتَابٌ  مُبَارَكٌ", "1|2|عِلْمٌ نَافِعٌ", "1|3|قَلْبٌ سَلِيمٌ", "2|1|بِسْمِ اللَّهِ نُورٌ", "2|2|حِكْمَةٌ بَالِغَةٌ"];
const HEADER = "# Tanzil Quran Text (Uthmani, Version 9.9)\n# Copyright (C) Tanzil Project\n";
const TEXT = `${HEADER}${LINES.join("\n")}\n`;
const TRANSLATION = `# Name: Uji\n1|1|[TEST] satu\n1|2|[TEST] dua\n1|3|[TEST] tiga\n2|1|[TEST] empat\n2|2|[TEST] lima\n`;

const base = (over: Partial<BuildInput> = {}): BuildInput => ({ text: TEXT, metadata: XML, files: [{ name: "text.txt", sha256: "a".repeat(64) }, { name: "quran-data.xml", sha256: "b".repeat(64) }], ...over });

describe("konverter Tanzil → dataset NUR", () => {
  it("memetakan surah, tipe wahyu, halaman, juz, dan akhir juz dari metadata", () => {
    const d = buildDataset(base());
    assert.equal(d.surahs.length, 2);
    assert.equal(d.surahs[0]?.revelationType, "MAKKIYAH");
    assert.equal(d.surahs[1]?.revelationType, "MADANIYAH");
    assert.equal(d.surahs[0]?.meaning, "First & Foremost", "entitas XML didekode");
    assert.deepEqual(d.surahs.flatMap((s) => s.verses.map((v) => v.page)), [1, 1, 2, 2, 3]);
    assert.deepEqual(d.surahs.flatMap((s) => s.verses.map((v) => v.juz)), [1, 1, 1, 2, 2]);
    assert.deepEqual(d.juzs, [
      { number: 1, startSurah: 1, startVerse: 1, endSurah: 1, endVerse: 3 },
      { number: 2, startSurah: 2, startVerse: 1, endSurah: 2, endVerse: 2 },
    ]);
    assert.ok(d.surahs.every((s) => s.verses.every((v) => v.hizb === undefined)), "hizb tidak diisi bila perempat tidak lengkap (240)");
    assert.deepEqual(validateDataset(d, { partial: true }), []);
  });

  it("teks disalin VERBATIM: spasi ganda, harakat, dan basmalah di awal ayat tidak diubah", () => {
    const d = buildDataset(base());
    assert.equal(d.surahs[0]?.verses[0]?.textUthmani, "كِتَابٌ  مُبَارَكٌ");
    assert.equal(d.surahs[1]?.verses[0]?.textUthmani, "بِسْمِ اللَّهِ نُورٌ");
    for (const [i, line] of LINES.entries()) {
      const text = d.surahs.flatMap((s) => s.verses)[i]?.textUthmani;
      assert.equal(text, line.split("|").slice(2).join("|"));
    }
  });

  it("CRLF dan BOM tidak memengaruhi hasil", () => {
    const plain = buildDataset(base());
    const windows = buildDataset(base({ text: `\uFEFF${TEXT.replace(/\n/g, "\r\n")}` }));
    assert.deepEqual(windows.surahs, plain.surahs);
  });

  it("atribusi memuat blok hak cipta asli dan SHA-256 berkas sumber; versi dari header", () => {
    const d = buildDataset(base());
    assert.match(d.source.attribution ?? "", /Copyright \(C\) Tanzil Project/);
    assert.match(d.source.attribution ?? "", /text\.txt sha256=a{64}/);
    assert.match(d.source.license, /verbatim/);
    assert.equal(d.version, "tanzil-uthmani-9.9");
  });

  it("terjemahan: lengkap dan berurutan; lisensi wajib eksplisit", () => {
    const tr = { name: "Uji", language: "id", license: "LISENSI-UJI", text: TRANSLATION, fileSha256: "c".repeat(64) };
    const d = buildDataset(base({ translation: tr }));
    assert.equal(d.translations.length, 1);
    assert.equal(d.translations[0]?.items.length, 5);
    assert.equal(d.translations[0]?.source.license, "LISENSI-UJI");
    assert.deepEqual(validateDataset(d, { partial: true }), []);
    assert.throws(() => buildDataset(base({ translation: { ...tr, license: "  " } })), /Lisensi terjemahan/);
    assert.throws(() => buildDataset(base({ translation: { ...tr, text: TRANSLATION.replace("2|2|[TEST] lima\n", "") } })), /4 ayat/);
    assert.throws(() => buildDataset(base({ translation: { ...tr, text: TRANSLATION.replace("1|2|[TEST] dua\n1|3|[TEST] tiga\n", "1|3|[TEST] tiga\n1|2|[TEST] dua\n") } })), /tidak berurutan/);
  });

  it("menolak data yang tidak konsisten dengan metadata", () => {
    const fail = (input: BuildInput, pattern: RegExp): void => assert.throws(() => buildDataset(input), (e: unknown) => e instanceof TanzilFormatError && pattern.test(e.message));
    fail(base({ text: `${TEXT}2|3|ekstra\n` }), /6 ayat, metadata 5/);
    fail(base({ text: TEXT.replace("1|3|قَلْبٌ سَلِيمٌ\n", "") }), /4 ayat, metadata 5/);
    fail(base({ text: TEXT.replace("1|2|", "1|3|") }), /tidak berurutan/);
    fail(base({ text: `${TEXT}rusak tanpa pemisah\n` }), /bukan "surah\|ayat\|teks"/);
    fail(base({ metadata: XML.replace('start="3"', 'start="4"') }), /start=4, seharusnya 3/);
    fail(base({ metadata: XML.replace('type="Meccan"', 'type="Lain"') }), /type "Lain"/);
    fail(base({ metadata: XML.replace('<page index="1" sura="1" aya="1" />', "") }), /index 2/);
    fail(base({ metadata: XML.replace('<page index="2" sura="1" aya="3" />', '<page index="2" sura="1" aya="1" />') }), /tidak menaik/);
    fail(base({ metadata: XML.replace('<juz index="2" sura="2" aya="1" />', '<juz index="2" sura="2" aya="9" />') }), /di luar metadata/);
  });

  it("parseText: baris kosong dan komentar diabaikan, pemisah | di dalam teks dipertahankan", () => {
    const { entries, header } = parseText("# c1\n\n1|1|a|b\n  \n# c2\n1|2|c\n");
    assert.deepEqual(entries, [{ sura: 1, aya: 1, text: "a|b" }, { sura: 1, aya: 2, text: "c" }]);
    assert.equal(header, "# c1\n# c2");
  });

  it("assignRanges memetakan posisi ke nomor rentang", () => {
    assert.deepEqual(assignRanges([0, 4, 8], 12), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
    assert.deepEqual(assignRanges([0], 3), [1, 1, 1]);
  });
});
