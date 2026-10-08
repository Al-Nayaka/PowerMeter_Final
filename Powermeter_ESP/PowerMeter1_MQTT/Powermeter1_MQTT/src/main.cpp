#include <WiFi.h>
#include <WiFiManager.h>         // Library WiFiManager
#include <WebSocketsClient.h>    // Library WebSocket untuk WSS
#include <MQTTPubSubClient.h>    // Library MQTT 
#include <ArduinoJson.h>
#include <HLW8012.h>

#define SERIAL_BAUDRATE 115200

// =====================================================
// GPIO & HARDWARE CONFIG
// =====================================================
#define RELAY_PIN 25
#define SEL_PIN 26
#define CF1_PIN 13
#define CF_PIN 34
#define LED_PIN 32

#define UPDATE_TIME 2000  
#define CURRENT_MODE HIGH
#define CURRENT_RESISTOR 0.001
#define VOLTAGE_RESISTOR_UPSTREAM (5 * 470000)  
#define VOLTAGE_RESISTOR_DOWNSTREAM (1000)      

// HLW8012 Variables
float activePower, voltage, current;
float activePowerCalibrated, voltageCalibrated, currentCalibrated;
char bufferActivePower[12];
char bufferVoltage[12];
char bufferCurrent[12];
char bufferActivePowerCalibrated[12];
char bufferVoltageCalibrated[12];
char bufferCurrentCalibrated[12];
char bufferJSON[256];
unsigned long prevMillis;

// HLW8012 Calibration
struct Calibration {
  double a; double b; double c; double d; double e;
};
Calibration currentCalc = { 0.000520401296, -0.008096351376, 0.0384854598, 0.3661410109, 0.0435};  
Calibration voltageCalc = { -0.18958, 80.35625, -8281.21667, 0, 0 }; 
Calibration activePowerCalc = { 0, 0.000000005306441618, -0.00002260346534, 0.4755718712, 4.85 };  

HLW8012 hlw8012;

// =====================================================
// WSS MQTT CREDENTIALS
// =====================================================
const char* MQTT_HOST = "mqtt.sidontol.my.id";
const uint16_t MQTT_PORT = 443;
const char* MQTT_PATH = "/mqtt";
const char* MQTT_USERNAME = "monitor";
const char* MQTT_PASSWORD = "juni2024";
const char* DEVICE_ID = "powermeter01"; 

const char* TOPIC_relay = "powermeter01/relay";
const char* TOPIC_json = "esp/hlw8012/meter1";
int intervalPengiriman = 5;  

WebSocketsClient client;
MQTTPubSubClient mqtt;

// =====================================================
// MQTT CALLBACK & CONNECTION
// =====================================================
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED: Serial.println("[WSS] Disconnected"); break;
    case WStype_CONNECTED:    Serial.println("[WSS] Connected"); break;
    case WStype_ERROR:        Serial.println("[WSS] Error"); break;
    default: break;
  }
}

void mqttCallback(const char* payload, unsigned int length) {
  Serial.print("Pesan Masuk: ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();

  if ((char)payload[0] == '0') {
    digitalWrite(RELAY_PIN, HIGH);
    digitalWrite(LED_PIN, LOW);
    Serial.println("[RELAY] NYALA");
  } else if ((char)payload[0] == '1') {
    digitalWrite(RELAY_PIN, LOW);
    digitalWrite(LED_PIN, HIGH);
    Serial.println("[RELAY] MATI");
  }
}

bool connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.println("[MQTT] Connecting to Alpat-Broker...");
  bool connected = mqtt.connect(DEVICE_ID, MQTT_USERNAME, MQTT_PASSWORD);

  if (!connected) {
    Serial.println("[MQTT] Connection failed");
    return false;
  }

  Serial.println("[MQTT] CONNECTED successfully");
  mqtt.subscribe(TOPIC_relay, mqttCallback);
  return true;
}

