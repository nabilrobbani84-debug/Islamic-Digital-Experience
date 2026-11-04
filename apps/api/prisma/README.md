# NUR — Database (Prisma 7 + PostgreSQL 17)

## File

| File | Isi |
|------|-----|
| `schema.prisma` | Model, relasi, unique, index biasa |
| `sql/001_constraints_and_search.sql` | CHECK constraint, trigger audit log, partial index, index pencarian (trigram dan full-text) |
| `../prisma.config.ts` | URL database (Prisma 7 tidak lagi membaca `url` dari `schema.prisma`) |

## Migration pertama

```bash
cd apps/api
cp .env.example .env            # sesuaikan DATABASE_URL
npm install
npx prisma validate
npx prisma format

# 1. Migration dari schema
npx prisma migrate dev --name init_nur_database

# 2. Migration kosong untuk SQL tambahan, lalu isi dengan file SQL
npx prisma migrate dev --create-only --name constraints_and_search
cp prisma/sql/001_constraints_and_search.sql \
   prisma/migrations/*_constraints_and_search/migration.sql
npx prisma migrate dev

npx prisma generate
```

SQL tambahan dibuat sebagai migration kedua karena Prisma mengurutkan migration berdasarkan nama folder (timestamp). Migration ini harus berjalan setelah tabel dibuat.

**Periksa setiap migration baru.** Prisma tidak mengenal index ekspresi, partial, dan trigram. Jika `migration.sql` hasil generate berisi `DROP INDEX "idx_custom_..."`, hapus baris itu sebelum menerapkan. CHECK constraint dan trigger tidak terpengaruh.

## Keputusan desain

**Identity**
- `User.role` memakai enum `UserRole`. RBAC wajib dicek di backend.
- `AuthSession` = satu perangkat. `RefreshToken` = satu token dalam rantai rotasi. Saat refresh, token lama diisi `used_at` dan `replaced_by_id`. Jika token yang sudah `used_at` dipakai lagi, cabut seluruh `AuthSession` (reuse detection).
- `UserToken` menyimpan hash token verifikasi email dan reset password. Token mentah hanya dikirim lewat email.
- Email disimpan lowercase (dijaga CHECK constraint). Normalisasi dilakukan di DTO sebelum query.

**Sinkronisasi offline**
- Tabel personal punya `version`, `updated_at`, dan `deleted_at` (tombstone). Hapus = isi `deleted_at`, supaya penghapusan bisa disinkronkan ke perangkat lain.
- `sync_status` (SYNCED/PENDING/FAILED) hanya ada di IndexedDB. Di server, data yang sudah tersimpan selalu tersinkron. Server mencatat hasil pemrosesan di `SyncChange.status` (APPLIED/CONFLICT/REJECTED).
- ID data personal boleh dibuat di klien (UUID v7) agar data yang dibuat offline punya ID final.
- Konflik: klien mengirim `baseVersion`. Jika berbeda dengan `version` di server, perubahan dicatat sebagai CONFLICT dan diselesaikan per jenis data (progres bacaan: posisi terbaru menang; catatan bookmark: jangan ditimpa diam-diam).
- `SyncChange.seq` adalah cursor untuk `/sync/pull`. Konsekuensinya, semua penulisan data personal, termasuk lewat REST saat online, harus menulis `SyncChange` dalam transaksi yang sama.
- `idempotencyKey` unik per pengguna (`@@unique([userId, idempotencyKey])`).

**Waktu sholat**
- `PrayerTime` adalah cache hasil calculation engine, bukan sumber kebenaran.
- Waktu disimpan sebagai menit lokal sejak tengah malam (`*_minutes`) beserta `prayer_date` dan `timezone` IANA, sesuai poin 10.3 spesifikasi. Nilai NULL berarti engine tidak menemukan solusi normal (lintang ekstrem); `high_latitude_rule` mencatat aturan pengganti yang dipakai.
- `PrayerMethod.isVerified` tetap `false` sampai parameter (misalnya Kemenag RI) dicocokkan dengan sumber resmi. Isya bisa memakai sudut atau interval tetap.

**Konten dan lisensi**
- Konten editorial punya `status` (`ContentStatus`). Endpoint publik hanya mengembalikan `PUBLISHED`.
- Perubahan konten oleh admin melalui `ContentRevision` (DRAFT → REVIEW → PUBLISHED). Reviewer tidak boleh sama dengan author (CHECK).
- `DatasetVersion` hanya boleh `PUBLISHED` setelah ada `approved_by_id` (CHECK).
- `ContentSource` menyimpan lisensi dan atribusi, dan sekarang dirujuk oleh `QuranEdition`, `TafsirSource`, `Qari`, `HadithCollection`, dan `DatasetVersion`.
- `AdminAuditLog` append-only (trigger menolak UPDATE/DELETE). Karena FK `actor_id` memakai `Restrict`, admin dinonaktifkan (`is_active = false`), bukan dihapus.

**Favorit**
- `UserFavorite` tetap polimorfik, tetapi `contentType` sekarang enum. `content_id` tidak punya FK, jadi backend wajib memeriksa keberadaan konten dalam transaksi yang sama. Ayat memakai `Bookmark` dan Asmaul Husna memakai `AsmaulFavorite`, keduanya dengan FK langsung.

**Pencarian (bagian 4.3)**
- `Verse.textNormalized` berisi teks Arab tanpa harakat dan tanda waqaf, diisi oleh pipeline import. Normalisasi yang sama harus diterapkan pada input pencarian.
- Index trigram untuk teks Arab dan nama surah, serta index full-text `indonesian` untuk terjemahan.

## Belum dicakup

- Tabel `QuranPage` untuk lebih dari satu edisi mushaf. `Verse.pageNumber` saat ini mengikuti satu edisi (604 halaman).
- `JuzVerse` menduplikasi `Verse.juzNumber`. Dipertahankan sesuai spesifikasi; pipeline import harus mengisi keduanya secara konsisten (cek di data-integrity test).
- `ZakatType.FITRAH` dihitung per jiwa, bukan dari total harta. Kolom `ZakatCalculation` cocok untuk zakat maal; aturan fitrah perlu disimpan di `ZakatRule.parameters`.
