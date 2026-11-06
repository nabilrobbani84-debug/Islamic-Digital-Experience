/**
 * Presentasi basmalah. Beberapa sumber menaruh basmalah di dalam teks ayat 1 (mis. "basmalah + الٓمٓ"). Data tetap
 * verbatim di database dan API; hanya tampilan yang memisahkannya: basmalah sebagai kepala surah, ayat 1 berisi
 * teks yang tersisa. Awalan diberikan oleh backend (diambil dari data), bukan ditulis di frontend.
 */
export function splitBismillah<T extends { number: number; textUthmani: string }>(verses: readonly T[], prefix: string | null | undefined): T[] {
  if (!prefix) return [...verses];
  return verses.map((v) => {
    if (v.number !== 1 || !v.textUthmani.startsWith(`${prefix} `)) return v;
    const rest = v.textUthmani.slice(prefix.length).trimStart();
    return rest.length > 0 ? { ...v, textUthmani: rest } : v;
  });
}
