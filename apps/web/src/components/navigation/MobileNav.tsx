import { NavLink } from "react-router";
import { motion } from "framer-motion";
import { Calculator, CalendarDays, Compass, Ellipsis, Hand, ScrollText, Settings, Shield, Star, User } from "lucide-react";
import { MOBILE_NAV } from "@/app/navigation";
import { Dialog } from "@/components/ui/Dialog";
import { useUi } from "@/stores/ui";
import { useAuth, can } from "@/stores/auth";
import { cn } from "@/lib/cn";

const MORE_LINKS = [
  { to: "/qibla", label: "Kiblat", icon: Compass },
  { to: "/calendar", label: "Kalender", icon: CalendarDays },
  { to: "/zakat", label: "Zakat", icon: Calculator },
  { to: "/asmaul-husna", label: "Asmaul Husna", icon: Star },
  { to: "/duas", label: "Doa Harian", icon: Hand },
  { to: "/hadith", label: "Hadis Arba'in", icon: ScrollText },
  { to: "/profile", label: "Profil", icon: User },
  { to: "/settings", label: "Pengaturan", icon: Settings },
] as const;

/** Navigasi bawah untuk mobile. Tinggi tetap 64px + safe area agar mini player bisa ditumpuk di atasnya. */
export function MobileBottomNav() {
  const setMoreOpen = useUi((s) => s.setMoreMenuOpen);
  const moreOpen = useUi((s) => s.moreMenuOpen);
  const user = useAuth((s) => s.user);
  return (
    <>
      <nav aria-label="Navigasi bawah" className="nur-glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 safe-bottom lg:hidden">
        <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
          {MOBILE_NAV.map((item) => (
            <li key={item.to}>
              <NavLink to={item.to} className="relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium">
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="mobile-nav-active" className="absolute top-1.5 h-1 w-8 rounded-full bg-gold" />}
                    <item.icon className={cn("size-5", isActive ? "text-gold-text" : "text-muted")} aria-hidden />
                    <span className={isActive ? "text-fg" : "text-muted"}>{item.label === "Al-Qur'an" ? "Qur'an" : item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMoreOpen(true)} aria-haspopup="dialog" className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted">
              <Ellipsis className="size-5" aria-hidden />
              Lainnya
            </button>
          </li>
        </ul>
      </nav>
      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu lainnya" variant="sheet" size="sm">
        <ul className="grid grid-cols-3 gap-2">
          {[...MORE_LINKS, ...(can(user, "admin:access") ? [{ to: "/admin", label: "Admin", icon: Shield }] : [])].map((link) => (
            <li key={link.to}>
              <NavLink to={link.to} onClick={() => setMoreOpen(false)} className="flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface-2 text-center text-xs font-medium hover:border-gold/40">
                <link.icon className="size-6 text-gold-text" aria-hidden />
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
