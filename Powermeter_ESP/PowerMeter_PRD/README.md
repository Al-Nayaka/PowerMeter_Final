# PowerMeter PRD — firmware ESP32 + HLW8012

Firmware baru, terpisah dari PowerMeter1_MQTT dan PowerMeter3_MQTT. Tidak ada upload otomatis. Identitas default `PM-ESP32-001`, satu relay nomor **1**. PRD Backend v1.0 menjadi acuan payload, bukan jaminan keselamatan listrik atau akurasi billing.

## Persiapan dan flash oleh operator

1. Pasang Python dan PlatformIO Core (`python -m pip install platformio`). Buka terminal di folder ini.
2. Salin `include/config.example.h` menjadi `include/config.local.h`. File lokal diabaikan Git. Isi SSID/password Wi-Fi, **IP numerik** broker LAN, port, username/password MQTT, dan server NTP yang dapat dijangkau (utamakan NTP lokal). Tidak ada kredensial nyata pada contoh. Tanpa konfigurasi lengkap, jaringan tidak dimulai dan relay tetap pada level OFF yang dikonfigurasi.
3. Pilih `DEVICE_CODE` unik dan daftarkan/enabled di backend dengan prefix `powermeter/{device_code}`. Kode/command ID hanya huruf ASCII, angka, `-`, `_`; panjang kode maksimal 48, command ID 64.
4. Pilih `CALIBRATION_PROFILE` **1** untuk koefisien meter 1 atau **3** untuk meter 3. Profil terpisah dari identitas perangkat, tidak dipilih otomatis berdasarkan angka kode.
5. **Wajib verifikasi polaritas relay secara fisik tanpa beban dan tanpa tegangan PLN sebelum flash untuk operasi.** Default `RELAY_GPIO=25`, `RELAY_ON_LEVEL=0` hanyalah asumsi aktif-LOW karena komentar firmware lama menyebut HIGH=OFF, sedangkan callback lama menyebut HIGH=ON. Tentukan level ON sebenarnya dengan pengujian terisolasi. `RELAY_POLARITY_VERIFIED=0` menolak semua command. Ubah ke 1 hanya setelah verifikasi; jangan sekadar mengikuti log firmware lama.
6. Build: `python -m platformio run`. Periksa board: default `esp32dev` (ESP32 klasik 4 MB), sesuaikan jika perangkat aktual berbeda.
7. **Hanya setelah operator siap**, upload sendiri: `python -m platformio run -t upload --upload-port COMx`. Monitor: `python -m platformio device monitor --port COMx --baud 115200`.

Tidak ada `WiFiManager.resetSettings()`, penghapusan NVS, atau reset Wi-Fi setiap boot. Wi-Fi memakai konfigurasi lokal dan auto-reconnect; perubahan kredensial dilakukan lewat build/provisioning operator, bukan captive portal. Kredensial tertanam dalam binary: jangan bagikan binary produksi.

## GPIO dan batas keselamatan

| Fungsi | GPIO |
|---|---:|
| Relay | 25 (konfigurabel) |
| HLW8012 SEL | 26 |
| HLW8012 CF1 | 13 |
| HLW8012 CF | 34 |
| LED indikator logika ON | 32 |

CF=34 tidak mempunyai pull-up internal; pastikan rangkaian pull-up/level 3,3 V benar sesuai PCB. Jangan menghubungkan sinyal 5 V langsung ke ESP32. Perubahan pin relay harus menghindari pin flash, serial, sensor, LED, pin input-only dan pin strapping; pemeriksaan compile bukan pengganti pemeriksaan PCB.

Latch OFF ditulis sebelum `pinMode(OUTPUT)`, sebelum jaringan/storage, dan relay tidak dipulihkan ON dari penyimpanan. Setelah command diterima, relay mempertahankan state selama putus Wi-Fi/MQTT; reboot mengembalikannya OFF. Tidak ada command toggle. Namun firmware tidak dapat menjamin kondisi pin saat reset/bootloader atau relay kontak lengket: gunakan pull-up/down eksternal untuk kondisi OFF, kontak NO dan proteksi fisik sesuai desain. ACK hanya mengonfirmasi GPIO telah diperintahkan, **bukan sensor umpan-balik kontak atau konfirmasi beban mendapat listrik**. Firmware bukan perangkat keselamatan.

