import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Command, LogOut, Moon, Search, Settings, Shield, Sun, User as UserIcon } from "lucide-react";
import { DHIKR_NAV, KNOWLEDGE_GROUP, KNOWLEDGE_NAV, PRIMARY_NAV } from "@/app/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { SyncStatusBadge } from "@/components/feedback/SyncStatusBadge";
import { NurLogo } from "./NurLogo";
import { useAuth, can } from "@/stores/auth";
import { usePreferences } from "@/stores/preferences";
import { useUi } from "@/stores/ui";
import { useLogout } from "@/features/auth/useSession";
import { cn } from "@/lib/cn";

function NavPill({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className="relative rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap">
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-full bg-surface-2 ring-1 ring-gold/30" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
          <span className={cn("relative transition-colors", isActive ? "text-fg" : "text-muted hover:text-fg")}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

function KnowledgeMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const active = KNOWLEDGE_NAV.some((n) => location.pathname.startsWith(n.to));
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-sm font-medium transition-colors", active || open ? "bg-surface-2 text-fg" : "text-muted hover:text-fg")}
      >
        {KNOWLEDGE_GROUP.label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="nur-glass absolute top-12 left-1/2 w-72 -translate-x-1/2 rounded-2xl p-2 shadow-2xl"
          >
            {KNOWLEDGE_NAV.map((item) => (
              <Link key={item.to} to={item.to} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2">
                <item.icon className="mt-0.5 size-5 text-gold-text" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-fg">{item.label}</span>
                  <span className="block text-xs text-muted">{item.description}</span>
                </span>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserMenu() {
  const user = useAuth((s) => s.user);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const logout = useLogout();
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  if (!user) {
    return (
      <Link to="/login" className="inline-flex h-10 items-center rounded-xl bg-emerald-nur px-4 text-sm font-semibold text-ivory">
        Masuk
      </Link>
    );
  }
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Menu akun ${user.name}`}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-emerald-nur to-emerald-deep text-sm font-bold text-ivory ring-1 ring-gold/40"
      >
        {initials}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="nur-glass absolute top-12 right-0 w-64 rounded-2xl p-2 shadow-2xl">
            <div className="border-b border-line px-3 pt-2 pb-3">
              <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <Link role="menuitem" to="/profile" className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-2">
              <UserIcon className="size-4" aria-hidden /> Profil & riwayat
            </Link>
            <Link role="menuitem" to="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-2">
              <Settings className="size-4" aria-hidden /> Pengaturan
            </Link>
            {can(user, "admin:access") && (
              <Link role="menuitem" to="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-surface-2">
                <Shield className="size-4" aria-hidden /> Admin
              </Link>
            )}
            <button role="menuitem" type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-500 hover:bg-surface-2">
              <LogOut className="size-4" aria-hidden /> Keluar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ThemeToggle() {
  const theme = usePreferences((s) => s.theme);
  const toggle = usePreferences((s) => s.toggleTheme);
  return <IconButton label={theme === "dark" ? "Aktifkan mode terang" : "Aktifkan mode gelap"} icon={theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />} onClick={toggle} />;
}

/** Navigasi atas: transparan di atas hero, menjadi glass saat halaman digulir. */
export function TopNav({ transparent = false }: { transparent?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const setCommandOpen = useUi((s) => s.setCommandOpen);
  useEffect(() => {
    const onScroll = (): void => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const glass = !transparent || scrolled;
  return (
    <header className={cn("sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300", glass ? "nur-glass border-x-0 border-t-0" : "border-b border-transparent bg-transparent")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-emerald-nur focus:px-4 focus:py-2 focus:text-ivory">
        Lewati ke konten utama
      </a>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-[72px]">
        <NurLogo to="/dashboard" />
        <nav aria-label="Navigasi utama" className="hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <NavPill key={item.to} to={item.to} label={item.label} />
          ))}
          <KnowledgeMenu />
          <NavPill to={DHIKR_NAV.to} label={DHIKR_NAV.label} />
        </nav>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="hidden h-10 items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 text-sm text-muted hover:text-fg md:inline-flex"
            aria-label="Buka pencarian cepat"
          >
            <Search className="size-4" aria-hidden />
            <span className="hidden xl:inline">Cari</span>
            <kbd className="ml-1 hidden items-center gap-0.5 rounded-md border border-line px-1.5 text-[10px] xl:inline-flex">
              <Command className="size-3" aria-hidden />K
            </kbd>
          </button>
          <IconButton label="Buka pencarian cepat" icon={<Search className="size-5" />} onClick={() => setCommandOpen(true)} className="md:hidden" />
          <SyncStatusBadge compact />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
