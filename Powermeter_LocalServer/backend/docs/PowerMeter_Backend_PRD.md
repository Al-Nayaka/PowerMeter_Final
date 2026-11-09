# Product Requirements Document (PRD)
# PowerMeter Local Server — Backend

**Dokumen:** Product Requirements Document (PRD)  
**Produk:** PowerMeter Local Server  
**Komponen:** Backend API, MQTT integration, database access, WebSocket  
**Versi:** 1.0  
**Tanggal:** 9 November 2026  
**Status:** Draft — untuk menjadi acuan implementasi dan pengujian

---

## 1. Ringkasan Produk

PowerMeter Local Server adalah sistem monitoring dan kontrol energi listrik berbasis jaringan lokal (LAN). Backend menjadi pusat komunikasi antara perangkat ESP32, MQTT Broker, PostgreSQL, dan React Dashboard.

Backend menerima telemetri dari ESP32 melalui MQTT, memvalidasi identitas dan isi pesan, menyimpan pengukuran ke PostgreSQL, menyediakan REST API untuk dashboard, serta meneruskan pembaruan terbaru melalui WebSocket. Backend juga menyediakan fondasi pengelolaan perangkat, kontrol relay, dan pencatatan kejadian sistem.

Backend dirancang sebagai **modular monolith**: satu aplikasi Node.js yang dijalankan sebagai satu service, tetapi kode dipisahkan berdasarkan domain dan tanggung jawab.

### 1.1 Tujuan

1. Menerima data pengukuran dari beberapa ESP32 melalui MQTT.
2. Menyimpan data pengukuran secara konsisten ke PostgreSQL.
3. Menyediakan REST API untuk data perangkat, pengukuran terbaru, dan histori.
4. Mengirim pembaruan pengukuran ke React Dashboard melalui WebSocket.
5. Mengelola identitas dan status perangkat secara dinamis.
6. Menyediakan mekanisme pengiriman perintah relay dan pencatatan konfirmasi status.
7. Mencatat kejadian penting agar kondisi sistem dapat ditelusuri.
8. Berjalan pada Raspberry Pi 4 Model B dengan akses dashboard melalui LAN.

### 1.2 Bukan Tujuan (Out of Scope)

Untuk rilis awal, backend tidak bertujuan untuk:

- Menyediakan akses cloud atau akses dari internet.
- Menggunakan microservices, Kubernetes, atau message streaming platform selain MQTT.
- Menyediakan sistem billing atau tarif listrik kompleks.
- Menjalankan machine learning atau prediksi konsumsi energi.
- Menggantikan proteksi listrik fisik atau perangkat keselamatan.
- Menyediakan multi-tenant dan role management kompleks.
- Menggunakan time-series database terpisah; PostgreSQL digunakan terlebih dahulu.

---

## 2. Konteks dan Arsitektur Sistem

### 2.1 Komponen Sistem

| Komponen | Teknologi | Tanggung jawab |
|---|---|---|
| Perangkat pengukur | ESP32 + HLW8012 | Membaca parameter listrik dan mengirim telemetri |
| Broker pesan | Mosquitto MQTT | Menerima dan meneruskan pesan MQTT |
| Backend | Node.js + Express | Validasi, business logic, API, integrasi MQTT |
| Database | PostgreSQL | Menyimpan perangkat, pengukuran, status relay, dan event |
| Realtime transport | WebSocket (`ws`) | Mengirim pembaruan dari backend ke dashboard |
| Frontend | React | Menampilkan monitoring dan kontrol |
| Reverse proxy | Nginx (deployment) | Menyajikan React build dan meneruskan API/WebSocket |
| Host | Raspberry Pi 4, RAM 4 GB | Menjalankan service lokal |

### 2.2 Alur Telemetri

1. ESP32 membaca tegangan, arus, daya aktif, energi kumulatif, dan power factor jika tersedia.
2. ESP32 mengirim JSON ke topic MQTT perangkat.
3. MQTT Subscriber pada backend menerima pesan.
4. Topic Handler memeriksa format topic dan kesesuaian `device_code`.
5. Ingestion Service memvalidasi data dan memeriksa perangkat.
6. Measurement Repository menyimpan pengukuran ke tabel `measurements`.
7. Backend memperbarui `devices.last_seen_at`.
8. Setelah penyimpanan berhasil, backend mengirim event pengukuran melalui WebSocket.
9. React memperbarui tampilan tanpa melakukan polling terus-menerus.

### 2.3 Alur Permintaan Dashboard

**Data awal dan histori:**

`React → REST API → Controller → Service → Repository → PostgreSQL → React`

**Pembaruan real-time:**

`ESP32 → MQTT → Backend → PostgreSQL → WebSocket → React`

**Kontrol relay:**

`React → REST API → Relay Controller → Relay Service → MQTT Publisher → ESP32 → Relay State Acknowledgement → PostgreSQL → WebSocket`

### 2.4 Prinsip Arsitektur