void publish_json() {
  JsonDocument doc;

  sprintf(bufferActivePower, "%.3f", activePower);
  sprintf(bufferVoltage, "%.1f", voltage);
  sprintf(bufferCurrent, "%.3f", current);

  sprintf(bufferActivePowerCalibrated, "%.3f", activePowerCalibrated);
  sprintf(bufferVoltageCalibrated, "%.1f", voltageCalibrated);
  sprintf(bufferCurrentCalibrated, "%.3f", currentCalibrated);

  doc["raw_v"] = bufferVoltage;
  doc["cal_v"] = bufferVoltageCalibrated;
  doc["raw_c"] = bufferCurrent;
  doc["cal_c"] = bufferCurrentCalibrated;
  doc["raw_p"] = bufferActivePower;
  doc["cal_p"] = bufferActivePowerCalibrated;

  serializeJson(doc, bufferJSON);
  mqtt.publish(TOPIC_json, bufferJSON);
  Serial.println("[MQTT PUB] Telemetry Data Sent");
}

// =====================================================
// SETUP & LOOP
// =====================================================
void setup() {
  Serial.begin(115200);
  
  // Hardware GPIO Init
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);  
  digitalWrite(LED_PIN, LOW);     

  // HLW8012 Sensor Init
  hlw8012.begin(CF_PIN, CF1_PIN, SEL_PIN, CURRENT_MODE, false, 500000);
  hlw8012.setResistors(CURRENT_RESISTOR, VOLTAGE_RESISTOR_UPSTREAM, VOLTAGE_RESISTOR_DOWNSTREAM);

  // WiFiManager Setup
  WiFiManager wm;
  
  // Opsional: Buka tanda komentar di bawah jika ingin mereset kredensial WiFi saat pengujian
  wm.resetSettings();

  Serial.println("[SYSTEM] Connecting WiFi via WiFiManager...");
  
  // Memulai portal Captive AP bernama "AutoConnectAP" dengan password "password" jika WiFi gagal tersambung
  bool res = wm.autoConnect("AutoConnectAP", "password");

  if(!res) {
    Serial.println("[WIFI] Failed to connect, restarting ESP...");
    delay(3000);
    ESP.restart();
  } 
  else {
    Serial.println("[WIFI] Connected Successfully to internet!");
    Serial.print("[WIFI] IP Address: ");
    Serial.println(WiFi.localIP());
  }

  // WSS Network Services Initialization
  client.onEvent(webSocketEvent);
  client.beginSSL(MQTT_HOST, MQTT_PORT, MQTT_PATH, NULL, "mqtt");
  client.setReconnectInterval(3000);

  mqtt.begin(client);
  connectMQTT();
}

void loop() {
  // Selalu jalankan engine background untuk WSS WebSocket dan MQTT
  client.loop();
  mqtt.update();

  // Rutinitas Auto-Reconnect MQTT Client jika terputus
  static unsigned long lastReconnectAttempt = 0;
  if (!mqtt.isConnected()) {
    if (millis() - lastReconnectAttempt >= 5000) {
      lastReconnectAttempt = millis();
      connectMQTT();
    }
  }

  // Polling data HLW8012 dan Pengiriman data JSON ke Broker
  if (millis() - prevMillis >= intervalPengiriman * 1000) {
    activePower = hlw8012.getActivePower();
    voltage = hlw8012.getVoltage();
    current = hlw8012.getCurrent();

    activePowerCalibrated = activePowerCalc.a * pow(hlw8012.getActivePower(), 4) + activePowerCalc.b * pow(hlw8012.getActivePower(), 3) + activePowerCalc.c * pow(hlw8012.getActivePower(), 2) + activePowerCalc.d * hlw8012.getActivePower() + activePowerCalc.e;
    voltageCalibrated = voltageCalc.a * pow(hlw8012.getVoltage(), 2) + voltageCalc.b * hlw8012.getVoltage() + voltageCalc.c;
    currentCalibrated = currentCalc.a * pow(hlw8012.getCurrent(), 4) + currentCalc.b * pow(hlw8012.getCurrent(), 3) + currentCalc.c * pow(hlw8012.getCurrent(), 2) + currentCalc.d * hlw8012.getCurrent() + currentCalc.e;

    hlw8012.toggleMode();

    if (mqtt.isConnected()) {
      publish_json();
    }

    prevMillis = millis();
  }
}
