# NUR — Islamic Digital Experience

Platform ibadah digital dengan pengalaman 3D immersive, mode offline-first (PWA), dan perhitungan Islam (waktu sholat, kiblat, kalender Hijriah, zakat) yang berjalan lokal tanpa API pihak ketiga.

Arsitektur: **Modular Monolith + Offline-first PWA**.

## Isi repository

```
apps/
  web/                       Frontend React 19 + R3F (lihat apps/web/README.md)
  api/                       Baseline database Prisma 7 (branch feat/database-baseline)
packages/
  islamic-calculations/      Engine lokal: waktu sholat, kiblat, Hijriah, zakat desimal
docs/
  FRONTEND_API_CONTRACT.md   Endpoint backend yang dipakai frontend
.github/workflows/           CI: typecheck, unit test, build, E2E
```

## Mulai cepat

```bash
npm ci
npm run dev:mock -w @nur/web   # tanpa backend, akun demo@nur.local / demo12345
npm run typecheck && npm test && npm run build && npm run e2e
```

Membutuhkan Node.js ≥ 22.12.

## Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 19, TypeScript strict, Vite 7, Tailwind CSS 4 |
| 3D | Three.js, React Three Fiber 9, Drei 10 (scene procedural + fallback 2D) |
| Animasi | Framer Motion (sticky scroll), CSS |
| State & data | Zustand, TanStack Query, React Hook Form + Zod |
| Offline | Dexie (IndexedDB), Vite PWA |
| Test | Vitest + Testing Library, Playwright + axe-core, node:test |
| Backend (rencana) | NestJS, PostgreSQL + Prisma |
