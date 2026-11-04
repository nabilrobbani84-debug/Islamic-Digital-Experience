import { HardDrive, ShieldCheck, WifiOff } from "lucide-react";
import { Interactive3DCard } from "@/three/components/Interactive3DCard";
import { useInView } from "framer-motion";
import { useRef } from "react";
import { motion } from "framer-motion";

const VALUES = [
  {
    icon: WifiOff,
    title: "Offline-first",
    body: "Al-Qur'an, tafsir, audio yang diunduh, dzikir, dan doa tersedia tanpa koneksi. Perubahan tersinkron saat online.",
  },
  {
    icon: HardDrive,
    title: "Perhitungan lokal",
    body: "Waktu sholat, kiblat, kalender Hijriah, dan zakat dihitung di perangkat dengan algoritma yang dapat diuji.",
  },
  {
    icon: ShieldCheck,
    title: "Privasi terjaga",
    body: "Sesi memakai cookie aman. Tidak ada token atau kata sandi yang disimpan di penyimpanan browser.",
  },
];

export function ValuesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <section className="px-5 pb-24 sm:px-8" aria-labelledby="values-title">
      <div ref={ref} className="mx-auto max-w-7xl">
        <h2 id="values-title" className="sr-only">
          Prinsip NUR
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <motion.div key={v.title} initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : undefined} transition={{ delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
              <Interactive3DCard>
                <div className="nur-surface h-full rounded-3xl p-7">
                  <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-nur/30 to-transparent text-gold-text ring-1 ring-gold/20">
                    <v.icon className="size-6" aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold text-fg">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{v.body}</p>
                </div>
              </Interactive3DCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
