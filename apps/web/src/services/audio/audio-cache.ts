import type { AudioTrack } from "@/types/domain";
import { db } from "@/services/offline/db";

const CACHE_NAME = "nur-audio-v1";

export class AudioIntegrityError extends Error {
  constructor() {
    super("Checksum audio tidak cocok. File tidak disimpan.");
    this.name = "AudioIntegrityError";
  }
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function audioCacheSupported(): boolean {
  return typeof caches !== "undefined";
}

/** Mengunduh audio surah ke Cache Storage dan memverifikasi checksum jika tersedia dari backend. */
export async function downloadTrack(track: AudioTrack, onProgress?: (ratio: number) => void): Promise<void> {
  if (!audioCacheSupported()) throw new Error("Browser tidak mendukung penyimpanan audio offline.");
  const response = await fetch(track.url, { credentials: "include" });
  if (!response.ok || !response.body) throw new Error(`Gagal mengunduh audio (${response.status})`);
  const total = Number(response.headers.get("Content-Length") ?? 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (total > 0) onProgress?.(received / total);
  }
  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let verified = false;
  if (track.checksum) {
    const hash = await sha256Hex(buffer.buffer);
    if (hash !== track.checksum.toLowerCase()) throw new AudioIntegrityError();
    verified = true;
  }
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    track.url,
    new Response(new Blob([buffer], { type: response.headers.get("Content-Type") ?? "audio/mpeg" })),
  );
  await db.audio_metadata.put({
    key: `${track.qariId}:${track.surahNumber}`,
    qariId: track.qariId,
    surahNumber: track.surahNumber,
    url: track.url,
    sizeBytes: received,
    checksum: track.checksum ?? null,
    verified,
    downloadedAt: new Date().toISOString(),
  });
  onProgress?.(1);
}

/** URL blob dari cache offline, atau null jika belum diunduh. */
export async function cachedTrackUrl(url: string): Promise<string | null> {
  if (!audioCacheSupported()) return null;
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(url);
  if (!match) return null;
  return URL.createObjectURL(await match.blob());
}

export async function removeCachedTrack(key: string): Promise<void> {
  const row = await db.audio_metadata.get(key);
  if (!row) return;
  if (audioCacheSupported()) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(row.url);
  }
  await db.audio_metadata.delete(key);
}

export async function clearAudioCache(): Promise<void> {
  if (audioCacheSupported()) await caches.delete(CACHE_NAME);
  await db.audio_metadata.clear();
}
