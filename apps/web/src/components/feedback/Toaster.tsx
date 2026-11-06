import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useUi } from "@/stores/ui";
import { cn } from "@/lib/cn";

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info } as const;

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-0 top-[4.75rem] z-[90] flex flex-col items-center gap-2 px-3 sm:top-auto sm:right-4 sm:bottom-6 sm:left-auto sm:items-end">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              role={t.tone === "error" ? "alert" : "status"}
              className="nur-glass pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-xl"
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", t.tone === "success" && "text-accent", t.tone === "error" && "text-red-400", t.tone === "info" && "text-gold-text")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-muted">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded-lg p-1 text-muted hover:text-fg" aria-label="Tutup notifikasi">
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
