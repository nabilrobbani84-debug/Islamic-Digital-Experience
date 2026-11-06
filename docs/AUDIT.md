# Laporan audit dan status NUR

Semua angka berasal dari run GitHub Actions pada commit `7f0cb72` (lingkungan pengembangan tidak punya akses npm,
jadi seluruh build dan test dijalankan di CI). Perubahan sesudahnya hanya dokumentasi.

## 1. Temuan audit awal

| # | Prioritas | Temuan | Status |
|---|-----------|--------|--------|
| 1 | Critical | `apps/api` hanya berisi schema Prisma: tidak ada NestJS, auth, atau endpoint. Frontend hanya berjalan dengan adapter mock. | **Diperbaiki.** Backend NestJS 11 dibangun, 79 test integrasi di PostgreSQL 17. |
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
| 12 | Medium | Hero mobile: judul masih menimpa bagian bawah masjid. Banner mode mock tampil di landing. | Diperbaiki dan diverifikasi lewat screenshot (komposisi hero memakai rasio layar; banner mock disembunyikan di `/`). |
| 13 | Low | Tidak ada ESLint. | **Belum dikerjakan.** TypeScript strict dan Prisma validate aktif. Menambah ESLint berarti menambah devDependency dan membuat ulang `package-lock.json`; CI memakai `npm ci`. |
| 14 | High | Data Tanzil menaruh basmalah di dalam teks ayat 1 pada 112 surah. Ditampilkan apa adanya, basmalah tampak sebagai bagian ayat 1. Mengubah teksnya melanggar lisensi (verbatim). | Diperbaiki: teks tetap verbatim; API memberi `bismillahPrefix`, UI menampilkannya sebagai kepala surah. Pengecekan data nyata menemukan surah 95 dan 97 menulis basmalah dengan tasydid tambahan, sehingga pencocokan persis melewatkan keduanya; kini memakai pencocokan ternormalisasi. |
| 15 | High | Atribusi Tanzil wajib, tetapi UI hanya menampilkan teks nama sumber tanpa tautan. | Diperbaiki: nama sumber teks dan terjemahan menjadi tautan https ke sumbernya (hanya https yang dirender). |

## 2. Hasil pengujian (CI)

| Pengujian | Hasil |
|-----------|-------|
| Typecheck web, engine, API (strict) | lulus |
| Engine perhitungan (`node:test`) | 38/38 |
| Unit web (Vitest + Testing Library) | 45/45 (14 berkas) |
| E2E Playwright, mock (desktop + mobile, a11y axe, offline, responsif 10 viewport) | 66 lulus, 16 dilewati dengan sengaja (proyek ganda) |
| Backend integrasi di PostgreSQL 17 | 79/79, 0 dilewati |
| E2E full-stack (browser nyata, build produksi, API nyata, PostgreSQL) | 9/9 |
| Verifikasi data nyata Tanzil (workflow `Quran source check`) | 7/7, 0 dilewati |
| Prisma validate, migrate deploy, drift check, constraint kustom | lulus |
| Build image Docker (api, web) dan smoke test | lulus |
| Build produksi | lulus, precache PWA 1.559 KiB |

Cakupan E2E full-stack: registrasi, verifikasi email lewat tautan nyata, login, cookie HttpOnly,
tidak ada token atau password di localStorage atau IndexedDB, bookmark offline lalu sinkron,
pencabutan sesi dari perangkat lain, logout, penolakan RBAC, tampilan basmalah sebagai kepala surah,
dan tautan atribusi sumber.

Cakupan verifikasi data nyata: berkas Tanzil diunduh di CI, dikonversi, diimpor tanpa `--partial`, disetujui,
lalu dibandingkan dengan berkas sumber (teks dan terjemahan sama persis karakter demi karakter), 114 surah,
6.236 ayat, 30 juz, 604 halaman, 60 hizb, pencarian, awalan basmalah pada 112 surah, dan atribusi.
Pengecekan ini membuktikan jalur impor setia pada berkas sumber. Ia tidak membuktikan berkas sumber benar
terhadap mushaf (lihat `DATA_INTEGRITY.md`).

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
- **Sumber yang sudah diuji pada data nyata: Tanzil.** `apps/api/scripts/tanzil-build.ts` mengubah berkas Tanzil
  (teks Utsmani, metadata, terjemahan Indonesia) menjadi dataset NUR dengan menyalin teks verbatim. Format berkas
  diperiksa dari unduhan nyata di CI, tidak ditebak. Workflow `Quran source check` menjalankan seluruh jalur ini.
  Cara memakainya ada di `DEPLOYMENT.md` langkah 4.

**Repository ini tidak berisi teks Al-Qur'an apa pun.** Data uji (`apps/api/test/fixtures`) memakai frasa Arab generik
yang bukan ayat, ditandai `[TEST]`. Data Tanzil hanya ada di database CI sementara. Sebelum rilis, dataset
sungguhan harus diimpor dan diverifikasi manusia (lihat `DATA_INTEGRITY.md`).

**Lisensi terjemahan belum diverifikasi.** Nilai lisensi terjemahan Tanzil di workflow CI hanyalah penanda.
Pemilik produk harus memeriksa ketentuan terjemahan yang dipakai sebelum distribusi.

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
- Hero desktop: menara kiri masjid sedikit menutupi bagian subjudul (terlihat di screenshot, belum diperbaiki).
- Data audio (qari, `audio_assets`, segmen ayat) kosong; halaman audio menampilkan "belum tersedia".
- Perintah Docker di `DEPLOYMENT.md` langkah 4 belum dijalankan end-to-end; skrip yang sama (`node dist/scripts/tanzil-build.js`) sudah diuji di CI tanpa Docker.
- Kinerja 60/30 FPS belum terukur di GPU nyata. CI memakai renderer software.
- Sebagian target sentuh (sel kalender) 32 px lebar di layar 320 px.
- ESLint belum dikonfigurasi.
- Email produksi memerlukan SMTP yang Anda sediakan.
- Tidak ada pengujian keamanan eksternal (pentest) dan tidak ada uji beban.
