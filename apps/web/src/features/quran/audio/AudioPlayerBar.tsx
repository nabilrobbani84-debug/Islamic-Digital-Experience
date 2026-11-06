import { Link } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, LoaderCircle, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { PLAYBACK_SPEEDS, useAudio } from "@/stores/audio";
import { formatDurationMs } from "@/lib/format";
import { cn } from "@/lib/cn";

function Seekbar() {
  const currentMs = useAudio((s) => s.currentMs);
  const durationMs = useAudio((s) => s.durationMs);
  const seekMs = useAudio((s) => s.seekMs);
  const max = Math.max(1, durationMs);
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-right text-[11px] text-muted tabular-nums">{formatDurationMs(currentMs)}</span>
      <input
        type="range"
        min={0}
        max={max}
        step={1000}
        value={Math.min(currentMs, max)}
        onChange={(e) => seekMs(Number(e.target.value))}
        aria-label="Posisi audio"
        aria-valuetext={`${formatDurationMs(currentMs)} dari ${formatDurationMs(durationMs)}`}
        className="h-1.5 flex-1 cursor-pointer accent-gold"
        disabled={durationMs === 0}
      />
      <span className="w-10 text-[11px] text-muted tabular-nums">{formatDurationMs(durationMs)}</span>
    </div>
  );
}

/**
 * Mini player yang selalu berada DI ATAS navigasi bawah (mobile) dan tidak menutupi konten,
 * karena AppLayout menambah padding bawah saat player aktif. Dapat diperluas untuk kontrol lengkap.
 */
export function AudioPlayerBar() {
  const status = useAudio((s) => s.status);
  const track = useAudio((s) => s.track);
  const message = useAudio((s) => s.message);
  const currentVerse = useAudio((s) => s.currentVerse);
  const repeat = useAudio((s) => s.repeat);
  const speed = useAudio((s) => s.speed);
  const volume = useAudio((s) => s.volume);
  const muted = useAudio((s) => s.muted);
  const expanded = useAudio((s) => s.expanded);
  const a = useAudio.getState;

  const visible = status !== "idle";
  const playing = status === "playing";

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          aria-label="Pemutar murottal"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-[440px]"
        >
          <div className="nur-glass rounded-2xl px-3 py-2.5 shadow-2xl sm:px-4">
            <div className="flex items-center gap-2">
              <IconButton
                label={playing ? "Jeda" : "Putar"}
                onClick={() => a().toggle()}
                disabled={status === "loading" || status === "unavailable"}
                className="bg-emerald-nur text-ivory hover:bg-emerald-deep"
                icon={status === "loading" ? <LoaderCircle className="size-5 animate-spin" /> : playing ? <Pause className="size-5" /> : <Play className="size-5" />}
              />
              <div className="min-w-0 flex-1">
                {track ? (
                  <Link to={`/quran/${track.surahNumber}${currentVerse ? `?ayat=${currentVerse}` : ""}`} className="block truncate text-sm font-semibold text-fg hover:underline">
                    QS. {track.surahName}
                    {currentVerse ? ` · Ayat ${currentVerse}` : ""}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-semibold text-fg">{status === "loading" ? "Memuat audio…" : "Murottal"}</p>
                )}
                <p className={cn("truncate text-xs", status === "error" || status === "unavailable" ? "text-amber-500" : "text-muted")} role={status === "error" ? "alert" : undefined}>
                  {message ?? (track ? `${track.qariName}${track.offline ? " · offline" : ""}` : "")}
                </p>
              </div>
              <IconButton size="sm" label={expanded ? "Ciutkan pemutar" : "Perluas pemutar"} aria-expanded={expanded} icon={expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />} onClick={() => a().setExpanded(!expanded)} />
              <IconButton size="sm" label="Tutup pemutar" icon={<X className="size-4" />} onClick={() => a().close()} />
            </div>
            <AnimatePresence initial={false}>
              {expanded && track && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-3 pt-3">
                    <Seekbar />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <IconButton size="sm" label={track.segments ? "Ayat sebelumnya" : "Mundur 10 detik"} icon={<SkipBack className="size-4" />} onClick={() => a().prevVerse()} />
                        <IconButton size="sm" label={track.segments ? "Ayat berikutnya" : "Maju 10 detik"} icon={<SkipForward className="size-4" />} onClick={() => a().nextVerse()} />
                        <IconButton
                          size="sm"
                          active={repeat !== "off"}
                          aria-pressed={repeat !== "off"}
                          label={repeat === "off" ? "Ulangi: mati" : repeat === "surah" ? "Ulangi surah" : "Ulangi ayat"}
                          icon={repeat === "ayah" ? <Repeat1 className="size-4" /> : <Repeat className="size-4" />}
                          onClick={() => a().cycleRepeat()}
                        />
                      </div>
                      <div className="flex items-center gap-1" role="group" aria-label="Kecepatan putar">
                        {PLAYBACK_SPEEDS.map((s) => (
                          <button key={s} type="button" aria-pressed={speed === s} onClick={() => a().setSpeed(s)} className={cn("h-8 rounded-lg px-2 text-xs font-semibold", speed === s ? "bg-gold/20 text-gold-text" : "text-muted hover:text-fg")}>
                            {s}×
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <IconButton size="sm" label={muted ? "Bunyikan" : "Bisukan"} icon={muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />} onClick={() => a().toggleMute()} />
                        <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(e) => a().setVolume(Number(e.target.value))} aria-label="Volume" className="w-20 accent-gold" />
                      </div>
                    </div>
                    {!track.segments && <p className="text-[11px] text-muted">Sinkronisasi per ayat belum tersedia untuk rekaman ini.</p>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