- ESP32 **tidak** terhubung langsung ke PostgreSQL.
- React **tidak** terhubung langsung ke PostgreSQL atau MQTT Broker.
- Semua akses database dilakukan oleh backend.
- Semua perangkat harus terdaftar dan enabled sebelum telemetrinya diterima.
- MQTT topic dan payload harus konsisten dengan identitas perangkat.
- Penyimpanan database harus berhasil sebelum pengukuran disiarkan sebagai data tersimpan melalui WebSocket.
- Kegagalan satu subsistem tidak boleh membuat seluruh backend crash tanpa penanganan.
- Modul domain tidak boleh saling menjalankan query SQL secara langsung; akses data dilakukan melalui repository domain terkait.

---

## 3. Target Deployment dan Batasan

### 3.1 Target Hardware

- Raspberry Pi 4 Model B.
- RAM 4 GB.
- Media awal: microSD.
- Disarankan menggunakan Ethernet untuk koneksi Raspberry Pi ke router/switch.
- ESP32 dan dashboard dapat menggunakan Wi-Fi pada LAN yang sama.

### 3.2 Skala Awal

- 1–5 perangkat ESP32.
- Telemetri nominal setiap 1 detik per perangkat.
- Dashboard diakses dari browser HP, tablet, atau laptop dalam LAN.
- Backend dan database berjalan pada Raspberry Pi yang sama untuk tahap awal.

### 3.3 Implikasi Beban Data

Dengan interval 1 detik:

- 1 perangkat: sekitar 86.400 pengukuran/hari.
- 5 perangkat: sekitar 432.000 pengukuran/hari.
- 5 perangkat selama 30 hari: sekitar 12,96 juta baris.

Backend harus menggunakan query terindeks, pagination/limit, dan kebijakan retensi data. Jangan mengambil seluruh histori sekaligus untuk dashboard.

---

## 4. Pengguna dan Aktor Sistem

| Aktor | Kebutuhan |
|---|---|
| Operator dashboard | Melihat pengukuran terbaru, histori, status perangkat, dan status relay |
| Administrator sistem | Mendaftarkan, mengubah, mengaktifkan, dan menonaktifkan perangkat |
| ESP32 | Mengirim telemetri, heartbeat/status, dan menerima perintah relay |
| React Dashboard | Meminta data melalui REST API dan menerima pembaruan WebSocket |
| Backend | Memvalidasi, memproses, menyimpan, dan mendistribusikan data |

Rilis awal dapat menggunakan satu jenis akses operator/admin pada LAN. Namun, endpoint administratif dan kontrol relay tetap perlu dirancang agar mudah ditambahkan autentikasi.

---

## 5. Database Requirements

Backend menggunakan PostgreSQL dan mengikuti schema yang telah ditentukan proyek.

### 5.1 Tabel `devices`

Menyimpan identitas dan status perangkat.

Kolom:

- `id`: primary key.
- `device_code`: kode unik perangkat.
- `device_name`: nama yang ditampilkan.
- `location`: lokasi perangkat.
- `mqtt_topic_prefix`: prefix topic MQTT unik.
- `is_enabled`: apakah perangkat diizinkan mengirim data.
- `last_seen_at`: waktu terakhir backend menerima komunikasi valid.
- `created_at`: waktu pendaftaran.

Aturan:

- `device_code` harus unik.
- `mqtt_topic_prefix` harus unik.
- Perangkat baru tidak otomatis dipercaya hanya karena mengirim pesan MQTT.
- Perangkat disabled tidak boleh menghasilkan pengukuran baru.
- Perubahan identitas perangkat harus dilakukan melalui API administrasi atau prosedur database yang terkendali.

### 5.2 Tabel `measurements`

Menyimpan histori pengukuran.

Kolom:

- `id`
- `device_id`
- `voltage`
- `current`
- `active_power`
- `energy_wh`
- `power_factor`
- `recorded_at`

Aturan:

- `device_id` mengacu ke `devices.id`.
- Nilai tegangan, arus, daya, dan energi tidak boleh negatif.
- `power_factor` boleh null jika tidak tersedia dari sensor; jika ada harus berada pada rentang 0–1.
- `recorded_at` adalah timestamp pengukuran dari perangkat.
- Backend perlu membedakan waktu pengukuran (`recorded_at`) dan waktu penerimaan server. Schema saat ini belum memiliki `received_at`; penambahannya direkomendasikan untuk audit keterlambatan dan diagnostik.
- `energy_wh` merupakan energi kumulatif, bukan energi interval. Backend tidak boleh menjumlahkan semua nilai kumulatif untuk menghitung total konsumsi.
- Pengurutan data harus menggunakan `recorded_at` dan `id` sebagai tie-breaker.

### 5.3 Tabel `relay_states`

Menyimpan histori perubahan status relay.

Kolom:

- `id`
- `device_id`
- `relay_number`
- `state`
- `changed_at`

Aturan:

- Setiap perubahan status yang terkonfirmasi dari perangkat dicatat.
- Perintah yang dikirim tidak boleh dianggap berhasil sebelum ada acknowledgement/status dari ESP32.
- `state = true` berarti relay ON dan `false` berarti relay OFF; definisi ini harus konsisten di firmware, backend, dan frontend.
- Tabel ini menyimpan histori, bukan sekadar status terakhir. Status terakhir diambil dari record terbaru per perangkat dan nomor relay.

### 5.4 Tabel `system_events`

Mencatat kejadian penting.

Contoh event:

- Device registered.
- Device enabled/disabled.
- Device became offline/online.
- MQTT connection lost/restored.
- Invalid payload received.
- Relay command timed out.
- Relay state changed.

