#include <Arduino.h>
#include <ArduinoJson.h>
#include <HLW8012.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <esp_sntp.h>
#include <esp_system.h>
#include <atomic>
#include <time.h>
#include "calibration.h"
#include "command.h"

namespace {
constexpr uint8_t CF_PIN = 34, CF1_PIN = 13, SEL_PIN = 26, LED_PIN = 32;
constexpr uint32_t SAMPLE_MS = 1000, HEARTBEAT_MS = 15000;
HLW8012 meter;
Preferences nvs;
bool nvsReady = false;
double energyWh = 0, savedEnergy = 0;
uint32_t lastSave = 0;
std::atomic<bool> synchronizedClock{false};
std::atomic<uint32_t> lastSyncMillis{0};
std::atomic<uint32_t> rejectedCommands{0};
std::atomic<bool> storageHealthy{false};
QueueHandle_t samples;
struct Sample { double voltage, current, power, energy; time_t captured; bool clockValid; };
class BoundedWiFiClient : public WiFiClient {
 public:
  int connect(const char* host, uint16_t port) override {
    IPAddress ip;
    return ip.fromString(host) ? WiFiClient::connect(ip, port, 1000) : 0;
  }
  int connect(IPAddress ip, uint16_t port) override {
    return WiFiClient::connect(ip, port, 1000);
  }
};
BoundedWiFiClient transport;
PubSubClient mqtt(transport);
pm::CommandCache commands;
bool relayState = false;
char measurementTopic[100], heartbeatTopic[100], availabilityTopic[100];
char commandTopic[100], stateTopic[100], bootNonce[33];
uint64_t messageCounter = 0;

void IRAM_ATTR onCf() { meter.cf_interrupt(); }
void IRAM_ATTR onCf1() { meter.cf1_interrupt(); }

void onTimeSync(struct timeval*) {
  lastSyncMillis.store(millis());
  synchronizedClock.store(true);
}

bool clockReady() {
  const time_t now = time(nullptr);
  return synchronizedClock.load() && now >= 1704067200 && now < 4102444800LL &&
         uint32_t(millis() - lastSyncMillis.load()) < 86400000UL;
}

bool utc(time_t epoch, char (&out)[25]) {
  struct tm tm;
  return gmtime_r(&epoch, &tm) && strftime(out, sizeof(out), "%Y-%m-%dT%H:%M:%S.000Z", &tm) == 24;
}

bool publish(const char* topic, const JsonDocument& doc, bool retained = false) {
  char buffer[768];
  if (doc.overflowed() || measureJson(doc) >= sizeof(buffer)) return false;
  size_t size = serializeJson(doc, buffer, sizeof(buffer));
  return mqtt.publish(topic, reinterpret_cast<const uint8_t*>(buffer), size, retained);
}

void acknowledge(const pm::CommandRecord& command) {
  StaticJsonDocument<384> doc;
  doc["command_id"] = command.id;
  doc["device_code"] = DEVICE_CODE;
  doc["relay_number"] = 1;
  doc["state"] = command.state;
  doc["confirmed_at"] = command.confirmed;
  if (!publish(stateTopic, doc)) Serial.println("ACK publish failed; retry command with same ID");
}

void reject() { rejectedCommands.fetch_add(1); }

void onCommand(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, commandTopic) != 0 || !clockReady() || !RELAY_POLARITY_VERIFIED) {
    reject(); return;
  }
  pm::Command command;
  if (!pm::decodeCommand(reinterpret_cast<const char*>(payload), length, DEVICE_CODE,
                         time(nullptr), command)) {
    reject(); return;
  }
  const char* id = command.id;
  bool state = command.state;
  if (const auto* previous = commands.find(id)) {
    // Re-ACK the original outcome, never replay a GPIO write after another command.
    if (previous->state != state) reject();
    else acknowledge(*previous);
    return;
  }
  char confirmed[25];
  if (!utc(time(nullptr), confirmed) || !clockReady() || time(nullptr) >= command.expires) { reject(); return; }
  digitalWrite(RELAY_GPIO, state ? RELAY_ON_LEVEL : !RELAY_ON_LEVEL);
  digitalWrite(LED_PIN, state ? HIGH : LOW);
  relayState = state;
  acknowledge(commands.remember(id, state, confirmed));
}