## MQTT

Prefix: `powermeter/{DEVICE_CODE}`. Client ID stabil `pm-{DEVICE_CODE}`; identitas ganda menyebabkan koneksi saling memutus.

| Suffix | Arah | QoS aktual | Retained |
|---|---|---:|---|
| `measurement` | publish nominal 1 detik | 0 | tidak |
| `heartbeat` | publish 15 detik, juga setelah connect | 0 | tidak |
| `availability` online | publish setelah connect dan 15 detik | 0 | ya |
| `availability` offline | broker LWT | 1 | ya |
| `relay/command` | subscribe | 1 diminta | **publisher harus false** |
| `relay/state` | publish ACK | 0 | tidak |

**PubSubClient 2.8 hanya mendukung publish aplikasi QoS0.** Heartbeat, availability online, dan ACK bukan QoS1 sebagaimana preferensi PRD. LWT QoS1 dan subscribe command QoS1 didukung, tetapi QoS delivery incoming juga tergantung QoS publisher. Publish sukses hanya berarti diteruskan ke transport, bukan backend menyimpan data. ACK bisa hilang: backend dapat retry dengan **command_id dan isi yang sama** dalam jendela freshness. Jangan mengklaim exactly-once atau ACK durable. Online availability diulang untuk memperbaiki paket QoS0 yang hilang; broker mengirim offline setelah koneksi hilang terdeteksi (keepalive 30 detik), bukan seketika listrik mati.

Measurement berisi angka JSON, bukan string:

```json
{"device_code":"PM-ESP32-001","message_id":"PM-ESP32-001-<boot-nonce-128bit>-1","voltage":220.5,"current":1.25,"active_power":275.6,"energy_wh":1520.8,"power_factor":null,"recorded_at":"2026-11-09T10:00:00.000Z"}
```

`message_id` menggabungkan kode, nonce acak baru tiap boot, dan counter 64-bit. `power_factor=null` karena arus/tegangan CF1 berselang dan belum divalidasi sebagai pengukuran PF. Tidak ada pemalsuan PF=1.

Availability adalah `{"device_code":"PM-ESP32-001","status":"online"}` atau `offline`. Heartbeat menambahkan uptime, status sinkronisasi jam, storage, gate relay, state logika dan counter command ditolak. Heartbeat/availability tetap dapat dikirim sebelum jam sinkron.

Command harus JSON dengan tepat enam field:

```json
{"command_id":"123e4567-e89b-42d3-a456-426614174000","device_code":"PM-ESP32-001","relay_number":1,"state":true,"issued_at":"2026-11-09T10:00:00.000Z","expires_at":"2026-11-09T10:00:10.000Z"}
```

ACK pada `relay/state` memakai `command_id`, `device_code`, `relay_number:1`, boolean `state`, dan `confirmed_at` UTC. OFF memakai `false`; tidak ada karakter `0`/`1` seperti firmware lama. String ON/OFF, relay selain 1, perangkat lain, JSON rusak, field tambahan, timestamp invalid, `expires_at` lampau/tanpa batas atau melebihi 60 detik dari `issued_at`, payload kosong/>512 byte, ID terlalu panjang dan nesting berlebih ditolak. Tidak ada echo kredensial/payload mentah ke log.

### Freshness, replay, dan retained command

