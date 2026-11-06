# NUR Web — Frontend

React 19 + TypeScript (strict) + Vite + Tailwind CSS 4, dengan scene 3D procedural (Three.js / React Three Fiber / Drei), Framer Motion, Zustand, TanStack Query, Dexie (IndexedDB), dan Vite PWA.

## Menjalankan

Perintah dijalankan dari **root monorepo** (npm workspaces):

```bash
npm install

# Development dengan backend NUR (proxy /api ke backend lokal)
cp apps/web/.env.example apps/web/.env.local   # atur VITE_API_PROXY_TARGET
npm run dev

# Development TANPA backend (adapter mock, data contoh berlabel)
npm run dev:mock -w @nur/web
#   akun mock: demo@nur.local / demo12345  (USER)
#              admin@nur.local / admin12345 (SUPER_ADMIN)

npm run typecheck   # tsc strict untuk web + calculation engine
npm test            # unit test engine (node:test) + web (Vitest + RTL)
npm run build       # build production (mode mock otomatis dimatikan)
npm run e2e         # build mode e2e + Playwright (desktop & mobile)
```

## Environment

| Variabel | Default | Keterangan |
|----------|---------|------------|
| `VITE_API_BASE_URL` | `/api/v1` | Base URL backend NUR. Same-origin via Nginx disarankan agar cookie HttpOnly + SameSite bekerja. |
| `VITE_API_PROXY_TARGET` | — | Target proxy `npm run dev` (mis. `http://localhost:3000`). |
| `VITE_API_MODE` | `http` | `mock` hanya berlaku di luar build production. |

Semua variabel `VITE_*` ikut ter-bundle ke browser. Jangan menaruh secret.

## Struktur

```
src/
  app/            router, layouts (Root/App/Auth), providers, konfigurasi navigasi
  components/     ui/ (Button, Dialog, Field, Segmented, Switch, ProgressRing…),
                  navigation/ (TopNav, MobileBottomNav, CommandPalette), feedback/ (state & toast)
  features/       home (landing + dashboard), quran (+audio), prayer, qibla, calendar, zakat,
                  asmaul-husna, dhikr, duas, hadith, knowledge (api konten), auth, profile, admin
  three/          scenes/ (lazy), components/, controllers/, materials/, hooks/, lib/
  services/       api/ (kontrak, http, mock), offline/ (Dexie, sync engine), audio/, pwa
  stores/         Zustand: auth, preferences, prayer-settings, audio, dhikr, ui
  hooks/ lib/ styles/ types/ tests/
e2e/              Playwright
```

## Keputusan penting

- **Akun wajib.** Semua rute aplikasi di balik `RequireAuth`. Sesi memakai cookie HttpOnly dari backend; frontend tidak pernah menyimpan token atau password. Profil minimum (tanpa kredensial) disimpan di IndexedDB agar aplikasi bisa dibuka offline hingga 14 hari sejak verifikasi online terakhir.
- **Perhitungan lokal.** Waktu sholat, kiblat, kalender Hijriah, dan zakat memakai `@nur/islamic-calculations` (tanpa dependensi, tanpa jaringan). Zakat memakai aritmetika desimal BigInt.
- **Tidak ada konten keagamaan di frontend.** Teks Al-Qur'an, terjemahan, tafsir, hadis, doa, dzikir, dan Asmaul Husna hanya berasal dari backend NUR. Adapter mock berisi placeholder berlabel, bukan konten.
- **3D bertingkat.** `useRenderTier` memilih `high/medium/low/none` dari kemampuan perangkat; `SceneBoundary` menangani lazy loading, error, context lost, dan menghentikan render loop saat scene di luar layar. `?3d=off` atau Pengaturan → 3D mematikan WebGL. Semua scene procedural, jadi tidak ada aset berlisensi pihak ketiga.
- **Offline-first.** Data personal ditulis ke IndexedDB lalu masuk antrean `pending_sync` dengan idempotency key; dikirim saat online. Konflik versi disimpan untuk ditinjau pengguna (Profil → Sinkronisasi), tidak ditimpa diam-diam.
- **PWA.** Service worker hanya melakukan precache app shell dan aset statis. Respons `/api/*` (termasuk auth) tidak pernah di-cache oleh service worker.

## Terhubung ke backend

Mode default adalah `http` (backend NUR). Dengan backend berjalan, atur `VITE_API_PROXY_TARGET` di `.env.local`.
`npx playwright test -c playwright.live.config.ts` menjalankan E2E terhadap backend nyata (build produksi dan `vite preview`);
urutan lengkapnya ada di `.github/workflows/api.yml`.

## Batasan yang diketahui

- Pengingat sholat memakai Notification API dan hanya berbunyi selama aplikasi terbuka (belum ada Web Push dari server).
- Heading kompas hanya dipakai jika perangkat memberi sumber absolut (`deviceorientationabsolute` / `webkitCompassHeading`). Tanpa itu, UI menampilkan derajat kiblat dan tidak mengklaim akurasi.
- Ayat pilihan harian membutuhkan endpoint kurasi dari backend (belum ada di kontrak); dashboard menampilkan hadis dan doa harian dari dataset.
