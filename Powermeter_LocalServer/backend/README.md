# PowerMeter backend

Backend Node.js ES Modules untuk PostgreSQL, MQTT dan WebSocket sesuai PRD v1.0. Tidak terhubung ke server MySQL lama dan tidak menerima protokol `esp/hlw8012/*`.

## Persiapan lokal

Memerlukan Node.js 22+, PostgreSQL dan broker Mosquitto. Perintah dijalankan dari folder ini. Siapkan database **baru/kosong**; schema database terpasang belum diverifikasi. Tidak ada migration atau deploy otomatis saat aplikasi mulai.

```powershell
npm ci
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Isi `.env`: koneksi PostgreSQL, akun MQTT backend, `ADMIN_API_KEY` dari hasil generator, dan origin dashboard. Jangan masukkan file ini ke Git. Key kosong menonaktifkan endpoint tulis; production mensyaratkan key minimal 32 karakter. Akun database runtime sebaiknya berbeda dari pemilik migration.

Review `migrations/001_core.sql` serta **migration terpisah** `002_ingestion_and_commands.sql`. 002 menambah waktu penerimaan, deduplikasi dan pelacakan command; backend ini membutuhkan keduanya. Menulis file migration bukan berarti menerapkannya atau mengesahkan perubahan database lama.

```powershell
# Preview tanpa koneksi database.
npm run db:migrate -- --approve-enhancements

# HANYA setelah operator menyetujui target database dan kedua migration:
npm run db:migrate -- --apply --approve-enhancements

# Opsional, hanya database pengembangan. Membuat tiga device tanpa menimpa data.
$env:NODE_ENV='development'
npm run db:seed -- --apply