Jam harus sudah sinkron. `issued_at` wajib UTC `YYYY-MM-DDTHH:mm:ssZ` atau `YYYY-MM-DDTHH:mm:ss.sssZ` tahun 2024–2099; offset zona lain ditolak. Perbandingan pada resolusi detik: usia maksimal **30 detik**, toleransi masa depan **5 detik**. Sinkronkan jam server dan ESP32. Cache RAM menyimpan 16 command terakhir, termasuk state dan waktu konfirmasi asli. Duplikat cocok di-ACK ulang **tanpa menulis ulang GPIO**, bahkan jika command lain telah mengubah state; ID sama dengan state berbeda ditolak. ACK duplikat merekam hasil historis command, bukan snapshot relay saat ini. Command stale ditolak sebelum lookup cache.

**PubSubClient tidak mengekspos flag RETAIN di callback. Karena itu firmware ini tidak dapat menjamin penolakan semua retained command.** Freshness menolak replay lama, tetapi retained command yang masih <30 detik dapat dieksekusi, termasuk setelah reboot. Cache hilang saat reboot dan memakai eviction FIFO; ID yang terhapus dapat diproses ulang selama masih fresh (perintah absolut tidak men-toggle). Untuk deployment: backend **wajib publish retained=false**, bersihkan retained command lama, aktifkan auth/ACL broker, dan jangan izinkan publisher lain menulis command. Jika penolakan mutlak RETAIN atau dedup durable diwajibkan, ganti client MQTT dengan API yang mengekspos flag retain dan penyimpanan command yang sesuai sebelum operasi.

## Jam, sampling, kalibrasi dan energi

- NTP berjalan asinkron UTC. Measurement **tidak dipublish sebelum callback sinkronisasi NTP aktual**; timestamp palsu dari millis/epoch nol tidak digunakan. Sinkronisasi kedaluwarsa setelah 24 jam tanpa update, sehingga measurement dan command berhenti sampai tersinkron kembali. NTP biasa tidak terautentikasi; gunakan jaringan/server waktu terpercaya.
- Sampling HLW8012 memakai interrupt CHANGE pada CF/CF1, current mode HIGH, timeout pulsa 500.000 µs, R shunt 0,001 Ω, upstream **5 × 470.000 Ω = 2.350.000 Ω**, downstream 1.000 Ω (nilai ekspresi sumber lama dipertahankan, bukan komentar 2280k). Library mengalihkan mode CF1 otomatis; tidak ada tambahan toggle manual. Pembacaan V/I tidak simultan dan dapat tertinggal satu siklus.
- Koefisien polinomial di `include/calibration.h` disalin dari sumber meter 1/3. Tidak ada auto-kalibrasi beban 60 W saat boot. Mengganti metode polling lama ke interrupt tetap **wajib diuji ulang terhadap alat referensi**. Rentang valid empiris kalibrasi lama tidak tersedia, jadi belum ada klaim akurasi di seluruh rentang.
- Kebijakan sanitasi: raw nol tetap nol (offset polinomial tidak boleh menciptakan daya/energi tanpa pulsa), hasil negatif di-clamp ke nol; non-finite, raw negatif, atau hasil >300 V / >100 A / >25.000 W dianggap invalid, bukan di-clamp ke batas atas. Sampel invalid tidak dikirim. Batas ini guard software, **bukan rating aman perangkat/shunt/relay**; batas raw/polinomial perlu dikalibrasi lagi di perangkat aktual.
- `energy_wh` adalah akumulasi **Wh**, integral trapezoidal daya aktif terkalibrasi memakai delta millis, bukan jam NTP. Akumulasi berjalan walau MQTT/NTP offline. Daya invalid atau gap loop >5 detik dilewati (energi saat gap tidak diestimasi). Backend jangan menjumlahkan semua counter kumulatif.
- NVS Preferences namespace `pm-prd-energy`, key `energy_wh` bertipe double. Checkpoint hanya jika energi berubah: minimal 60 detik dan delta ≥1 Wh, atau setelah 15 menit untuk delta lebih kecil. Maksimum normal satu write/menit; bukan setiap detik. Commit NVS bawaan ESP-IDF melindungi nilai tersimpan saat power loss. Gagal write dilaporkan `storage_healthy=false`, lalu dicoba ulang dengan interval batch. Gagal membuka NVS/nilai tidak finite menghentikan measurement, bukan diam-diam mengaku energi valid.
- **Batched persistence tidak lossless:** mati mendadak kehilangan delta sejak checkpoint terakhir; counter dapat turun dibanding telemetry terakhir sebelum reboot. Pada beban tinggi sampai kira-kira satu menit energi; pada beban rendah sampai 15 menit (umumnya <1 Wh), lebih besar jika write gagal. Tidak mengukur energi selama ESP32 mati. Jangan pakai billing. Untuk counter monotonic lintas power-cut tanpa kehilangan, perlu FRAM/UPS/jurnal energi perangkat dan pengujian tersendiri. Backend harus mengenali penurunan/reboot, bukan menganggap selisih negatif sebagai konsumsi.
- Namespace tetap sama saat ganti kode/profil, sehingga counter mengikuti perangkat fisik, bukan direset otomatis. Migrasi identitas/perangkat atau erase NVS dilakukan operator dengan prosedur eksplisit.

