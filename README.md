# NUR — Islamic Digital Experience

Platform ibadah digital dengan pengalaman 3D immersive, mode offline-first (PWA), dan perhitungan Islam (waktu sholat, kiblat, kalender Hijriah, zakat) yang berjalan secara lokal tanpa API pihak ketiga.

Arsitektur: **Modular Monolith + Offline-first PWA**.

## Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19 + TypeScript, Vite, Tailwind CSS |
| 3D | Three.js, React Three Fiber, Drei |
| Animasi | Framer Motion (Sticky Scroll) |
| State | Zustand, TanStack Query |
| Backend | NestJS |
| Database | PostgreSQL 17 + Prisma ORM 7 |
| Offline | IndexedDB + Dexie, Vite PWA |
| Deploy | Docker + Nginx (self-hosted) |

## Status saat ini

Baseline database sudah diperbaiki dan divalidasi secara statis. Lihat **[`apps/api/prisma/README.md`](apps/api/prisma/README.md)** untuk langkah migration dan keputusan desain.

```
apps/
└── api/
    ├── prisma/
    │   ├── schema.prisma                     # 51 model, Prisma 7
    │   ├── sql/001_constraints_and_search.sql # CHECK, trigger, index pencarian
    │   └── README.md                          # langkah migration + catatan desain
    ├── prisma.config.ts                       # URL DB (Prisma 7)
    ├── package.json
    └── .env.example
```

### Menjalankan database secara lokal

```bash
cd apps/api
cp .env.example .env            # sesuaikan DATABASE_URL
npm install
npx prisma validate
npx prisma migrate dev --name init_nur_database
# lalu pasang SQL tambahan — lihat apps/api/prisma/README.md
```

## Roadmap

Pengembangan dibagi 7 fase (fondasi → 3D → Quran → audio → calculation engine → konten ibadah → offline/admin/produksi). Database adalah bagian dari Phase 1.
