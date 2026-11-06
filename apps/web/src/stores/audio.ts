import { create } from "zustand";
import { api, isApiError, userMessage } from "@/services/api";
import { cachedTrackUrl } from "@/services/audio/audio-cache";
import type { AudioSegment } from "@/types/domain";

export type RepeatMode = "off" | "surah" | "ayah";
export type PlayerStatus = "idle" | "loading" | "ready" | "playing" | "paused" | "error" | "unavailable";

export interface LoadedTrack {
  surahNumber: number;
  surahName: string;
  totalVerses: number;
  qariId: string;
  qariName: string;
  url: string;
  segments: AudioSegment[] | null;
  offline: boolean;
}

interface AudioState {
  status: PlayerStatus;
  track: LoadedTrack | null;
  message: string | null;
  currentMs: number;
  durationMs: number;
  speed: number;
  volume: number;
  muted: boolean;
  repeat: RepeatMode;
  currentVerse: number | null;
  expanded: boolean;
  load: (args: { surahNumber: number; surahName: string; totalVerses: number; qariId: string; qariName: string; autoplay?: boolean; startVerse?: number }) => Promise<void>;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  seekMs: (ms: number) => void;
  seekVerse: (verse: number) => void;
  nextVerse: () => void;
  prevVerse: () => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  cycleRepeat: () => void;
  setExpanded: (expanded: boolean) => void;
  close: () => void;
}

export const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5] as const;

let element: HTMLAudioElement | null = null;
let objectUrl: string | null = null;

function audio(): HTMLAudioElement {
  if (!element) {
    element = new Audio();
    element.preload = "metadata";
    bindElement(element);
  }
  return element;
}

function segmentFor(segments: AudioSegment[] | null, ms: number): AudioSegment | null {
  if (!segments) return null;
  return segments.find((s) => ms >= s.startMs && ms < s.endMs) ?? null;
}

export const useAudio = create<AudioState>()((set, get) => ({
  status: "idle",
  track: null,
  message: null,
  currentMs: 0,
  durationMs: 0,
  speed: 1,
  volume: 1,
  muted: false,
  repeat: "off",
  currentVerse: null,
  expanded: false,

  async load({ surahNumber, surahName, totalVerses, qariId, qariName, autoplay = true, startVerse }) {
    set({ status: "loading", message: null, track: null, currentMs: 0, durationMs: 0, currentVerse: null });
    try {
      const track = await api.audio.surah(surahNumber, qariId);
      const cached = await cachedTrackUrl(track.url);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = cached;
      const el = audio();
      el.src = cached ?? track.url;
      el.playbackRate = get().speed;
      const loaded: LoadedTrack = {
        surahNumber,
        surahName,
        totalVerses,
        qariId,
        qariName,
        url: track.url,
        segments: track.segments && track.segments.length > 0 ? track.segments : null,
        offline: cached !== null,
      };
      set({ track: loaded, status: "ready", durationMs: track.durationMs ?? 0 });
      updateMediaSession(loaded);
      if (startVerse && loaded.segments) get().seekVerse(startVerse);
      if (autoplay) get().play();
    } catch (error) {
      const unsupported = isApiError(error) && (error.code === "NOT_SUPPORTED" || error.status === 404 || error.status === 501);
      set({ status: unsupported ? "unavailable" : "error", message: unsupported ? "Audio untuk surah ini belum tersedia dari backend NUR." : userMessage(error) });
    }
  },

  toggle() {
    const { status } = get();
    if (status === "playing") get().pause();
    else get().play();
  },
  play() {
    if (!get().track) return;
    audio()
      .play()
      .catch(() => set({ status: "error", message: "Browser menolak memutar audio. Tekan tombol putar sekali lagi." }));
  },
  pause() {
    audio().pause();
  },
  seekMs(ms) {
    const el = audio();
    el.currentTime = Math.max(0, ms / 1000);
    set({ currentMs: ms });
  },
  seekVerse(verse) {
    const segment = get().track?.segments?.find((s) => s.verseNumber === verse);
    if (segment) get().seekMs(segment.startMs);
  },
  nextVerse() {
    const { track, currentVerse, currentMs } = get();
    if (track?.segments && currentVerse !== null) {
      get().seekVerse(Math.min(track.totalVerses, currentVerse + 1));
    } else get().seekMs(currentMs + 10_000);
  },
  prevVerse() {
    const { track, currentVerse, currentMs } = get();
    if (track?.segments && currentVerse !== null) {
      get().seekVerse(Math.max(1, currentVerse - 1));
    } else get().seekMs(Math.max(0, currentMs - 10_000));
  },
  setSpeed(speed) {
    audio().playbackRate = speed;
    set({ speed });
  },
  setVolume(volume) {
    const v = Math.max(0, Math.min(1, volume));
    audio().volume = v;
    set({ volume: v, muted: v === 0 });
  },
  toggleMute() {
    const muted = !get().muted;
    audio().muted = muted;
    set({ muted });
  },
  cycleRepeat() {
    const { repeat, track } = get();
    const order: RepeatMode[] = track?.segments ? ["off", "surah", "ayah"] : ["off", "surah"];
    const next = order[(order.indexOf(repeat) + 1) % order.length] ?? "off";
    audio().loop = next === "surah";
    set({ repeat: next });
  },
  setExpanded(expanded) {
    set({ expanded });
  },
  close() {
    const el = audio();
    el.pause();
    el.removeAttribute("src");
    el.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    set({ status: "idle", track: null, currentMs: 0, durationMs: 0, currentVerse: null, expanded: false, message: null });
  },
}));

function bindElement(el: HTMLAudioElement): void {
  el.addEventListener("playing", () => useAudio.setState({ status: "playing" }));
  el.addEventListener("pause", () => {
    if (useAudio.getState().status === "playing") useAudio.setState({ status: "paused" });
  });
  el.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(el.duration)) useAudio.setState({ durationMs: el.duration * 1000 });
  });
  el.addEventListener("timeupdate", () => {
    const state = useAudio.getState();
    const ms = el.currentTime * 1000;
    const segment = segmentFor(state.track?.segments ?? null, ms);
    if (state.repeat === "ayah" && state.currentVerse !== null) {
      const current = state.track?.segments?.find((s) => s.verseNumber === state.currentVerse);
      if (current && ms >= current.endMs - 80) {
        el.currentTime = current.startMs / 1000;
        return;
      }
    }
    useAudio.setState({ currentMs: ms, currentVerse: segment?.verseNumber ?? state.currentVerse });
  });
  el.addEventListener("ended", () => useAudio.setState({ status: "paused", currentMs: 0 }));
  el.addEventListener("error", () => {
    if (!el.getAttribute("src")) return;
    useAudio.setState({ status: "error", message: "File audio tidak dapat diputar. Coba lagi atau pilih qari lain." });
  });
}

function updateMediaSession(track: LoadedTrack): void {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: `QS. ${track.surahName}`, artist: track.qariName, album: "NUR — Murottal" });
  const s = useAudio.getState;
  navigator.mediaSession.setActionHandler("play", () => s().play());
  navigator.mediaSession.setActionHandler("pause", () => s().pause());
  navigator.mediaSession.setActionHandler("previoustrack", () => s().prevVerse());
  navigator.mediaSession.setActionHandler("nexttrack", () => s().nextVerse());
}
