import {
  BookOpen,
  Calculator,
  CalendarDays,
  Clock,
  Compass,
  Hand,
  House,
  Library,
  ScrollText,
  Sparkles,
  Star,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  keywords?: string[];
}

export const PRIMARY_NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: House, description: "Ringkasan ibadah harian", keywords: ["beranda", "dashboard"] },
  { to: "/quran", label: "Al-Qur'an", icon: BookOpen, description: "Baca, dengar, dan tandai ayat", keywords: ["quran", "surah", "ayat", "mushaf"] },
  { to: "/prayer", label: "Prayer", icon: Clock, description: "Jadwal dan pengingat sholat", keywords: ["sholat", "salat", "adzan", "jadwal"] },
  { to: "/qibla", label: "Qibla", icon: Compass, description: "Arah kiblat dari lokasi Anda", keywords: ["kiblat", "kompas", "kabah"] },
  { to: "/calendar", label: "Islamic Calendar", icon: CalendarDays, description: "Kalender Hijriah & hari besar", keywords: ["hijriah", "kalender", "tanggal"] },
  { to: "/zakat", label: "Zakat", icon: Calculator, description: "Kalkulator zakat", keywords: ["zakat", "nisab", "fitrah"] },
];

export const KNOWLEDGE_NAV: NavItem[] = [
  { to: "/asmaul-husna", label: "Asmaul Husna", icon: Star, description: "99 nama Allah", keywords: ["asmaul", "husna", "nama allah"] },
  { to: "/duas", label: "Doa Harian", icon: Hand, description: "Doa sebelum & sesudah aktivitas", keywords: ["doa", "dua"] },
  { to: "/hadith", label: "Hadis Arba'in", icon: ScrollText, description: "40 Hadis Imam Nawawi", keywords: ["hadis", "hadith", "nawawi", "arbain"] },
];

export const DHIKR_NAV: NavItem = { to: "/dhikr", label: "Dhikr", icon: Sparkles, description: "Penghitung dzikir digital", keywords: ["dzikir", "tasbih", "zikir"] };

export const KNOWLEDGE_GROUP = { label: "Knowledge", icon: Library } as const;

export const MOBILE_NAV: NavItem[] = [
  PRIMARY_NAV[0]!,
  PRIMARY_NAV[1]!,
  PRIMARY_NAV[2]!,
  DHIKR_NAV,
];

export const ALL_NAV: NavItem[] = [...PRIMARY_NAV, ...KNOWLEDGE_NAV, DHIKR_NAV];