npm start
```

`npm run dev` menggunakan watcher bawaan Node. `HOST=127.0.0.1` menghindari API terbuka ke LAN secara tidak sengaja; gunakan Nginx untuk akses LAN. Sesuaikan origin yang diizinkan, bukan wildcard. MQTT broker tetap harus terjangkau ESP dan memakai auth/ACL. Tidak ada browser yang perlu mengetahui password MQTT.

## Uji tanpa ESP

```powershell
npm test
npm run simulate
```

Simulator membutuhkan broker aktif, kredensial **akun perangkat**, dan device yang sudah terdaftar/enabled. Jangan jalankan simulator dan ESP fisik dengan kode yang sama. `SIM_DEVICE_CODE` memilih perangkat; default `PM-ESP32-001`. Energy simulator kembali nol saat restart, bukan data konsumsi nyata.

Tes otomatis memakai **PGlite (PostgreSQL embedded/WASM)** untuk SQL dan Aedes untuk broker MQTT di TCP loopback, HTTP serta WebSocket nyata. Tes tidak memerlukan Docker/database luar dan tidak mengubah data server. Ini belum menggantikan uji `pg.Pool` ke PostgreSQL native, Mosquitto dengan ACL, Raspberry Pi, maupun perangkat fisik.

## REST API

Semua endpoint memakai prefix `/api`. Respons normal `{ "success": true, "data": ... }`; error `{ "success": false, "message": "..." }`.

| Method | Path | Akses |
|---|---|---|
| GET | `/health` | Read; 200 siap, 503 bila DB/MQTT bermasalah |
| GET | `/devices`, `/devices/:deviceCode` | Read |
| POST | `/devices` | Admin |
| PATCH | `/devices/:deviceCode` | Admin; nama/lokasi saja |
| PATCH | `/devices/:deviceCode/status` | Admin; `is_enabled` boolean |
| GET | `/measurements/latest/:deviceCode` | Read; 404 bila belum ada sampel |
| GET | `/measurements/history/:deviceCode?limit=100` | Read; default 100, maksimum 1000 |
| GET | `/relays/:deviceCode` | Read; histori status terbaru per nomor relay |
| POST | `/relays/:deviceCode/commands` | Admin; HTTP 202 bukan bukti relay berubah |
| GET | `/relays/:deviceCode/commands/:commandId` | Admin; status command tersimpan |

Header admin: `Authorization: Bearer <ADMIN_API_KEY>`. Key adalah akses operator bersama, bukan sistem akun/multi-role. Endpoint read dan WebSocket tidak memakai autentikasi; batasi ke LAN tepercaya/reverse proxy terautentikasi. CORS bukan proteksi terhadap client non-browser. Jangan expose API/broker ke internet. TLS wajib sebelum mengirim key lewat jaringan yang tidak dipercaya.

Registrasi:

```json
{"device_code":"PM-ESP32-001","device_name":"Panel Utama","location":"Ruang 1","mqtt_topic_prefix":"powermeter/PM-ESP32-001"}
```

Kode perangkat: ASCII huruf/angka, `_`, `-`, maksimal 64. Firmware membatasi 48, sehingga gunakan maksimal 48 untuk perangkat nyata. Prefix harus tepat `powermeter/{device_code}`. Perangkat tidak didaftarkan otomatis dari MQTT.

Histori mendukung `from` dan `to` berupa ISO timestamp **berzona waktu**, inklusif. URL-encode tanda `+` pada offset atau gunakan UTC `Z`. Urutan terbaru dahulu: `recorded_at DESC, id DESC`. NUMERIC dan BIGINT pada driver PostgreSQL native dikembalikan sebagai string untuk mempertahankan presisi; jangan memaksa ID menjadi JavaScript number. `received_at` adalah waktu penerimaan, bukan waktu sensor.

Command: `{"relay_number":1,"state":true}`. Hanya satu relay didukung. Backend menolak device offline/disabled dan broker tidak siap; hanya satu command pending per perangkat. UUID dibuat server. Status `requested` → `published` → `confirmed`, atau `failed`/`timed_out`. Pengiriman selalu QoS1 **retain=false**. ACK wajib cocok ID, device, relay dan state; ACK duplikat tidak menggandakan histori. HTTP 202 dapat sudah berstatus confirmed jika ACK sangat cepat. Timeout tetap tersimpan dan bisa diperiksa lewat GET command. Tidak ada retry otomatis yang bisa menyalakan beban diam-diam setelah reconnect.

ACK firmware hanya berarti GPIO diperintahkan, **bukan kontak relay terukur**. State awal belum diketahui sampai ada ACK valid; array kosong bukan berarti OFF. Command bukan proteksi keselamatan listrik.

## MQTT dan realtime

Topic: `powermeter/{device_code}/{measurement|heartbeat|availability|relay/command|relay/state}`. Detail di `docs/mqtt-protocol.md` dan firmware `../../Powermeter_ESP/PowerMeter_PRD/README.md`.

Measurement numeric dan finite; energi Wh kumulatif wajib, PF nullable. `message_id` opsional demi kontrak PRD awal; deduplikasi hanya berlaku bila ID ada. Firmware baru selalu mengirim ID unik per boot/sampel. Identitas topic dan payload wajib sama. Insert dan pembaruan last_seen berada dalam satu transaksi dengan lock device, lalu broadcast dilakukan **setelah commit**. DB gagal: tidak broadcast, tidak ada buffer durable; sampel dapat hilang.

Antrean ingestion dibatasi 100 pesan (konfigurabel), payload maksimum 4096 byte; overflow dibuang dan event penolakan dibatasi frekuensinya. Logging tidak mencetak payload/secret tiap sampel. Backend menerima sampel out-of-order dan memakai waktu sensor untuk latest; pastikan NTP perangkat/server benar. Tidak ada replay histori offline. Availability online retained yang baru dibaca saat subscribe diabaikan agar tidak menghidupkan status basi; heartbeat atau measurement baru mengaktifkan kembali device. LWT offline retained diterima. Timeout default 45 detik, maintenance 1 detik; broker LWT dapat lebih lambat dari pemutusan fisik.

WebSocket: `/ws` atau `/ws?device_code=PM-ESP32-001`, dengan `{ "type": "measurement", "data": ... }`. Event: `measurement`, `device_status`, `relay_state`, `system_event`. Client terfilter menerima event yang memiliki device_code cocok; system event global hanya diterima koneksi tanpa filter. Tidak ada snapshot otomatis: gunakan REST untuk data awal dan histori. Socket lambat/tidak menjawab ping diputus; jumlah client dibatasi 100. Frontend harus memuat ulang data REST setelah reconnect.

## Batas implementasi

- Frontend belum dihubungkan ke API; data contoh/localStorage yang ada tidak diubah.
- Belum ada API agregasi laporan/perbandingan, tarif, notifikasi, atau kalkulasi tagihan.
- Jangan menjumlahkan nilai energi kumulatif. Penurunan counter saat reboot/reset perlu ditangani dalam fitur agregasi mendatang, bukan dihitung sebagai konsumsi negatif.
- Firmware memakai PubSubClient: publish telemetri/heartbeat/ACK QoS0; detail keterbatasan dan replay ada di README firmware.
- Retensi dan backup tersedia sebagai operasi manual, bukan jadwal otomatis. Device/event/command histories masih memerlukan evaluasi retensi terpisah.
- Native PostgreSQL/Mosquitto, auth/ACL nyata, reboot Pi, backup/restore dan hardware perlu uji operator.

Panduan lanjutan: `docs/schema-and-operations.md`, `docs/deployment.md`. PRD asli disalin utuh di `docs/PowerMeter_Backend_PRD.md`.
