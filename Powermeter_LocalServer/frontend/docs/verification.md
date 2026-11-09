# Verifikasi Laporan dan Pengaturan

Tanggal: 9 November 2026. Lingkungan: Node.js 24, Chromium headless via Playwright.

## Hasil

- PASS: `npm run build`, pemeriksaan TypeScript dan build Vite.
- PASS: `npm run lint`, tanpa peringatan.
- PASS: `npm test`, 13 pengujian navigasi, laporan, CSV, validasi, parsing, dan kegagalan penyimpanan.
- PASS: Impeccable detector pada halaman baru dan integrasinya, hasil `[]`.
- PASS: axe WCAG 2 A/AA dan 2.1 AA, tidak ada pelanggaran otomatis pada Laporan/Pengaturan dalam tema terang maupun gelap. Ini bukan sertifikasi aksesibilitas atau pengujian pembaca layar manual.
- PASS: kedua halaman dalam dua tema pada lebar 320, 375, 414, 768, 1440 px, tanpa overflow horizontal dokumen. Tabel laporan memiliki scroll horizontal sendiri.
- PASS: tidak ada `pageerror` browser sepanjang alur utama.

## Interaksi yang dieksekusi di browser

- Buka `#reports`: tujuh baris sampel tampil.
- Ubah tanggal mulai: hasil tetap sampai Tampilkan diklik; submit periode 24–26 Oktober menampilkan tiga baris.
- Submit periode terbalik: peringatan tampil dan tiga baris sebelumnya tetap ada.
- Ekspor CSV: browser menerima unduhan dengan nama meter dan periode.
- Per jam + Tampilkan: keadaan kosong tampil dan CSV dinonaktifkan; Per hari mengembalikan sampel.
- Navigasi Laporan/Pengaturan: halaman serta hash berubah; Back/Forward browser memulihkan halaman yang sesuai.
- Tambah perangkat: dialog memvalidasi dan menyimpan perangkat lokal baru.
- Edit perangkat: perubahan nama tersimpan; membuka ulang dialog lalu Escape menutup dialog.
- Simpan batas tegangan terbalik: validasi muncul. Simpan batas valid: data bertahan setelah reload.
- Toggle notifikasi daya: nilai bertahan setelah reload.
- Light/Dark: tema berubah; pilihan bertahan setelah reload.
- Reset batas: tegangan minimum kembali ke 198 V.
- Koneksi Sistem: disclosure membuka/menutup; topik MQTT wildcard ditolak, konfigurasi valid tersimpan lokal tanpa membuat koneksi.

## Batas implementasi

Data tetap merupakan contoh, bukan telemetri. Resolusi per jam, data board lain, backend, MQTT/API aktif, notifikasi eksternal, serta XLSX/PDF belum tersedia. Preferensi selain tema tersimpan sebagai konfigurasi lokal dan belum mengubah halaman lain.

## Keputusan visual

Palet teal dan IBM Plex Sans dipertahankan dari proyek/Figma. Lima ringkasan mengutamakan energi, biaya, ekstrem daya, dan PF; angka memakai tabular numerals. Pengaturan dikelompokkan menjadi perangkat, batas, notifikasi, dan preferensi sesuai referensi. Grid turun menjadi satu kolom pada layar kecil; kontrol memakai target sentuh minimum 44 px. Animasi dibatasi pada feedback kontrol dan menghormati reduced motion.