void publishAvailability() {
  StaticJsonDocument<192> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["status"] = "online";
  publish(availabilityTopic, doc, true);
}

void publishHeartbeat() {
  StaticJsonDocument<384> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["uptime_s"] = esp_timer_get_time() / 1000000ULL;
  doc["clock_synced"] = clockReady();
  doc["storage_healthy"] = storageHealthy.load();
  doc["relay_enabled"] = bool(RELAY_POLARITY_VERIFIED);
  doc["relay_state"] = relayState;
  doc["rejected_commands"] = rejectedCommands.load();
  if (clockReady()) {
    char stamp[25];
    if (utc(time(nullptr), stamp)) doc["recorded_at"] = stamp;
    // Serialize before the stack timestamp leaves scope.
    publish(heartbeatTopic, doc);
  } else publish(heartbeatTopic, doc);
}

void publishMeasurement(const Sample& s) {
  if (!s.clockValid || !clockReady() || !std::isfinite(s.voltage) ||
      !std::isfinite(s.current) || !std::isfinite(s.power) || !std::isfinite(s.energy)) return;
  char stamp[25], id[128];
  if (!utc(s.captured, stamp)) return;
  snprintf(id, sizeof(id), "%s-%s-%llu", DEVICE_CODE, bootNonce,
           static_cast<unsigned long long>(++messageCounter));
  StaticJsonDocument<640> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["message_id"] = id;
  doc["voltage"] = s.voltage;
  doc["current"] = s.current;
  doc["active_power"] = s.power;
  doc["energy_wh"] = s.energy;
  doc["power_factor"] = nullptr; // Alternating CF1 readings are not simultaneous.
  doc["recorded_at"] = stamp;
  publish(measurementTopic, doc);
}

