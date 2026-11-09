# KostWatt — Power Meter Dashboard

Implementasi React dari desain Figma **KostWatt** dengan halaman monitoring, perbandingan, laporan, dan pengaturan.

## Stack

- [Vite](https://vite.dev/) + React + TypeScript
- IBM Plex Sans via `@fontsource/ibm-plex-sans`
- Ikon dari `lucide-react`
- Grafik area SVG custom (tanpa library chart tambahan)

## Menjalankan

```bash
npm install
npm run dev
```

Buka <http://localhost:5173>. Halaman perbandingan bisa dibuka langsung lewat <http://localhost:5173/#comparison>.

### Backend lokal dan ESP

Jalankan backend di port 3000 terlebih dahulu, lalu `npm run dev -- --host 0.0.0.0`
untuk akses dashboard dari perangkat pada LAN tepercaya di `http://IP_SERVER:5173`.
Tidak perlu Nginx. Vite meneruskan `/api` dan `/ws` ke backend loopback port 3000;
browser tidak memerlukan password MQTT. Tambahkan origin dashboard yang tepat
ke `ALLOWED_ORIGINS` backend dan restart backend setelah mengubahnya.
Vite dev server ini hanya untuk pengembangan lokal, bukan layanan publik internet.

Live monitoring memakai daftar perangkat, latest, histori, status relay dari REST,
serta pembaruan WebSocket. Daftarkan `PM-ESP32-001` di backend sebelum flash firmware
`Powermeter_ESP/PowerMeter_PRD`; username MQTT perangkat dan `DEVICE_CODE` harus cocok.
Sebelum telemetri nyata diterima, monitoring menampilkan keadaan kosong/offline,
bukan grafik contoh. Nilai energi merupakan counter kumulatif perangkat, bukan tagihan.

Kontrol relay memerlukan `ADMIN_API_KEY` backend yang dimasukkan untuk sesi halaman
saja, tidak disimpan ke localStorage. HTTP 202 belum berarti relay berubah;
tunggu ACK perangkat. ACK mengonfirmasi perintah GPIO, bukan kontak listrik terukur.
Jangan mengirim key lewat Wi-Fi/jaringan tidak tepercaya tanpa TLS.

Halaman perbandingan, laporan, dan pengaturan lama masih merupakan contoh/pengaturan
browser. Menambah perangkat melalui pengaturan browser **tidak mendaftarkan**
perangkat ke backend. Gunakan API admin untuk registrasi perangkat nyata.

- Laporan: <http://localhost:5173/#reports>
- Pengaturan: <http://localhost:5173/#settings>

Perintah lain:

```bash
npm run build    # type-check + build produksi ke dist/
npm run preview  # preview hasil build
npm run lint     # oxlint
npm test         # memerlukan Node.js 22.18+ atau 24+
```

## Struktur

```text
src/
  components/
    Cards.tsx       # Relay, total pemakaian, power factor, daya reaktif
    ChartCard.tsx   # Kartu metrik + grafik area SVG
    Logo.tsx        # Logo bolt KostWatt
    Sidebar.tsx     # Navigasi, daftar power meter, profil pengguna
    TopBar.tsx      # Status koneksi (jam live) + tanggal
    ComparisonChart.tsx  # Grafik area dua series (board A vs B)
  pages/
    LivePage.tsx       # Monitoring REST + WebSocket per perangkat backend
    ComparisonPage.tsx # Halaman perbandingan dua board
    ReportsPage.tsx    # Filter, ringkasan, tabel dan ekspor CSV
    SettingsPage.tsx   # Perangkat, batas listrik, notifikasi, preferensi
  reports.ts        # Sampel laporan, validasi, agregasi dan CSV
  settings.ts       # Validasi dan penyimpanan pengaturan lokal
  navigation.ts     # Pemetaan hash halaman
  data.ts           # Data contoh grafik, seri perbandingan & konfigurasi kartu
  index.css         # Design token dan seluruh styling
  App.tsx           # Komposisi halaman + navigasi
```

## Catatan desain

- Palet: `#0D171A` (background), `#082D33` (sidebar), `#142226` (kartu), aksen teal `#4FD8DC`, hijau `#3FCF9E`, kuning `#F2AC2E`.
- Data contoh Figma di `src/data.ts` masih dipakai halaman perbandingan. Live monitoring tidak memakai seri contoh tersebut.
- Halaman **Power comparison**: pilih board A dan B, tukar board, filter rentang waktu (Live/1 jam/24 jam/7 hari), pilih grafik yang ditampilkan (Watt, Voltage, Arus, Power factor, Daya reaktif, Energi), tiga kartu ringkasan, dan grafik area dua series.
- Interaksi: toggle relay, pilih power meter di sidebar, jam koneksi live, collapse menu Live monitoring, dan navigasi antar halaman.

## Laporan dan pengaturan

- Laporan memakai data contoh Power Meter 1 pada 20–26 Oktober 2026. Filter baru diterapkan setelah **Tampilkan**; periode tidak valid mempertahankan hasil sebelumnya. Board lain dan resolusi per jam menampilkan keadaan kosong, bukan data buatan.
- Ringkasan dan total dihitung dari baris yang ditampilkan. CSV dapat diunduh; XLSX/PDF dinonaktifkan dengan penjelasan.
- Tambah/edit perangkat, batas listrik, notifikasi, preferensi, dan konfigurasi koneksi disimpan di `localStorage`. Validasi menolak ID/nama duplikat, batas tegangan terbalik, dan URL berkredensial.
- Tema terang/gelap berlaku ke dashboard dan bertahan setelah reload. Preferensi selain tema saat ini hanya disimpan, belum diterapkan ke halaman lain.
- Live monitoring dan daftar meter terhubung ke backend melalui proxy lokal Vite. Perbandingan/laporan masih menggunakan data contoh; pengaturan selain tema hanya tersimpan di browser, tanpa provisioning perangkat atau pengiriman notifikasi.
- Verifikasi browser dan aksesibilitas dicatat di `docs/verification.md`.