## Reconnect, memori dan keamanan

Wi-Fi retry 15 detik tanpa loop tunggu koneksi. MQTT retry 5 detik di task FreeRTOS terpisah; connect TCP dibatasi 1 detik, timeout respons MQTT 1 detik. Call PubSubClient tetap sinkron **di task MQTT**, tidak memblokir loop sampling. Hanya task tersebut mengakses client dan cache. Satu slot antrean snapshot mengganti sampel lama; sampel >3 detik dibuang saat reconnect, tidak ada backlog tak terbatas. Tidak ada replay histori offline. Pengiriman telemetry gagal berarti sampel hilang.

MQTT memakai username/password dan WiFiClient plaintext, LAN-only. Aktifkan ACL per perangkat: write measurement/heartbeat/availability/relay/state sendiri, read relay/command sendiri; backend memakai akun berbeda. Jangan membuka port broker ke internet. Untuk jaringan tidak terpercaya gunakan client TLS/sertifikat dan provisioning aman; implementasi ini tidak menyediakan TLS, OTA, captive portal, feedback kontak, maupun command persistence.

## Pengujian

```powershell
python -m platformio pkg install
python test/run_native.py
python -m platformio run
```

Host test memakai `g++` C++14 dan header ArduinoJson asli yang dipasang PlatformIO. Menguji parser timestamp/leap-year, freshness stale/future, token, cache, clamping dan integrasi Wh, serta decoder JSON command nyata (identity, relay, boolean, panjang, NUL dan field tambahan). Tes dibuat sebelum helper implementasinya; gagal awal karena API belum tersedia, lalu lulus setelah implementasi.

Build diverifikasi untuk profil 1 dan profil 3, termasuk build konfigurasi nonkosong menggunakan nilai dummy tanpa kredensial nyata. Tidak ada flash atau uji hardware/broker aktual dilakukan. Checklist operator sebelum operasi:

- [ ] Verifikasi board, tegangan logika, isolasi, pull-up CF dan level OFF/ON relay tanpa PLN/beban.
- [ ] Uji boot/reset/offline tetap sesuai kebijakan relay; kontak aktual diukur terpisah dari GPIO.
- [ ] Bandingkan V/A/W dengan alat referensi untuk kedua profil, termasuk no-load dan beban rendah.
- [ ] Blok NTP: tidak ada measurement/command; buka NTP: timestamp UTC dan measurement valid.
- [ ] Broker restart/Wi-Fi terputus: LWT offline retained, reconnect subscribe ulang, heartbeat 15 detik.
- [ ] Kirim command fresh, duplicate, identity salah, stale dan future; pastikan ACK cocok tanpa toggle.
- [ ] Pastikan backend tidak retain command dan tidak menganggap publish/ACK sebagai feedback kontak fisik.
- [ ] Uji akumulasi 3600 W selama 1 detik ≈1 Wh, reboot setelah checkpoint, dan power-cut sebelum checkpoint untuk mengukur kehilangan nyata.
