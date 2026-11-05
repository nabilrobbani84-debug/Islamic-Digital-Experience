# Integritas data keagamaan

Aplikasi ini tidak membawa teks Al-Qur'an, terjemahan, tafsir, hadis, doa, dzikir, atau Asmaul Husna.
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

## Yang TIDAK dapat diperiksa kode

Jumlah dan struktur yang benar tidak menjamin teks benar. Sebelum menyetujui dataset:

1. Bandingkan teks Utsmani dengan mushaf sumber (mis. diff terhadap berkas sumber resmi), termasuk harakat dan tanda waqaf.
2. Periksa sampel terjemahan per surah agar tidak tertukar antarayat.
3. Pastikan setiap tafsir memiliki sumber dan atribusi.
4. Pastikan lisensi mengizinkan distribusi, penyimpanan lokal, dan pemakaian offline.
5. Setujui lewat panel admin oleh orang yang berbeda dari pengimpor; tindakan tercatat di audit log.

Revisi konten (doa, dzikir, Asmaul Husna) mewajibkan kolom sumber dan reviewer yang berbeda dari penulis.
