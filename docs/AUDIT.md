# Laporan audit dan status NUR

Tanggal: 5 November 2026. Semua angka berasal dari run GitHub Actions pada commit `1cd99f9`
(lingkungan pengembangan tidak punya akses npm, jadi seluruh build dan test dijalankan di CI).

## 1. Temuan audit awal

| # | Prioritas | Temuan | Status |
|---|-----------|--------|--------|
| 1 | Critical | `apps/api` hanya berisi schema Prisma: tidak ada NestJS, auth, atau endpoint. Frontend hanya berjalan dengan adapter mock. | **Diperbaiki.** Backend NestJS 11 dibangun, 62 test integrasi di PostgreSQL 17. |
| 2 | Critical | Schema Prisma belum pernah divalidasi Prisma dan belum ada migration. | **Diperbaiki.** `prisma validate`, `migrate deploy`, dan cek drift berjalan di CI. |
| 3 | Critical | Dokumentasi KiosAPI (`kiosapi.my.id/docs/quran-api/`) tidak dapat diakses (HTTP 403 dari lingkungan ini). Pencarian hanya menemukan "KiosAPI" lain yang merupakan gateway AI. | **Belum dapat dikerjakan.** Endpoint tidak dikarang. Lihat bagian 4. |
| 4 | High | Branch `feat/database-baseline` dan `feat/frontend` terpisah. | Diperbaiki: digabung. PR #1 kini tumpang tindih dengan PR #2. |
| 5 | High | Schema tidak cocok dengan kontrak frontend: `AsmaulFavorite` terpisah dari favorit lain, `DhikrSession.dhikrItemId` wajib padahal dzikir bebas boleh tanpa item, `ZakatCalculation` tanpa jenis dan versi aturan, `ReadingProgress` tanpa waktu posisi. | Diperbaiki di schema dan migration. |
| 6 | High | Frontend memakai ID bookmark acak, sedangkan server memakai kunci `surah:ayat`. Konflik sync memakai versi tebakan. Favorit dari server tidak diterapkan di klien. | Diperbaiki. |
| 7 | High | Tidak ada indikator status sinkronisasi di UI. | Diperbaiki (`SyncStatusBadge`). |
| 8 | High | Responsif hanya diuji di 2 viewport. | Diperbaiki: matriks 10 viewport x 15 rute. Menemukan overflow header di 320 hingga 1279 px, target sentuh terlalu kecil, dan menu desktop yang melebihi 1024 px. Semua diperbaiki. |
| 9 | High | Header keamanan nginx hilang di location yang punya `add_header` (pewarisan `add_header`). | Diperbaiki dan diuji pada image Docker. |
| 10 | Medium | Urutan guard backend: pengguna tanpa sesi mendapat 403 CSRF, bukan 401, sehingga klien tidak memicu refresh. | Diperbaiki. |
| 11 | Medium | Komposisi 3D: teks menimpa masjid, hero dan bab bertumpuk, dial kiblat terpotong, toast menutup header. | Diperbaiki dan diverifikasi lewat screenshot. |
| 12 | Medium | Hero mobile: judul masih menimpa bagian bawah masjid. | **Belum diperbaiki.** |
| 13 | Low | Tidak ada ESLint. | **Belum dikerjakan.** TypeScript strict dan Prisma validate aktif. |

## 2. Hasil pengujian (CI)

| Pengujian | Hasil |
|-----------|-------|
| Typecheck web, engine, API (strict) | lulus |
| Engine perhitungan (`node:test`) | 38/38 |
| Unit web (Vitest + Testing Library) | 36/36 |
| E2E Playwright, mock (desktop + mobile, a11y axe, offline, responsif 10 viewport) | 66 lulus, 16 dilewati dengan sengaja (proyek ganda) |
| Backend integrasi di PostgreSQL 17 | 62/62 |
| E2E full-stack (browser nyata, build produksi, API nyata, PostgreSQL) | 7/7 |
| Prisma validate, migrate deploy, drift check, constraint kustom | lulus |
| Build image Docker (api, web) dan smoke test | lulus |
| Build produksi | lulus, precache PWA 1.559 KiB |

