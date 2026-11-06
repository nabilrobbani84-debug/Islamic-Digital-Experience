/**
 * Mengubah berkas Tanzil menjadi dataset NUR (JSON) yang siap diimpor.
 *
 *   node dist/scripts/tanzil-build.js --text quran-uthmani.txt --metadata quran-data.xml \
 *     [--translation id.indonesian.txt --translation-name "Bahasa Indonesia" --translation-language id \
 *      --translation-license "<lisensi terjemahan>"] --out quran.json
 *
 * Unduh berkas dari https://tanzil.net setelah membaca dan menyetujui ketentuannya sendiri
 * (teks: salinan verbatim, atribusi wajib). Skrip ini TIDAK mengunduh apa pun dan tidak mengubah teks.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { validateDataset } from "../src/quran/dataset";
import { buildDataset, sha256Hex, type SourceFile } from "../src/quran/tanzil";

const flag = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const need = (name: string): string => {
  const v = flag(name);
  if (!v) throw new Error(`Argumen --${name} wajib diisi`);
  return v;
};

function main(): void {
  const textPath = need("text");
  const metaPath = need("metadata");
  const out = need("out");
  const textBuf = readFileSync(textPath);
  const metaBuf = readFileSync(metaPath);
  const files: SourceFile[] = [
    { name: basename(textPath), sha256: sha256Hex(textBuf) },
    { name: basename(metaPath), sha256: sha256Hex(metaBuf) },
  ];

  const trPath = flag("translation");
  let translation: Parameters<typeof buildDataset>[0]["translation"];
  if (trPath) {
    const buf = readFileSync(trPath);
    const fileSha256 = sha256Hex(buf);
    files.push({ name: basename(trPath), sha256: fileSha256 });
    translation = { name: need("translation-name"), language: need("translation-language"), license: need("translation-license"), sourceName: flag("translation-source"), text: buf.toString("utf8"), fileSha256 };
  }

  const dataset = buildDataset({ text: textBuf.toString("utf8"), metadata: metaBuf.toString("utf8"), files, translation });
  const problems = validateDataset(dataset);
  if (problems.length > 0) throw new Error(`Validasi dataset gagal:\n${problems.map((p) => `  - ${p}`).join("\n")}`);

  writeFileSync(out, JSON.stringify(dataset));
  const verses = dataset.surahs.reduce((n, s) => n + s.verses.length, 0);
  console.log(`Dataset ditulis ke ${out}: ${dataset.surahs.length} surah, ${verses} ayat, ${dataset.juzs.length} juz, ${dataset.translations.length} terjemahan`);
  console.log(`versi ${dataset.version}; sha256(JSON)=${sha256Hex(readFileSync(out))}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