void mqttWorker(void*) {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onCommand);
  if (!mqtt.setBufferSize(1024)) { Serial.println("MQTT allocation failed"); vTaskDelete(nullptr); }
  mqtt.setSocketTimeout(1);
  mqtt.setKeepAlive(30);
  uint32_t lastAttempt = millis() - 5000, lastHeartbeat = millis();
  char clientId[80], will[160];
  snprintf(clientId, sizeof(clientId), "pm-%s", DEVICE_CODE);
  snprintf(will, sizeof(will), "{\"device_code\":\"%s\",\"status\":\"offline\"}", DEVICE_CODE);
  for (;;) {
    if (WiFi.status() == WL_CONNECTED && !mqtt.connected() &&
        uint32_t(millis() - lastAttempt) >= 5000) {
      lastAttempt = millis();
      if (mqtt.connect(clientId, MQTT_USERNAME, MQTT_PASSWORD, availabilityTopic, 1, true, will, true)) {
        if (!mqtt.subscribe(commandTopic, 1)) {
          transport.stop(); // Ungraceful close lets the broker emit the offline LWT.
        } else {
          publishAvailability();
          publishHeartbeat();
          lastHeartbeat = millis();
        }
      }
    }
    if (mqtt.connected()) {
      mqtt.loop();
      Sample sample;
      if (xQueueReceive(samples, &sample, 0) == pdTRUE &&
          time(nullptr) - sample.captured <= 3) publishMeasurement(sample);
      if (uint32_t(millis() - lastHeartbeat) >= HEARTBEAT_MS) {
        lastHeartbeat = millis();
        publishHeartbeat();
        publishAvailability(); // Repairs a lost QoS0 online update.
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

bool configureTopics() {
  if (!pm::safeToken(DEVICE_CODE, 48)) return false;
  snprintf(measurementTopic, sizeof(measurementTopic), "powermeter/%s/measurement", DEVICE_CODE);
  snprintf(heartbeatTopic, sizeof(heartbeatTopic), "powermeter/%s/heartbeat", DEVICE_CODE);
  snprintf(availabilityTopic, sizeof(availabilityTopic), "powermeter/%s/availability", DEVICE_CODE);
  snprintf(commandTopic, sizeof(commandTopic), "powermeter/%s/relay/command", DEVICE_CODE);
  snprintf(stateTopic, sizeof(stateTopic), "powermeter/%s/relay/state", DEVICE_CODE);
  IPAddress ip;
  return ip.fromString(MQTT_HOST) && *WIFI_SSID && *MQTT_USERNAME && *MQTT_PASSWORD;
}
}

void setup() {
  // Set latch before enabling output, before storage/network initialization.
  digitalWrite(RELAY_GPIO, !RELAY_ON_LEVEL);
  pinMode(RELAY_GPIO, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  meter.begin(CF_PIN, CF1_PIN, SEL_PIN, HIGH, true, 500000);
  meter.setResistors(0.001, 5 * 470000, 1000);
  attachInterrupt(digitalPinToInterrupt(CF_PIN), onCf, CHANGE);
  attachInterrupt(digitalPinToInterrupt(CF1_PIN), onCf1, CHANGE);
  nvsReady = nvs.begin("pm-prd-energy", false);
  energyWh = nvsReady ? nvs.getDouble("energy_wh", 0) : 0;
  if (!std::isfinite(energyWh) || energyWh < 0) {
    Serial.println("Invalid NVS energy; measurement disabled until storage repaired");
    nvsReady = false;
  }
  savedEnergy = energyWh;
  storageHealthy.store(nvsReady);
  lastSave = millis();
  samples = xQueueCreate(1, sizeof(Sample));
  if (!samples) { Serial.println("Sample queue allocation failed"); return; }
  uint32_t nonce[4];
  esp_fill_random(nonce, sizeof(nonce));
  snprintf(bootNonce, sizeof(bootNonce), "%08lx%08lx%08lx%08lx",
           (unsigned long)nonce[0], (unsigned long)nonce[1], (unsigned long)nonce[2], (unsigned long)nonce[3]);
  if (!configureTopics()) {
    Serial.println("Network disabled: configure local SSID, numeric broker IP and MQTT credentials");
    return;
  }
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  sntp_set_time_sync_notification_cb(onTimeSync);
  configTime(0, 0, NTP_SERVER);
  if (xTaskCreate(mqttWorker, "mqtt", 8192, nullptr, 1, nullptr) != pdPASS)
    Serial.println("MQTT task allocation failed");
}

void loop() {
  static uint32_t lastSample = millis(), lastWifi = millis();
  static double previousPower = NAN;
  const uint32_t now = millis();
  if (*WIFI_SSID && WiFi.status() != WL_CONNECTED && uint32_t(now - lastWifi) >= 15000) {
    lastWifi = now;
    WiFi.reconnect();
  }
  if (uint32_t(now - lastSample) >= SAMPLE_MS) {
    const uint32_t elapsed = now - lastSample;
    lastSample = now;
    Sample sample;
    sample.power = pm::calibrated(meter.getActivePower(), pm::powerProfile, 25000);
    sample.voltage = pm::calibrated(meter.getVoltage(), pm::voltageProfile, 300);
    sample.current = pm::calibrated(meter.getCurrent(), pm::currentProfile, 100);
    energyWh = pm::integrateEnergy(energyWh, previousPower, sample.power, elapsed);
    previousPower = sample.power;
    sample.energy = energyWh;
    sample.captured = time(nullptr);
    sample.clockValid = clockReady() && nvsReady && std::isfinite(energyWh);
    if (samples) xQueueOverwrite(samples, &sample);
  }
  const uint32_t sinceSave = now - lastSave;
  if (nvsReady && energyWh > savedEnergy && sinceSave >= 60000 &&
      (energyWh - savedEnergy >= 1.0 || sinceSave >= 900000)) {
    lastSave = now;
    if (nvs.putDouble("energy_wh", energyWh) == sizeof(double)) {
      savedEnergy = energyWh;
      storageHealthy.store(true);
    } else {
      storageHealthy.store(false);
      Serial.println("Energy checkpoint failed; retry after batching interval");
    }
  }
  delay(1);
}
