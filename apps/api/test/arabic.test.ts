import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { leadingPhrase } from "../src/common/arabic";

// Teks sintetis (bukan ayat Al-Qur'an): hanya untuk menguji perilaku pencocokan awalan.
const PHRASE = "كِتَابٌ مُبَارَكٌ";

describe("leadingPhrase", () => {
  it("mengembalikan potongan literal bila awalan sama persis", () => {
    assert.equal(leadingPhrase(`${PHRASE} نُورٌ`, PHRASE), PHRASE);
  });

  it("tetap cocok bila harakat berbeda, dan mengembalikan penulisan aslinya (tidak diubah)", () => {
    const variant = "كِتَّابٌ مُبَارَكٌ"; // tasydid tambahan pada huruf ta
    assert.notEqual(variant, PHRASE);
    assert.equal(leadingPhrase(`${variant} نُورٌ`, PHRASE), variant);
  });

  it("null bila teks tidak berawalan frasa itu", () => {
    assert.equal(leadingPhrase("نُورٌ هَادِيَةٌ", PHRASE), null);
    assert.equal(leadingPhrase(`نُورٌ ${PHRASE}`, PHRASE), null, "frasa harus di awal");
  });

  it("null bila batas kata tidak cocok (tidak memotong di tengah kata)", () => {
    assert.equal(leadingPhrase("كِتَابٌ مُبَارَكَةٌ نُورٌ", PHRASE), null);
  });

  it("null bila tidak ada sisa teks setelah frasa, agar ayat tidak menjadi kosong", () => {
    assert.equal(leadingPhrase(PHRASE, PHRASE), null);
    assert.equal(leadingPhrase(`${PHRASE} `, PHRASE), null);
  });

  it("null bila frasa kosong", () => {
    assert.equal(leadingPhrase("نُورٌ هَادِيَةٌ", ""), null);
  });
});