Aturan:

- Jangan menyimpan setiap heartbeat atau setiap pengukuran sebagai system event.
- Event harus memiliki `event_type` yang konsisten dan deskripsi yang berguna.
- `device_id` boleh null untuk kejadian sistem yang tidak terkait perangkat tertentu.
- Jika perangkat dihapus, foreign key menggunakan `ON DELETE SET NULL` sesuai schema.

### 5.5 Indeks

Schema awal menyediakan indeks:

- `idx_measurements_device_time`
- `idx_relay_states_device_time`
- `idx_system_events_device_time`

Backend harus menggunakan kolom yang sesuai dengan indeks tersebut pada query histori dan status terbaru.

### 5.6 Rekomendasi Perubahan Schema Sebelum Production

Perubahan berikut tidak wajib untuk prototipe pertama, tetapi direkomendasikan sebelum sistem dianggap andal:

1. Tambahkan `received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` pada `measurements`.
2. Tambahkan `message_id` pada payload dan tabel `measurements`, lalu unique constraint `(device_id, message_id)` untuk deduplikasi pesan MQTT QoS 1.
3. Pertimbangkan tabel `relay_commands` untuk melacak lifecycle perintah: requested, published, acknowledged, confirmed, timed out, atau failed. `relay_states` saja tidak cukup untuk merekam seluruh lifecycle command.
4. Pertimbangkan tabel `device_credentials` atau mekanisme secret provisioning untuk identitas autentikasi tiap perangkat. Jangan menyimpan password MQTT plaintext di tabel `devices`.
5. Buat migration SQL untuk setiap perubahan schema; hindari mengubah schema production secara manual tanpa catatan.

Jangan menambahkan perubahan tersebut secara diam-diam: dokumentasikan dan setujui sebagai migration terpisah.

---

## 6. MQTT Protocol Requirements

### 6.1 Topic Convention

Format topic:

`powermeter/{device_code}/{message_type}`

Topic minimum:

| Topic | Arah | Tujuan | QoS awal |
|---|---|---|---|
| `powermeter/{device_code}/measurement` | ESP32 → Backend | Telemetri listrik | 0 |
| `powermeter/{device_code}/heartbeat` | ESP32 → Backend | Heartbeat perangkat | 1 |
| `powermeter/{device_code}/availability` | ESP32 → Backend | Online/offline melalui status/LWT | 1 |
| `powermeter/{device_code}/relay/command` | Backend → ESP32 | Perintah relay | 1 |
| `powermeter/{device_code}/relay/state` | ESP32 → Backend | Konfirmasi status relay | 1 |

QoS 0 dapat digunakan untuk pengukuran periodik jika kehilangan sampel sesekali dapat diterima. QoS 1 lebih sesuai untuk command dan acknowledgement, tetapi memungkinkan duplikasi pesan sehingga backend perlu idempotensi/deduplikasi.

### 6.2 Measurement Payload

Contoh payload:

```json
{
  "device_code": "PM-ESP32-001",
  "message_id": "PM-ESP32-001-00001234",
  "voltage": 220.5,
  "current": 1.25,
  "active_power": 275.6,
  "energy_wh": 1520.8,
  "power_factor": 0.95,
  "recorded_at": "2026-11-09T10:00:00.000Z"
}
```

Ketentuan:

- `device_code`: wajib dan harus sama dengan identitas di topic.
- `message_id`: direkomendasikan dan harus unik per perangkat.
- `voltage`, `current`, `active_power`, `energy_wh`: angka finite dan tidak negatif.
- `power_factor`: angka 0–1 atau null/tidak dikirim.
- `recorded_at`: ISO 8601 dengan zona waktu, idealnya UTC (`Z`).
- Payload tidak valid harus ditolak dan dicatat sebagai event/error secara terkontrol.
- Backend tidak boleh mempercayai `device_code` dari payload saja; cocokkan dengan topic dan perangkat terdaftar.

### 6.3 Device Heartbeat dan Availability

- ESP32 mengirim heartbeat berkala, misalnya setiap 15 detik.
- Backend memperbarui `last_seen_at` saat menerima komunikasi valid.
- Status offline ditentukan berdasarkan timeout yang dapat dikonfigurasi, bukan hanya karena tidak ada pengukuran dalam satu interval.
- MQTT Last Will and Testament (LWT) direkomendasikan untuk menandai perangkat offline ketika koneksi broker terputus.
- Online/offline harus disebarkan ke dashboard melalui WebSocket dan/atau endpoint device.

### 6.4 MQTT Security

- Aktifkan username/password pada Mosquitto.
- Gunakan ACL agar setiap perangkat hanya dapat publish ke topic miliknya dan subscribe pada topic command miliknya.
- Backend menggunakan akun khusus yang memiliki izin subscribe/publish yang diperlukan.
- Jangan mengekspos broker ke internet.
- Jangan menaruh credential production di repository Git.

---

## 7. Functional Requirements

Prioritas:
- **P0:** wajib untuk rilis backend pengukuran awal.
- **P1:** wajib untuk rilis kontrol perangkat/relay.
- **P2:** pengembangan lanjutan.

### FR-01 — Koneksi Database (P0)

Backend harus:

