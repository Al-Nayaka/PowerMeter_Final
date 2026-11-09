# KostWatt — Power Meter Dashboard

Implementasi React dari desain Figma **KostWatt** dengan halaman monitoring, perbandingan, laporan, dan pengaturan.

## Stack

- [Vite](https://vite.dev/) + React + TypeScript
- IBM Plex Sans via `@fontsource/ibm-plex-sans`
- Ikon dari `lucide-react`
- Grafik area SVG custom (tanpa library chart tambahan)

## Menjalankan

Memerlukan Node.js 22.18+ (disarankan Node.js 24). Jalankan dari `Powermeter_LocalServer/frontend/`.

```bash
npm ci
npm run dev
```

Buka <http://localhost:5173>. Halaman perbandingan bisa dibuka langsung lewat <http://localhost:5173/#comparison>.

- Laporan: <http://localhost:5173/#reports>
- Pengaturan: <http://localhost:5173/#settings>

`npm start` juga menjalankan Vite. Backend tetap dijalankan terpisah dari folder `../backend/`; Vite meneruskan `/api` ke `http://localhost:3000` sesuai port bawaan backend. Proxy ini hanya berlaku saat development dan tidak berarti dashboard sudah memakai data backend.

Migrasi dari Create React App dan file lama dijelaskan di `docs/migration.md`.

Perintah lain:

```bash
npm run build    # type-check + build produksi ke dist/
npm run preview  # preview hasil build
npm run lint     # oxlint
npm test         # 13 pengujian, memerlukan Node.js 22.18+ atau 24+
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
    LivePage.tsx       # Halaman live monitoring per power meter
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
- Data grafik diambil dari desain Figma dan disimpan sebagai data contoh di `src/data.ts`.
- Halaman **Power comparison**: pilih board A dan B, tukar board, filter rentang waktu (Live/1 jam/24 jam/7 hari), pilih grafik yang ditampilkan (Watt, Voltage, Arus, Power factor, Daya reaktif, Energi), tiga kartu ringkasan, dan grafik area dua series.
- Interaksi: toggle relay, pilih power meter di sidebar, jam koneksi live, collapse menu Live monitoring, dan navigasi antar halaman.

## Laporan dan pengaturan

- Laporan memakai data contoh Power Meter 1 pada 20–26 Oktober 2026. Filter baru diterapkan setelah **Tampilkan**; periode tidak valid mempertahankan hasil sebelumnya. Board lain dan resolusi per jam menampilkan keadaan kosong, bukan data buatan.
- Ringkasan dan total dihitung dari baris yang ditampilkan. CSV dapat diunduh; XLSX/PDF dinonaktifkan dengan penjelasan.
- Tambah/edit perangkat, batas listrik, notifikasi, preferensi, dan konfigurasi koneksi disimpan di `localStorage`. Validasi menolak ID/nama duplikat, batas tegangan terbalik, dan URL berkredensial.
- Tema terang/gelap berlaku ke dashboard dan bertahan setelah reload. Preferensi selain tema saat ini hanya disimpan, belum diterapkan ke halaman lain.
- Tidak ada backend, koneksi MQTT/API, provisioning perangkat, atau pengiriman notifikasi aktif. Indikator pada daftar meter merupakan bagian dari data contoh.
- Verifikasi browser dan aksesibilitas dicatat di `docs/verification.md`.
