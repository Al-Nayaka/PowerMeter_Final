# Verifikasi integrasi lokal, 10 November 2026

Target: `http://10.18.9.6:5173`, frontend Vite tanpa Nginx. Backend tetap
bind `127.0.0.1:3000`; Vite meneruskan REST `/api` dan WebSocket `/ws`.

## Eksekusi nyata

- `npm test`: 24 tes lulus, termasuk mapping numerik PostgreSQL, ID besar,
  deduplikasi/sortir histori, filter event, counter energi, null PF, dan relay ACK.
- `npm run lint`: tidak ada warning/error. `npm run build`: berhasil.
  Ketiganya dijalankan di laptop dan server ARM64.
- Chromium/Playwright membuka dashboard server: perangkat `PM-ESP32-001`
  tampil offline, pengukuran kosong, status relay belum diketahui, kontrol nonaktif.
- `/api/health` melalui Vite: HTTP 200, database dan MQTT terhubung.
- WebSocket melalui Vite: koneksi berhasil dengan origin dashboard LAN.
- Permintaan `/@fs/.../backend/.env`: HTTP 403; secret backend tidak disajikan.
- Tombol muat ulang status: tetap menampilkan keadaan kosong yang benar.
- Navigasi perbandingan/laporan/pengaturan: halaman terbuka dengan pemberitahuan
  bahwa halaman tersebut masih contoh/pengaturan browser, bukan data backend.
- Toggle tema: terang dan gelap berubah sesuai tombol, tanpa error JavaScript.

## Uji browser terisolasi dengan fixture

REST dan WebSocket diintersep hanya di konteks browser pengujian. Tidak ada
telemetri tiruan ditulis ke database atau perintah relay dikirim ke broker.

- Snapshot REST numerik string: 440 W tampil sebagai 440 W; 12.345 Wh sebagai
  12,345 kWh; PF null tidak dipalsukan menjadi angka.
- Event perangkat lain diabaikan; event perangkat terpilih memperbarui 440 W ke 550 W.
- Tombol Nyalakan mengirim body absolut dan key sesi; status tetap belum diketahui
  selama command published, lalu ON setelah confirmed dan reload status terbaru.
- Key sesi tidak masuk `localStorage`.
- HTTP 401 saat meminta OFF menampilkan error dan mempertahankan ACK ON sebelumnya.
- WebSocket putus: reconnect otomatis dan REST dimuat ulang, nilai terbaru 660 W tampil.
- Keadaan daftar kosong dan backend HTTP 503 ditampilkan dengan petunjuk pemulihan.
- Nama perangkat sepanjang 120 karakter tanpa spasi tidak menyebabkan overflow.
- Lebar 320, 375, 414, 768, 1440 px: tidak ada overflow horizontal pada keadaan nyata,
  daftar kosong, error backend, dan nama panjang. Overflow nama panjang ditemukan
  pada uji awal dan diperbaiki dengan wrapping judul/nama/navigasi.

## Batas verifikasi

ESP belum di-flash atau diuji secara fisik. Telemetri sensor dan ACK GPIO nyata
masih perlu diuji operator; ACK bukan pengukuran kontak relay. Perbandingan/laporan
masih memakai contoh, dan pengaturan browser tidak melakukan provisioning backend.
Vite dan MQTT plaintext hanya untuk pengembangan di jaringan tepercaya, bukan internet.
Layanan systemd frontend/backend diaktifkan untuk boot; reboot fisik belum diuji.
