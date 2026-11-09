# Kontribusi frontend KostWatt

## Lingkup

Frontend baru berada di `Powermeter_LocalServer/frontend/`, bukan folder frontend kedua di root repo. Backend, database, serta firmware tidak diubah.

Create React App diganti dengan Vite, React dan TypeScript. Halaman aktif: live monitoring, perbandingan meter, laporan, dan pengaturan. Navigasi memakai hash sehingga tidak membutuhkan aturan rewrite untuk setiap halaman.

## Entry point dan kompatibilitas

- `index.html` di root frontend memuat `src/main.tsx`, yang secara eksplisit mengimpor `src/App.tsx`.
- Import harus menyertakan `.tsx` karena `src/App.js` lama masih ada dan diprioritaskan oleh resolusi ekstensi Vite bila memakai `./App`.
- File CRA lama seperti `src/App.js`, `src/index.js`, `src/App.test.js`, dan `public/index.html` dipertahankan agar kontribusi tidak menghapus pekerjaan sebelumnya. File tersebut bukan entry point atau pengujian aktif.
- `npm start` dan `npm run dev` menjalankan Vite pada port bawaan 5173, bukan CRA pada port 3000.
- Backend memakai port bawaan 3000. Proxy development `/api` diarahkan ke port tersebut. Bila backend memakai port lain, sesuaikan `server.proxy` dalam `vite.config.ts`.
- `npm run build` menghasilkan `dist/`, bukan `build/`. Hosting produksi perlu melayani `dist/` dan mengatur reverse proxy API secara terpisah.
- Node.js minimum 22.18 diperlukan agar pengujian TypeScript dapat dijalankan langsung. Node.js 24 dipakai saat verifikasi.

## Status integrasi

Dashboard memakai data contoh dari desain Figma. Backend saat ini menyediakan `/api/health` dan `/api/db-test`; tidak ada kontrak endpoint telemetri atau laporan yang diintegrasikan oleh kontribusi ini.

Pengaturan perangkat, batas, notifikasi, dan preferensi disimpan dalam browser. Menyimpan konfigurasi tidak membuat koneksi MQTT/API atau mengendalikan perangkat fisik. Pengaturan selain tema belum memengaruhi halaman lain.

CSV memakai data laporan yang terlihat. Data per jam, data laporan board lain, XLSX/PDF, pengiriman notifikasi, dan kendali perangkat melalui backend belum tersedia.

## Verifikasi sebelum PR

```sh
npm ci
npm run build
npm run lint
npm test
```

Folder `node_modules/`, `dist/`, file `.env`, dan kredensial tidak boleh dimasukkan ke commit. Perubahan lockfile besar disebabkan oleh penggantian dependensi CRA dengan Vite, bukan perubahan backend.
