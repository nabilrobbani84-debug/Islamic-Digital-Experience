# Integritas data keagamaan

Repository ini tidak membawa teks Al-Qur'an, terjemahan, tafsir, hadis, doa, dzikir, atau Asmaul Husna.
Semuanya harus diimpor dari sumber berlisensi dan diverifikasi manusia sebelum diterbitkan.

## Yang diperiksa otomatis

`import-quran` menolak dataset bila:

- format bukan `nur-quran-dataset/1` atau lisensi sumber kosong;
- jumlah surah bukan 114, jumlah ayat bukan 6.236, atau jumlah juz bukan 30 (kecuali `--partial`);
- nomor ayat dalam surah tidak berurutan atau duplikat;
- nomor halaman atau juz mundur terhadap urutan ayat;
- batas juz mengacu ke ayat yang tidak ada;
- terjemahan mengacu ke ayat yang tidak ada, duplikat, atau tidak mencakup seluruh ayat.

Setiap impor mencatat checksum SHA-256 berkas. Database menolak dataset berstatus PUBLISHED tanpa penyetuju
(`dataset_versions_published_requires_approval`), menolak halaman di luar 1 sampai 604, dan audit log tidak dapat diubah.

## Teks Al-Qur'an: verbatim

Lisensi Tanzil mensyaratkan salinan verbatim dengan atribusi. Karena itu:

- `tanzil-build` menyalin teks apa adanya: tanpa trim, normalisasi, atau penghapusan basmalah. Bentuk
  ternormalisasi hanya masuk ke kolom pencarian terpisah (`verses.text_normalized`), bukan ke `text_uthmani`.
- API melayani `textUthmani` tanpa perubahan.
- UI menampilkan nama sumber teks dan sumber terjemahan sebagai tautan https (`meta.sourceUrl` dan `editionSource.url`).

### Basmalah

Pada data Tanzil, ayat 1 dari 112 surah (semua kecuali Al-Fatihah dan At-Taubah) diawali teks basmalah di dalam
teksnya sendiri. Data tidak diubah. Untuk tampilan, API menambahkan `bismillahPrefix` pada detail surah:
awalan literal yang dipotong dari ayat 1 surah itu, dikenali dengan membandingkan bentuk ternormalisasi terhadap
ayat 1:1 (tidak ada teks basmalah yang ditulis di kode). Frontend menampilkannya sebagai kepala surah dan
membuang awalan itu dari ayat 1 hanya pada tampilan. Penulisan basmalah pada surah 95 dan 97 berbeda dari 1:1
(ada tasydid tambahan pada huruf pertama); ini ditemukan oleh pengecekan data nyata dan ditangani oleh pencocokan
ternormalisasi, sambil tetap mengembalikan potongan literalnya.

### Verifikasi pada data nyata

Workflow `Quran source check` mengunduh berkas Tanzil, mengonversi, mengimpor ke PostgreSQL sementara, menyetujui
dataset, lalu memeriksa lewat API. Yang dibuktikan: setiap ayat dan terjemahan di database sama persis, karakter
demi karakter, dengan berkas sumber; 114 surah, 6.236 ayat, 30 juz, 604 halaman, 60 hizb; pencarian bekerja;
awalan basmalah dan atribusi tepat. Yang **tidak** dibuktikan: kebenaran isi berkas sumber itu sendiri terhadap
mushaf. Data hanya hidup di database CI sementara dan tidak disimpan di repository.

**Lisensi terjemahan:** nilai lisensi terjemahan di workflow CI adalah penanda ("periksa sebelum distribusi"),
bukan lisensi yang sudah diverifikasi. Pemilik produk harus memeriksa ketentuan terjemahan yang dipakai sebelum
mendistribusikan aplikasi dan mengisi `--translation-license` dengan nilai yang benar.

## Yang TIDAK dapat diperiksa kode

Jumlah dan struktur yang benar tidak menjamin teks benar. Sebelum menyetujui dataset:

1. Bandingkan teks Utsmani dengan mushaf sumber (mis. diff terhadap berkas sumber resmi), termasuk harakat dan tanda waqaf.
2. Periksa sampel terjemahan per surah agar tidak tertukar antarayat.
3. Pastikan setiap tafsir memiliki sumber dan atribusi.
4. Pastikan lisensi mengizinkan distribusi, penyimpanan lokal, dan pemakaian offline.
5. Setujui lewat panel admin oleh orang yang berbeda dari pengimpor; tindakan tercatat di audit log.

Revisi konten (doa, dzikir, Asmaul Husna) mewajibkan kolom sumber dan reviewer yang berbeda dari penulis.
