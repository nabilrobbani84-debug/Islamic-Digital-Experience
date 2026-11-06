# Kontrak API yang dipakai frontend NUR

Base URL: `VITE_API_BASE_URL` (default `/api/v1`). Semua request memakai `credentials: "include"`.
Request yang mengubah data mengirim header `X-CSRF-Token` berisi nilai cookie `nur_csrf` (double-submit).

Respons mengikuti envelope spesifikasi arsitektur (bagian 4.2):

```json
{ "success": true, "data": {}, "meta": { "datasetVersion": "…", "source": "…", "license": "…", "sourceUrl": "https://…" } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {} } }
```

`401` memicu satu kali `POST /auth/refresh`, lalu request diulang. Jika refresh gagal, pengguna diarahkan ke `/login`.

**Status:** seluruh endpoint di bawah ini sudah diimplementasikan di `apps/api` dan diuji (79 test integrasi + 9 E2E full-stack). Error memakai envelope `{ success:false, error:{ code, message, details } }`: 401 saat sesi tidak ada, 403 `CSRF_INVALID` saat token CSRF salah, 429 `RATE_LIMITED` dengan `Retry-After`.

Kolom **Spec** menandai endpoint yang ada di spesifikasi arsitektur 4.1 (✓) atau **usulan** frontend yang perlu disepakati backend (P).

| Spec | Method | Endpoint | Dipakai oleh |
|------|--------|----------|--------------|
| ✓ | POST | `/auth/register` | Register |
| ✓ | POST | `/auth/login` | Login (body: email, password, deviceName) |
| ✓ | POST | `/auth/refresh` | http-client (rotasi refresh token) |
| ✓ | POST | `/auth/logout` | Logout |
| P | POST | `/auth/verify-email` | Verifikasi email (`{ token }`) |
| P | POST | `/auth/verify-email/resend` | Kirim ulang verifikasi |
| P | POST | `/auth/forgot-password` | Lupa kata sandi (respons sama untuk email terdaftar/tidak) |
| P | POST | `/auth/reset-password` | Reset (`{ token, password }`) |
| ✓ | GET/PATCH | `/users/me` | Bootstrap sesi, edit profil |
| P | POST | `/users/me/password` | Ubah kata sandi |
| P | GET | `/users/me/sessions` | Daftar perangkat |
| P | DELETE | `/users/me/sessions/:id` | Cabut sesi |
| ✓ | GET | `/quran/surahs` | Daftar surah → `Surah[]` |
| ✓ | GET | `/quran/surahs/:number?editionId=` | Reader → `SurahDetail` (ayat + terjemahan edisi) |
| ✓ | GET | `/quran/search?q=` | Pencarian ayat |
| ✓ | GET | `/quran/juz/:number` | Filter juz → `JuzInfo` |
| P | GET | `/quran/editions` | Pilihan terjemahan |
| ✓ | GET | `/tafsir/verses/:surah:verse` | Tafsir (frontend memakai kunci `surah:ayat`) |
| ✓ | GET | `/audio/qaris` | Daftar qari |
| ✓ | GET | `/audio/surah/:number?qariId=` | `AudioTrack` (url, durationMs, checksum, segments) |
| ✓ | GET | `/dhikr` | `{ categories, items }` |
| ✓ | GET | `/duas` | `Dua[]` |
| ✓ | GET | `/hadith/nawawi` | `Hadith[]` |
| ✓ | GET | `/asmaul-husna` | `AsmaulHusnaEntry[]` |
| ✓ | POST | `/sync/push` | `{ changes: SyncChangeInput[] }` → `SyncPushResultItem[]` |
| ✓ | GET | `/sync/pull?cursor=` | `SyncPullResult` (cursor = `SyncChange.seq`) |
| ✓ | GET | `/admin/datasets` | Dataset |
| P | POST | `/admin/datasets/:id/approve` | Menerbitkan dataset (REVIEW → PUBLISHED), mengarsipkan versi lama |
| P | GET | `/admin/overview`, `/admin/content-sources`, `/admin/users`, `/admin/audit-logs`, `/admin/revisions`, `/admin/sync-status` | Panel admin |
| P | PATCH | `/admin/users/:id` | `{ role }` (SUPER_ADMIN) atau `{ isActive }` |
| P | POST | `/admin/revisions`, `/admin/revisions/:id/review` | Alur persetujuan konten |

### Tambahan pada detail surah (`GET /quran/surahs/:number`)

| Field | Arti |
|-------|------|
| `bismillahPrefix` | `string` atau `null`. Awalan basmalah yang menempel di awal teks ayat 1, dipotong literal dari ayat itu sendiri (penulisan harakat bisa berbeda antar-surah). `null` untuk surah 1, surah 9, dan sumber yang tidak memakai awalan. `textUthmani` pada respons tetap verbatim; klien memotong awalan hanya pada tampilan (`splitBismillah`). |
| `editionSource` | `{ name, url, license }` atau `null`. Atribusi sumber terjemahan yang dipakai. |
| `meta.sourceUrl` | Tautan sumber teks untuk atribusi. Klien hanya merender tautan `https:`. |

Bookmark dan progres bacaan (`/bookmarks`, `/reading-progress` di spesifikasi) disinkronkan lewat `/sync/push|pull` sebagai entitas `BOOKMARK` dan `READING_PROGRESS`, supaya penulisan offline dan online memakai jalur yang sama.

Tipe lengkap: `apps/web/src/types/domain.ts`. Antarmuka adapter: `apps/web/src/services/api/contract.ts`.

## Catatan provider Al-Qur'an

Dokumentasi KiosAPI tidak dapat dibaca saat pengembangan (HTTP 403), jadi tidak ada adapter KiosAPI. Backend melayani
dataset dari PostgreSQL setelah diimpor dan disetujui. Lihat `docs/AUDIT.md` bagian 4 dan `docs/DATA_INTEGRITY.md`.
Fitur yang tidak disediakan sumber (mis. segmen audio per ayat) dikembalikan sebagai `null`, dan UI menampilkan "belum tersedia".