- Membuat PostgreSQL connection pool.
- Membaca konfigurasi dari environment variables.
- Menangani koneksi gagal tanpa menampilkan password atau secret ke log.
- Menutup pool saat graceful shutdown.

Acceptance criteria:

- Backend dapat melakukan query ke database yang benar.
- Backend gagal startup dengan pesan konfigurasi yang jelas jika konfigurasi wajib tidak tersedia.
- Secret tidak muncul pada log.

### FR-02 — Koneksi MQTT (P0)

Backend harus:

- Terhubung ke Mosquitto menggunakan konfigurasi environment.
- Melakukan reconnect otomatis.
- Subscribe ke topic measurement perangkat.
- Menangani error, offline, dan reconnect.
- Tidak membuat koneksi MQTT ganda yang tidak diperlukan.

Acceptance criteria:

- Backend dapat menerima pesan dari lebih dari satu `device_code`.
- Setelah broker restart, backend dapat reconnect dan subscribe ulang.
- Kegagalan broker tidak membuat proses Node.js berhenti secara tidak terkendali.

### FR-03 — Ingestion Measurement (P0)

Backend harus:

- Memvalidasi format topic.
- Mem-parse JSON.
- Memastikan `device_code` payload sama dengan device code pada topic.
- Memastikan perangkat terdaftar dan enabled.
- Memvalidasi nilai numerik dan timestamp.
- Menyimpan pengukuran ke `measurements`.
- Memperbarui `devices.last_seen_at`.
- Menolak payload tidak valid atau perangkat tidak dikenal.
- Mengirim WebSocket measurement event hanya setelah penyimpanan berhasil.

Acceptance criteria:

- Pesan valid menghasilkan satu record pengukuran.
- Pesan dari perangkat tidak dikenal tidak tersimpan.
- Pesan dari perangkat disabled tidak tersimpan.
- Payload malformed tidak menjatuhkan backend.
- Nilai di luar constraint database ditolak dan error ditangani.

### FR-04 — Device Management (P0/P1)

Backend harus menyediakan operasi:

- Melihat daftar perangkat.
- Melihat detail perangkat.
- Mendaftarkan perangkat.
- Mengubah nama/lokasi.
- Enable/disable perangkat.

Acceptance criteria:

- `device_code` dan `mqtt_topic_prefix` tidak boleh duplikat.
- Perangkat disabled tidak dapat mengirim pengukuran yang diterima database.
- Perubahan perangkat dapat dilihat dashboard.

### FR-05 — Latest Measurement API (P0)

Backend harus menyediakan data pengukuran terakhir untuk satu perangkat.

Acceptance criteria:

- Mengembalikan data terbaru berdasarkan `recorded_at` dan tie-breaker yang stabil.
- Mengembalikan 404 jika belum ada pengukuran.
- Mengembalikan JSON dengan format respons konsisten.

### FR-06 — Measurement History API (P0)

Backend harus menyediakan histori dengan batas jumlah record.

Acceptance criteria:

- Client dapat menentukan `limit`.
- Backend menetapkan batas maksimum limit.
- Data diurutkan terbaru ke terlama.
- Endpoint tidak mengembalikan seluruh database tanpa batas.
- Filter rentang waktu dapat ditambahkan sebagai peningkatan berikutnya.

### FR-07 — WebSocket Updates (P0)

Backend harus:

- Menyediakan WebSocket pada path `/ws`.
- Mengirim event pengukuran baru setelah tersimpan.
- Mengirim event status perangkat dan relay ketika modul terkait tersedia.
- Menangani client disconnect.
- Tidak mengirim data ke socket yang sudah tertutup.

Format event:

```json
{
  "type": "measurement",
  "data": {
    "device_code": "PM-ESP32-001",
    "voltage": "220.50",
    "current": "1.250",
    "active_power": "275.60",
    "energy_wh": "1520.800",
    "power_factor": "0.9500",
    "recorded_at": "2026-11-09T10:00:00.000Z"
  }
}
```

Acceptance criteria:

- Client menerima event baru tanpa polling.
- Client dapat memfilter event berdasarkan `device_code`.
- Data yang belum berhasil disimpan tidak disiarkan sebagai measurement tersimpan.

### FR-08 — Relay Control (P1)

Backend harus:

- Menerima permintaan ON/OFF dari dashboard.
- Memastikan perangkat terdaftar dan enabled.
- Memvalidasi nomor relay dan nilai state.
- Menerbitkan command ke topic relay perangkat.
- Mengidentifikasi command secara unik.
- Menunggu acknowledgement/status dari ESP32.
- Mencatat status yang benar-benar dikonfirmasi ke `relay_states`.
- Menangani timeout dan kegagalan pengiriman.

Contoh command:

```json
{
  "command_id": "cmd-000001",
  "device_code": "PM-ESP32-001",
  "relay_number": 1,
  "state": true,
  "issued_at": "2026-11-09T10:00:00.000Z"
}
```

Contoh acknowledgement:

```json
{
  "command_id": "cmd-000001",
  "device_code": "PM-ESP32-001",
  "relay_number": 1,
  "state": true,
  "confirmed_at": "2026-11-09T10:00:01.000Z"
}
```

Acceptance criteria:

