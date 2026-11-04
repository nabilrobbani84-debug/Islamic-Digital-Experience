# Kontrak API yang dipakai frontend NUR

Base URL: `VITE_API_BASE_URL` (default `/api/v1`). Semua request memakai `credentials: "include"`.
Request yang mengubah data mengirim header `X-CSRF-Token` berisi nilai cookie `nur_csrf` (double-submit).

Respons mengikuti envelope spesifikasi arsitektur (bagian 4.2):

```json
{ "success": true, "data": {}, "meta": { "datasetVersion": "…", "source": "…", "license": "…" } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": {} } }
```

`401` memicu satu kali `POST /auth/refresh`, lalu request diulang. Jika refresh gagal, pengguna diarahkan ke `/login`.

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
| P | GET | `/admin/overview`, `/admin/content-sources`, `/admin/users`, `/admin/audit-logs`, `/admin/revisions`, `/admin/sync-status` | Panel admin |
| P | PATCH | `/admin/users/:id` | `{ role }` (SUPER_ADMIN) atau `{ isActive }` |
| P | POST | `/admin/revisions`, `/admin/revisions/:id/review` | Alur persetujuan konten |

Bookmark dan progres bacaan (`/bookmarks`, `/reading-progress` di spesifikasi) disinkronkan lewat `/sync/push|pull` sebagai entitas `BOOKMARK` dan `READING_PROGRESS`, supaya penulisan offline dan online memakai jalur yang sama.

Tipe lengkap: `apps/web/src/types/domain.ts`. Antarmuka adapter: `apps/web/src/services/api/contract.ts`.

## Catatan provider Al-Qur'an

Spesifikasi frontend meminta data dari KiosAPI **melalui backend**, sedangkan spesifikasi arsitektur menetapkan *Zero Third-Party Runtime API* (dataset lokal). Frontend tidak bergantung pada keputusan ini: browser hanya memanggil backend NUR. Backend memilih provider (dataset lokal yang diimpor, atau KiosAPI di sisi server) dan memetakan hasilnya ke tipe di atas. Fitur yang tidak disediakan provider (misalnya segmen audio per ayat) dikembalikan sebagai `null`, dan UI menampilkan status "belum tersedia".
