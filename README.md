# NUR — Islamic Digital Experience

Platform ibadah digital dengan pengalaman 3D immersive, mode offline-first (PWA), dan perhitungan Islam (waktu sholat, kiblat, kalender Hijriah, zakat) yang berjalan lokal tanpa API pihak ketiga.

Arsitektur: **Modular Monolith + Offline-first PWA**.

## Isi repository

```
apps/
  web/                       Frontend React 19 + R3F (lihat apps/web/README.md)
  api/                       Backend NestJS 11 + Prisma 7 + PostgreSQL 17 (lihat apps/api/prisma/README.md)
packages/
  islamic-calculations/      Engine lokal: waktu sholat, kiblat, Hijriah, zakat desimal
docs/                        AUDIT.md, DEPLOYMENT.md, DATA_INTEGRITY.md, FRONTEND_API_CONTRACT.md
infrastructure/              env.example untuk docker compose
docker-compose.yml           postgres + migrate + api + web
.github/workflows/           CI: frontend (typecheck, unit, build, E2E) dan API (Prisma, integrasi, E2E full-stack, Docker)
```

## Mulai cepat

Membutuhkan Node.js ≥ 22.12.

```bash
npm ci

# A. Frontend saja, tanpa backend (adapter mock, data contoh; akun demo@nur.local / demo12345)
npm run dev:mock -w @nur/web

# B. Full-stack lokal
docker run -d --name nur-postgres -e POSTGRES_DB=nur -e POSTGRES_USER=nur -e POSTGRES_PASSWORD=nur -p 127.0.0.1:5432:5432 postgres:17
cp apps/api/.env.example apps/api/.env          # sesuaikan JWT_SECRET
npx prisma migrate deploy --config apps/api/prisma.config.ts
npm run dev:api                                  # API di http://localhost:3000/api/v1/health
cp apps/web/.env.example apps/web/.env.local     # atur VITE_API_PROXY_TARGET=http://localhost:3000
npm run dev                                      # web di http://localhost:5173
```

Pada mode email `log`, tautan verifikasi dicetak ke konsol API. Buat admin pertama dengan `npm run seed:admin -w @nur/api`
(lihat `docs/DEPLOYMENT.md`).

Pengujian: `npm run typecheck && npm test && npm run build && npm run e2e`. Backend: `npm run test:api` (memerlukan PostgreSQL dan `DATABASE_URL`).

**Status, temuan audit, dan batasan yang diketahui: [`docs/AUDIT.md`](docs/AUDIT.md).** Deployment: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, TypeScript strict, Vite 7, Tailwind CSS 4 |
| 3D | Three.js, React Three Fiber 9, Drei 10 (scene procedural + fallback 2D) |
| Animasi | Framer Motion (sticky scroll), CSS |
| State & data | Zustand, TanStack Query, React Hook Form + Zod |
| Offline | Dexie (IndexedDB), Vite PWA |
| Backend | NestJS 11, Prisma 7, PostgreSQL 17, Argon2id, cookie HttpOnly + CSRF |
| Test | Vitest + Testing Library, Playwright + axe-core, node:test |