Cakupan E2E full-stack: registrasi, verifikasi email lewat tautan nyata, login, cookie HttpOnly,
tidak ada token atau password di localStorage atau IndexedDB, bookmark offline lalu sinkron,
pencabutan sesi dari perangkat lain, logout, dan penolakan RBAC.

## 3. Bundle

| Berkas | Ukuran | gzip |
|--------|--------|------|
| Entry JS (`index`) | 673 kB | 219 kB |
| `three` (dimuat hanya saat scene 3D tampil) | 703 kB | 181 kB |
| `IslamicHeroScene` | 26 kB | 8 kB |

Chunk `three` tidak diunduh pada mode fallback 2D (diuji otomatis).

## 4. Integrasi API Quran

Dokumentasi KiosAPI tidak bisa dibaca dari lingkungan ini, jadi tidak ada adapter KiosAPI. Yang dibangun:

- Backend melayani Al-Qur'an dari PostgreSQL miliknya sendiri, hanya setelah dataset disetujui admin.
- `apps/api/scripts/import-quran.ts` mengimpor dataset berformat `nur-quran-dataset/1`, memvalidasi struktur
  (114 surah, 6.236 ayat, nomor ayat berurutan, halaman dan juz tidak mundur, cakupan terjemahan), mencatat checksum
  SHA-256, dan menyimpan hasil berstatus REVIEW.
- Untuk memakai KiosAPI: ambil data di sisi server, ubah ke format dataset di atas, lalu impor. Validator dan alur
  persetujuan tetap berlaku. Perlu juga memeriksa ketentuan lisensi dan penyimpanan data dari provider.

**Repository ini tidak berisi teks Al-Qur'an apa pun.** Data uji (`apps/api/test/fixtures`) memakai frasa Arab generik
yang bukan ayat, ditandai `[TEST]`. Sebelum rilis, dataset sungguhan harus diimpor dan diverifikasi manusia
(lihat `DATA_INTEGRITY.md`).

## 5. Fitur dan statusnya

**Berfungsi (terhubung ke backend nyata dan diuji):** autentikasi (registrasi, verifikasi email, login, refresh dengan
rotasi dan deteksi pemakaian ulang, logout, reset dan ganti kata sandi, daftar dan cabut sesi perangkat), RBAC,
Al-Qur'an (daftar, reader, terjemahan, tafsir, pencarian Arab dan Indonesia, juz), audio (metadata, checksum, segmen),
dzikir, doa, hadis, Asmaul Husna, bookmark, progres bacaan, sesi dzikir, riwayat zakat, favorit, sync dua arah dengan
aturan konflik per jenis data, panel admin (pengguna, peran, dataset, revisi konten, audit log).

**Berfungsi lokal (tanpa jaringan):** waktu sholat, kiblat, kalender Hijriah tabular, zakat dengan desimal presisi.

**Belum selesai atau terbatas:**
- Tidak ada data agama di repository (lihat atas). Halaman konten kosong sampai dataset diimpor.
- Revisi konten admin baru menerapkan 3 jenis (doa, dzikir, Asmaul Husna). Jenis lain ditolak saat pengajuan.
- Sync belum mencakup `PRAYER_LOCATION`, `USER_SETTING`, `READING_HISTORY` (ditolak eksplisit, bukan diabaikan).
  Lokasi dan preferensi tetap lokal di perangkat.
- Parameter metode Kemenag RI belum diverifikasi dengan dokumen resmi (ditandai di UI).
- Pengaturan bahasa tidak ada: antarmuka hanya Bahasa Indonesia.
- Pengingat sholat hanya berbunyi saat aplikasi terbuka. Background Sync dan Web Push belum ada.
- Model GLB/KTX2/Draco tidak dipakai: scene dibangun procedural. Tidak ada aset berlisensi pihak ketiga.
- Hero mobile: judul masih menimpa bagian bawah masjid.
- Kinerja 60/30 FPS belum terukur di GPU nyata. CI memakai renderer software.
- Sebagian target sentuh (sel kalender) 32 px lebar di layar 320 px.
- ESLint belum dikonfigurasi.
- Email produksi memerlukan SMTP yang Anda sediakan.
- Tidak ada pengujian keamanan eksternal (pentest) dan tidak ada uji beban.