- API tidak mengklaim relay berhasil ON/OFF hanya karena MQTT publish berhasil.
- Status baru dicatat sebagai terkonfirmasi setelah acknowledgement yang cocok diterima.
- Command timeout menghasilkan status gagal/timeout yang dapat dilihat client.
- Pengiriman command tidak boleh mengabaikan kondisi device offline.

Catatan: schema saat ini belum memiliki tabel `relay_commands`. Untuk tracking command yang kuat, tambahkan migration tabel tersebut sebelum fitur relay dianggap production-ready.

### FR-09 — System Events (P1)

Backend harus mencatat kejadian penting seperti:

- Device online/offline.
- Device enabled/disabled.
- MQTT connection restored/lost.
- Payload tidak valid.
- Relay command timeout.
- Relay state berubah.

Acceptance criteria:

- Event memiliki `event_type`, deskripsi, timestamp, dan device bila relevan.
- Telemetri normal tidak menghasilkan event untuk setiap sampel.

### FR-10 — Health Check (P0)

Backend harus menyediakan endpoint health check.

Contoh:

`GET /api/health`

Respons minimum:

```json
{
  "success": true,
  "status": "ok"
}
```

Peningkatan yang direkomendasikan: health detail yang memeriksa koneksi PostgreSQL dan status koneksi MQTT tanpa membocorkan detail rahasia.

---

## 8. REST API Specification

Base path: `/api`

Format respons sukses yang disarankan:

```json
{
  "success": true,
  "data": {}
}
```

Format error:

```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

### 8.1 Health

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/health` | Status backend |

### 8.2 Devices

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/devices` | Daftar perangkat |
| GET | `/devices/:deviceCode` | Detail perangkat |
| POST | `/devices` | Registrasi perangkat |
| PATCH | `/devices/:deviceCode` | Ubah nama/lokasi |
| PATCH | `/devices/:deviceCode/status` | Enable/disable perangkat |

Contoh create device:

```json
{
  "device_code": "PM-ESP32-002",
  "device_name": "PowerMeter Room 2",
  "location": "Room 2",
  "mqtt_topic_prefix": "powermeter/PM-ESP32-002"
}
```

### 8.3 Measurements

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/measurements/latest/:deviceCode` | Pengukuran terbaru |
| GET | `/measurements/history/:deviceCode?limit=100` | Histori pengukuran |

Peningkatan yang direkomendasikan:

- `from` dan `to` untuk rentang waktu.
- Pagination berbasis cursor untuk histori besar.
- Endpoint agregasi per menit/jam untuk grafik jangka panjang.

### 8.4 Relays

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/relays/:deviceCode` | Status relay terakhir |
| POST | `/relays/:deviceCode/commands` | Mengirim perintah relay |

Contoh request:

```json
{
  "relay_number": 1,
  "state": true
}
```

Respons API harus membedakan command diterima untuk diproses dari relay yang sudah terkonfirmasi berubah.

---

## 9. WebSocket Specification

Path: `/ws`

### 9.1 Event Types

| Event type | Tujuan |
|---|---|
| `measurement` | Pengukuran baru berhasil disimpan |
| `device_status` | Perangkat online/offline atau status berubah |
| `relay_state` | Status relay terkonfirmasi berubah |
| `system_event` | Kejadian sistem yang relevan |

### 9.2 Aturan

- Setiap pesan menggunakan JSON.
- Setiap event memiliki `type` dan `data`.
- Frontend harus memfilter event berdasarkan perangkat yang sedang dilihat.
- REST API tetap menjadi sumber data awal dan histori.
- WebSocket hanya mengirim pembaruan; jangan menganggap koneksi WebSocket otomatis memberikan snapshot awal.
- Rilis awal dapat menggunakan broadcast sederhana untuk LAN kecil, tetapi filtering/subscription per device direkomendasikan ketika jumlah client bertambah.
- Tambahkan autentikasi dan origin validation sebelum penggunaan di jaringan yang tidak sepenuhnya dipercaya.

---

## 10. Struktur Folder dan Tanggung Jawab

Struktur proyek:

```text
backend/
│
├── package.json
├── .env
├── .env.example
├── .gitignore
├── nodemon.json
│
└── src/
    ├── server.js
    ├── app.js
    │
    ├── config/
    │   ├── database.js
    │   ├── mqtt.js
    │   └── environment.js
    │
    ├── mqtt/
    │   ├── mqttClient.js
    │   ├── mqttSubscriber.js
    │   ├── mqttPublisher.js
    │   └── topicHandler.js
    │
    ├── modules/
    │   ├── devices/
    │   │   ├── deviceController.js
    │   │   ├── deviceService.js
    │   │   └── deviceRepository.js
    │   │
    │   ├── measurements/
    │   │   ├── measurementController.js
    │   │   ├── ingestionService.js
    │   │   ├── historyService.js
    │   │   └── measurementRepository.js
    │   │
    │   ├── relays/
    │   │   ├── relayController.js
    │   │   ├── relayService.js
    │   │   └── relayRepository.js
    │   │
    │   └── events/
    │       ├── eventService.js
    │       └── eventRepository.js
    │
    ├── websocket/
    │   └── websocketServer.js
    │
    ├── routes/
    │   ├── deviceRoutes.js
    │   ├── measurementRoutes.js
    │   └── relayRoutes.js
    │
    └── middleware/
        ├── errorHandler.js
        └── validation.js
