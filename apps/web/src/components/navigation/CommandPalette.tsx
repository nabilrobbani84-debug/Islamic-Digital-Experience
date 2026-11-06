import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, Search } from "lucide-react";
import { ALL_NAV } from "@/app/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/cn";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  to: string;
  keywords: string[];
}

const STATIC_COMMANDS: CommandItem[] = [
  ...ALL_NAV.map((n) => ({ id: n.to, label: n.label, description: n.description, to: n.to, keywords: n.keywords ?? [] })),
  { id: "profile", label: "Profil & riwayat", description: "Bookmark, riwayat baca, dzikir, zakat", to: "/profile", keywords: ["akun", "bookmark", "riwayat"] },
  { id: "settings", label: "Pengaturan", description: "Tampilan, 3D, notifikasi", to: "/settings", keywords: ["tema", "font", "3d"] },
  { id: "offline", label: "Data offline", description: "Unduh Al-Qur'an & audio untuk offline", to: "/settings/offline-data", keywords: ["unduh", "download", "offline", "cache"] },
];

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f']/g, "");
}

/** Panel perintah global (Ctrl/⌘+K). Ketik nomor surah untuk langsung membuka surah. */
export function CommandPalette() {
  const open = useUi((s) => s.commandOpen);
  const setOpen = useUi((s) => s.setCommandOpen);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useUi.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    const items: CommandItem[] = [];
    const surahNumber = Number(q.replace(/^(surah|qs\.?)\s*/, ""));
    if (q && Number.isInteger(surahNumber) && surahNumber >= 1 && surahNumber <= 114) {
      items.push({ id: `surah-${surahNumber}`, label: `Buka surah ke-${surahNumber}`, description: "Al-Qur'an", to: `/quran/${surahNumber}`, keywords: [] });
    }
    const matched = q
      ? STATIC_COMMANDS.filter((c) => normalize(`${c.label} ${c.description} ${c.keywords.join(" ")}`).includes(q))
      : STATIC_COMMANDS;
    return [...items, ...matched].slice(0, 10);
  }, [query]);

  const go = (item: CommandItem | undefined): void => {
    if (!item) return;
    setOpen(false);
    navigate(item.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[index]);
    }
  };

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Pencarian cepat" description="Cari halaman atau ketik nomor surah (1–114)." initialFocusRef={inputRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={onKeyDown}
          type="search"
          aria-controls="command-results"
          aria-label="Kata kunci"
          placeholder="Misalnya: kiblat, zakat, 36"
          className="h-12 w-full rounded-xl border border-line bg-surface-2 pr-4 pl-11 text-fg placeholder:text-muted focus:border-gold/60 focus:outline-none"
        />
      </div>
      <ul id="command-results" aria-label="Hasil pencarian" aria-live="polite" className="mt-3 space-y-1">
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Tidak ada hasil untuk “{query}”.</li>}
        {results.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              aria-current={i === index ? "true" : undefined}
              onMouseEnter={() => setIndex(i)}
              onClick={() => go(item)}
              className={cn("flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left", i === index ? "bg-surface-2 ring-1 ring-gold/30" : "hover:bg-surface-2")}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-fg">{item.label}</span>
                <span className="block truncate text-xs text-muted">{item.description}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
