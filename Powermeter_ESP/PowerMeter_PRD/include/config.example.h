#pragma once
// Copy to config.local.h (ignored by Git); never commit real credentials.
#define DEVICE_CODE "PM-ESP32-001"
#define CALIBRATION_PROFILE 1 // 1 or 3; independent from DEVICE_CODE
#define WIFI_SSID ""
#define WIFI_PASSWORD ""
#define MQTT_HOST "192.168.0.100" // Numeric LAN IP avoids blocking DNS reconnect.
#define MQTT_PORT 1883
#define MQTT_USERNAME ""
#define MQTT_PASSWORD ""
#define NTP_SERVER "pool.ntp.org" // Prefer an accessible LAN NTP server.
#define RELAY_GPIO 25
#define RELAY_ON_LEVEL 0 // Assumption ONLY: mandatory physical polarity verification.
#define RELAY_POLARITY_VERIFIED 0 // Change to 1 only after unloaded physical test.