```

### 10.1 Root Files

- `package.json`: dependency dan npm scripts.
- `.env`: konfigurasi lokal dan secret; tidak boleh masuk Git.
- `.env.example`: daftar konfigurasi tanpa secret.
- `.gitignore`: mengecualikan dependency, secret, dan file lokal.
- `nodemon.json`: konfigurasi development watcher.
- `server.js`: entry point; membuat HTTP server, menginisialisasi WebSocket/MQTT, listen, dan graceful shutdown.
- `app.js`: konfigurasi Express, middleware, routes, dan error handler.

### 10.2 `config/`

- `database.js`: PostgreSQL pool dan lifecycle.
- `mqtt.js`: opsi koneksi broker.
- `environment.js`: membaca dan memvalidasi environment variables.

### 10.3 `mqtt/`

- `mqttClient.js`: satu shared MQTT client.
- `mqttSubscriber.js`: subscribe dan menerima pesan dari broker.
- `mqttPublisher.js`: publish command dari backend ke ESP32.
- `topicHandler.js`: memvalidasi topic, parse payload, dan meneruskan ke service domain.

### 10.4 `modules/devices/`

- `deviceController.js`: HTTP request/response pengelolaan perangkat.
- `deviceService.js`: aturan bisnis registrasi, enable/disable, dan status perangkat.
- `deviceRepository.js`: query tabel `devices`.

### 10.5 `modules/measurements/`

- `measurementController.js`: endpoint latest/history.
- `ingestionService.js`: validasi dan proses telemetri masuk.
- `historyService.js`: aturan pengambilan data terbaru dan histori.
- `measurementRepository.js`: query tabel `measurements` dan relasi yang diperlukan.

### 10.6 `modules/relays/`

- `relayController.js`: endpoint kontrol relay dan status.
- `relayService.js`: validasi command, publish MQTT, timeout, dan acknowledgement.
- `relayRepository.js`: query tabel `relay_states` dan tabel command jika migration ditambahkan.

### 10.7 `modules/events/`

- `eventService.js`: menentukan kapan event penting perlu dicatat.
- `eventRepository.js`: query tabel `system_events`.

### 10.8 `websocket/`

- `websocketServer.js`: mengelola koneksi WebSocket dan broadcast event.

### 10.9 `routes/`

Menghubungkan URL dan HTTP method dengan controller. Routes tidak berisi SQL atau business logic.

### 10.10 `middleware/`

- `errorHandler.js`: format dan penanganan error terpusat.
- `validation.js`: middleware validasi parameter, body, dan query HTTP.

---

## 11. Non-Functional Requirements

### 11.1 Performance

- Sistem mendukung 1–5 ESP32 dengan interval telemetri nominal 1 detik.
- Ingestion tidak boleh melakukan query yang tidak diperlukan.
- Query latest/history harus memanfaatkan index.
- Endpoint histori wajib memiliki limit/pagination.
- WebSocket mengirim event setelah commit database.
- Dashboard tidak boleh memuat seluruh histori sekaligus.

### 11.2 Reliability

- MQTT client harus reconnect otomatis.
- Backend harus menangani PostgreSQL connection errors.
- Satu pesan malformed tidak boleh menghentikan subscriber.
- Graceful shutdown harus menutup HTTP server, MQTT client, WebSocket, dan database pool.
- Sistem perlu memiliki backup PostgreSQL dan prosedur restore yang diuji.

### 11.3 Security

- Secret hanya disimpan dalam `.env` atau secret management yang sesuai.
- `.env` tidak boleh masuk Git.
- MQTT authentication dan ACL diaktifkan untuk deployment.
- Database tidak diekspos langsung ke client LAN.
- React hanya mengakses API/WebSocket.
- Validasi dilakukan di backend; validasi frontend bukan pengganti.
- Query SQL harus menggunakan parameterized queries.
- Endpoint relay dan administrasi perangkat memerlukan pembatasan akses sebelum deployment yang lebih luas.
- CORS dibatasi ke origin dashboard yang diizinkan pada production.
- Jangan menganggap LAN sepenuhnya aman.

### 11.4 Maintainability

- Gunakan ES Modules.
- Pisahkan controller, service, dan repository.
- Hindari query SQL di controller.
- Gunakan penamaan konsisten.
- Semua konfigurasi runtime berasal dari environment.
- Error harus memiliki konteks yang cukup untuk debugging tetapi tidak membocorkan secret.
- Perubahan database dikelola melalui migration.

### 11.5 Observability

Backend minimal mencatat:

- Startup/shutdown.
- MQTT connect/disconnect/reconnect.
- PostgreSQL connection error.
- Device accepted/rejected.
- Payload validation error.
- Measurement ingestion error.
- Relay command dan timeout.
- WebSocket connection/disconnection.

Jangan menulis setiap sampel telemetry ke log produksi jika hal itu menyebabkan log terlalu besar. Gunakan ringkasan atau log level yang sesuai.

---

## 12. Error Handling

| Kondisi | Perilaku backend |
|---|---|
| MQTT broker tidak tersedia | Reconnect otomatis, API tetap hidup jika memungkinkan |
| PostgreSQL tidak tersedia | Gagal menyimpan, log error, jangan broadcast sebagai data tersimpan |
| JSON malformed | Tolak pesan, log error terkontrol |
| Topic tidak sesuai | Tolak pesan |
| Device tidak dikenal | Tolak pesan, jangan auto-register |
| Device disabled | Tolak telemetri |
| Measurement negatif | Tolak berdasarkan validasi dan constraint database |
| Timestamp tidak valid | Tolak pesan |
| WebSocket client disconnect | Hapus/abaikan koneksi yang tertutup |
| Relay tidak memberi acknowledgement | Tandai timeout; jangan klaim relay berhasil berubah |

Untuk rilis lanjutan, pertimbangkan buffer terbatas atau durable queue untuk data yang gagal disimpan. Jangan menahan pesan tanpa batas di memori Raspberry Pi.

---

## 13. Testing Requirements

### 13.1 Unit Tests

Minimal menguji:

- Validasi measurement payload.
- Validasi device code terhadap topic.
- Validasi power factor.
- Validasi timestamp.
- Device disabled/unknown ditolak.
- Parsing relay command dan acknowledgement.
- Format respons controller.

### 13.2 Integration Tests

Minimal menguji:

1. Backend terhubung ke PostgreSQL.
2. Backend terhubung ke Mosquitto.
3. Pesan MQTT valid menghasilkan record di `measurements`.
4. `devices.last_seen_at` diperbarui.
5. Pesan dari perangkat tidak dikenal ditolak.
6. REST API mengembalikan pengukuran terbaru.
7. REST API mengembalikan histori dengan limit.
8. WebSocket menerima event setelah pengukuran tersimpan.
9. Backend dapat reconnect setelah MQTT Broker restart.

### 13.3 End-to-End Tests

Skenario utama:

1. Jalankan PostgreSQL dan Mosquitto.
2. Jalankan backend.
3. Jalankan ESP32 atau simulator MQTT.
4. Kirim measurement payload.
5. Pastikan row muncul di PostgreSQL.
6. Buka React Dashboard.
7. Pastikan data awal muncul dari REST API.
8. Kirim measurement baru.
9. Pastikan dashboard berubah melalui WebSocket.

### 13.4 Contoh Pengujian Manual MQTT

Gunakan `mosquitto_pub` untuk simulasi sebelum ESP32 siap:

```bash
mosquitto_pub \
  -h localhost \
  -t "powermeter/PM-ESP32-001/measurement" \
  -m '{
    "device_code": "PM-ESP32-001",
    "message_id": "test-0001",
    "voltage": 220.5,
    "current": 1.25,
    "active_power": 275.6,
    "energy_wh": 1520.8,
    "power_factor": 0.95,
    "recorded_at": "2026-11-09T10:00:00.000Z"
  }'
