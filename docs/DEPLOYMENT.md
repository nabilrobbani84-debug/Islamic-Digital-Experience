# Deployment self-hosted

Arsitektur: `web` (nginx, SPA + reverse proxy) → `api` (NestJS) → `postgres` (jaringan internal tanpa port publik).
Build image dan header keamanan diuji di CI. **Belum ada uji `docker compose up` penuh dengan TLS dan SMTP nyata.**

## 1. Persiapan

```bash
git clone https://github.com/nabilrobbani84-debug/Islamic-Digital-Experience.git
cd Islamic-Digital-Experience
cp infrastructure/env.example .env
# Isi SEMUA nilai di .env (POSTGRES_PASSWORD, JWT_SECRET, WEB_ORIGIN, APP_BASE_URL, SMTP_URL, ...)
mkdir -p storage
```

API menolak start di produksi bila: `JWT_SECRET` < 32 karakter atau berupa nilai contoh, `MAIL_TRANSPORT` bukan `smtp`,
atau `SMTP_URL` kosong (teruji di CI).

## 2. Jalankan

```bash
docker compose up -d --build
```

Urutan: `postgres` sehat → `migrate` (`prisma migrate deploy`) selesai → `api` sehat → `web`.
Aplikasi di `http://localhost:8080`. Letakkan reverse proxy ber-HTTPS di depan `web`
(cookie sesi bertanda `Secure` di produksi) dan set `TRUST_PROXY` sesuai jumlah proxy.

## 3. Akun admin pertama

```bash
docker compose run --rm -e SEED_ADMIN_EMAIL=admin@contoh.id -e SEED_ADMIN_PASSWORD='...minimal 12 karakter...' \
  api node dist/scripts/seed-admin.js
```

## 4. Impor dataset Al-Qur'an

Letakkan dataset berformat `nur-quran-dataset/1` (lihat `apps/api/src/quran/dataset.ts`) di volume yang dapat dibaca container:

```bash
docker compose run --rm -v "$PWD/data:/data:ro" api node dist/scripts/import-quran.js /data/quran.json
```

Hasil berstatus REVIEW. Buka **Admin → Dataset → Setujui & terbitkan** setelah verifikasi manusia (`DATA_INTEGRITY.md`).
Audio: salin berkas ke `storage/` dan catat metadata di tabel `qaris`, `audio_assets`, `audio_segments`.

## 5. Operasi

| Hal | Cara |
|-----|------|
| Cadangan | `docker compose exec postgres pg_dump -U nur nur \| gzip > backup.sql.gz` terjadwal; enkripsi dan simpan di luar server. Uji pemulihan secara berkala. |
| Pembaruan | `git pull && docker compose up -d --build` (migration otomatis). Lakukan cadangan dulu. |
| Log | `docker compose logs -f api`. Log tidak memuat kata sandi atau token. |
| Kesehatan | `GET /api/v1/health` (API), `GET /healthz` (web). |
| Batas laju | In-memory per instance. Bila API di-scale-out, ganti dengan penyimpanan bersama (mis. Redis). |

## 6. Variabel lingkungan

Lihat `apps/api/.env.example` dan `infrastructure/env.example`. Frontend hanya memakai `VITE_API_BASE_URL`
(default `/api/v1`); semua variabel `VITE_*` terlihat oleh browser, jangan isi secret.

## 7. Daftar periksa sebelum rilis

- [ ] Dataset Al-Qur'an, terjemahan, tafsir, hadis, doa diimpor, diverifikasi, dan lisensinya tercatat.
- [ ] SMTP berjalan (uji registrasi dan reset kata sandi).
- [ ] TLS aktif; `TRUST_PROXY` benar (cek IP di `auth_sessions`).
- [ ] Parameter metode sholat (Kemenag RI) dicocokkan dengan dokumen resmi.
- [ ] Cadangan dan pemulihan diuji.
- [ ] Uji keamanan dan uji beban di lingkungan Anda.
- [ ] Lisensi font, audio, dan aset lain diperiksa.