```

Catatan: contoh payload ini mencakup `message_id` sebagai rancangan pengembangan. Jika kolom tersebut belum ditambahkan ke schema, backend versi awal dapat mengabaikannya. Jangan menganggap deduplikasi sudah aktif sebelum migration dan implementasinya selesai.

---

## 14. Deployment Requirements

Target deployment adalah Raspberry Pi OS 64-bit pada Raspberry Pi 4.

Service yang dijalankan:

- Mosquitto.
- PostgreSQL.
- PowerMeter Node.js Backend.
- Nginx untuk frontend dan reverse proxy.

### 14.1 Network

- Raspberry Pi memiliki IP lokal yang stabil, idealnya melalui DHCP reservation.
- ESP32, Raspberry Pi, dan dashboard berada pada LAN yang dapat saling menjangkau.
- Jangan melakukan port forwarding router untuk rilis LAN-only.
- Port PostgreSQL tidak perlu dibuka ke client dashboard.
- Batasi port MQTT dan backend sesuai kebutuhan LAN.

### 14.2 Process Management

Gunakan `systemd` untuk menjalankan backend saat boot dan restart ketika proses gagal.

Development menggunakan:

```bash
npm run dev
```

Production menggunakan:

```bash
npm start
```

Jangan menjalankan Nodemon sebagai service production.

### 14.3 Nginx

Pada deployment production:

- Nginx menyajikan hasil build React.
- `/api` diteruskan ke Express.
- `/ws` diteruskan sebagai WebSocket upgrade.
- React menggunakan path relatif `/api` dan `/ws`, bukan `localhost`.

### 14.4 Backup

- Backup PostgreSQL secara berkala.
- Simpan backup di media atau perangkat lain, bukan hanya microSD yang sama.
- Uji proses restore.
- Dokumentasikan retensi backup.
- Perhatikan bahwa microSD memiliki keterbatasan untuk beban tulis database jangka panjang; SSD USB 3.0 direkomendasikan untuk deployment yang lebih permanen.

---

## 15. Implementation Milestones

### Milestone 1 — Backend Foundation

Deliverables:

- `package.json`
- `.env.example`
- environment validation
- PostgreSQL pool
- Express app
- health endpoint
- centralized error handler

Definition of Done:

- Backend berjalan.
- `/api/health` berhasil.
- Koneksi PostgreSQL berhasil.

### Milestone 2 — MQTT Integration

Deliverables:

- shared MQTT client
- subscriber
- topic handler
- reconnect handling

Definition of Done:

- Backend menerima payload dari Mosquitto.
- Backend menerima pesan dari lebih dari satu device topic.
- Invalid topic/payload tidak menjatuhkan backend.

### Milestone 3 — Measurement Ingestion

Deliverables:

- measurement repository
- ingestion service
- device validation
- measurement insert
- last_seen update

Definition of Done:

- Pesan valid tersimpan di PostgreSQL.
- Unknown/disabled device ditolak.
- Query verifikasi menunjukkan data yang benar.

### Milestone 4 — REST API

Deliverables:

- measurement controller
- history service
- measurement routes
- latest/history endpoints

Definition of Done:

- React atau browser dapat mengambil data melalui API.
- Limit histori diterapkan.
- Respons error konsisten.

### Milestone 5 — WebSocket

Deliverables:

- WebSocket server
- measurement broadcast
- React WebSocket client

Definition of Done:

- Data awal berasal dari REST API.
- Measurement baru diterima melalui WebSocket.
- Client disconnect ditangani.

### Milestone 6 — Device Management

Deliverables:

- device repository
- device service
- device controller
- device routes

Definition of Done:

- Perangkat dapat didaftarkan dan dikelola.
- Device enabled/disabled berpengaruh pada ingestion.

### Milestone 7 — Relay and Events

Deliverables:

- MQTT publisher
- relay service/repository/controller
- relay routes
- event service/repository
- command acknowledgement and timeout

Definition of Done:

- Command relay diterbitkan ke perangkat yang benar.
- Backend menunggu acknowledgement.
- Status relay yang dikonfirmasi tersimpan.
- Event penting tercatat.

### Milestone 8 — Production Hardening

Deliverables:

- MQTT authentication/ACL
- systemd service
- Nginx configuration
- backup/restore scripts
- logging and health diagnostics
- deployment documentation

Definition of Done:

- Backend berjalan setelah Raspberry Pi reboot.
- Reconnect MQTT teruji.
- Dashboard dapat diakses dari perangkat LAN.
- Backup dapat dipulihkan.

---

## 16. Overall Acceptance Criteria

Backend dianggap memenuhi rilis awal monitoring apabila:

- [ ] Node.js backend dapat berjalan pada lingkungan development.
- [ ] Backend dapat terhubung ke PostgreSQL.
- [ ] Backend dapat terhubung ke Mosquitto.
- [ ] Backend dapat menerima telemetri dari beberapa ESP32.
- [ ] Identitas topic dan payload diverifikasi.
- [ ] Perangkat harus terdaftar dan enabled.
- [ ] Pengukuran valid tersimpan pada tabel `measurements`.
- [ ] `devices.last_seen_at` diperbarui.
- [ ] Pengukuran terbaru dapat diambil melalui REST API.
- [ ] Histori dapat diambil dengan limit.
- [ ] WebSocket mengirim pengukuran setelah penyimpanan berhasil.
- [ ] React menampilkan data awal dan pembaruan real-time.
- [ ] Error MQTT, PostgreSQL, dan payload ditangani tanpa crash yang tidak terkendali.
- [ ] Secret tidak masuk repository.

Fitur relay dan administrasi perangkat dinyatakan selesai setelah acceptance criteria pada FR-04, FR-08, dan FR-09 terpenuhi.

---

## 17. Asumsi dan Keputusan yang Masih Perlu Dikonfirmasi

| Topik | Asumsi awal | Catatan |
|---|---|---|
| Jumlah perangkat | 1–5 ESP32 | Dapat ditingkatkan setelah pengujian |
| Interval telemetry | 1 detik | Dapat dikonfigurasi |
| Broker | Mosquitto | Berjalan di Raspberry Pi atau host LAN |
| Database | PostgreSQL | Menggunakan schema proyek |
| Backend | Node.js + Express | Modular monolith |
| Frontend | React | Mengakses API dan WebSocket |
| Deployment | Raspberry Pi 4, 4 GB RAM | LAN-only |
| Telemetry QoS | QoS 0 | Kehilangan sampel sesekali dapat diterima |
| Command relay QoS | QoS 1 | Memerlukan deduplikasi/acknowledgement |
| Retensi raw data | Belum diputuskan | Rekomendasi awal 30 hari, lalu evaluasi agregasi |
| Autentikasi dashboard | Belum diputuskan | LAN-only bukan pengganti autentikasi |
| `received_at` | Belum ada di schema | Direkomendasikan untuk ditambahkan |
| `message_id` | Belum ada di schema | Direkomendasikan untuk deduplikasi |
| `relay_commands` | Belum ada di schema | Direkomendasikan untuk lifecycle command |

---

## 18. Definisi Selesai (Definition of Done)

Sebuah fitur backend dinyatakan selesai jika:

1. Implementasi mengikuti tanggung jawab folder yang ditetapkan.
2. Input divalidasi di backend.
3. Query database menggunakan parameterized query.
4. Error ditangani dan dicatat secara relevan.
5. Unit/integration test yang sesuai lulus.
6. Endpoint atau topic didokumentasikan.
7. Tidak ada credential atau secret yang di-commit.
8. Perilaku fitur dapat diverifikasi melalui pengujian manual atau otomatis.
9. Tidak ada klaim bahwa command atau data berhasil sebelum hasilnya benar-benar dikonfirmasi.

---

**Akhir dokumen — PowerMeter Local Server Backend PRD v1.0**
