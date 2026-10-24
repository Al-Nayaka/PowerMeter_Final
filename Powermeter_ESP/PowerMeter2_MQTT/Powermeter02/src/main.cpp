#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <HLW8012.h>
#include <WiFiManager.h> // Tambahan WiFiManager

#define SERIAL_BAUDRATE 115200

//GPIO
#define RELAY_PIN 25
#define SEL_PIN 26
#define CF1_PIN 13
#define CF_PIN 34
#define LED_PIN 32

//HLW8012 Config
#define UPDATE_TIME 2000  // ms
#define CURRENT_MODE HIGH
#define CURRENT_RESISTOR 0.001
#define VOLTAGE_RESISTOR_UPSTREAM (5 * 470000)  // 2280k
#define VOLTAGE_RESISTOR_DOWNSTREAM (1000)      // 1k

//HLW8012 Variables
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

//MQTT Config
const char* mqtt_server = "192.168.0.100";
const char* TOPIC_relay = "powermeter02/relay";
const char* TOPIC_json = "esp/hlw8012/meter2";
int intervalPengiriman = 5;  // satuan detik

// Calibration struct
struct Calibration {
  double a;
  double b;
  double c;
  double d;
  double e;
};

// Calibration Variables
Calibration currentCalc = { 0.000251788306, -0.005371661044, 0.03366681016, 0.3430662906, 0.043 };                  //Poly 4th
Calibration voltageCalc = { 0.25863, -109.95387, 11913.15000, 0, 0 };                                               // poly 2nd
Calibration activePowerCalc = { 0.0000000001150392972, -0.0000004057847615, 0.0003827099824, 0.3331133257, 5.25 };  //poly 4th

//Objects
WiFiClient espClient;
PubSubClient mqtt(espClient);
HLW8012 hlw8012;

//WiFi Setup menggunakan WiFiManager
void setup_wifi() {
  WiFiManager wm;

  Serial.println("\n--- Memulai WiFiManager ---");

  // Opsional: Buka tanda komentar di bawah jika ingin mereset kredensial WiFi saat pengujian
  
  wm.resetSettings();
  
  // Jika ESP32 belum menyimpan kredensial WiFi, ia akan membuat Access Point bernama "ESP32_Config_AP"
  // Anda bisa menghubungkan HP/Laptop ke AP tersebut untuk mengatur WiFi.
  bool res = wm.autoConnect("PowerMeter02");

  if(!res) {
    Serial.println("Gagal terhubung dan timeout tercapai. Mengulang sistem...");
    ESP.restart();
  } else {
    Serial.println("WiFi Terhubung!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  }
}

//HLW8012 Calibration Delay Helper
void unblockingDelay(unsigned long mseconds) {
  unsigned long timeout = millis();
  while ((millis() - timeout) < mseconds) delay(1);
}

void calibrate() {
  hlw8012.getActivePower();

  hlw8012.setMode(MODE_CURRENT);
  unblockingDelay(2000);
  hlw8012.getCurrent();

  hlw8012.setMode(MODE_VOLTAGE);
  unblockingDelay(2000);
  hlw8012.getVoltage();

  //Load expected
  hlw8012.expectedActivePower(60.0);
  hlw8012.expectedVoltage(220.0);
  hlw8012.expectedCurrent(60.0 / 220.0);

  Serial.print("[HLW] New current multiplier : ");
  Serial.println(hlw8012.getCurrentMultiplier());
  Serial.print("[HLW] New voltage multiplier : ");
  Serial.println(hlw8012.getVoltageMultiplier());
  Serial.print("[HLW] New power multiplier   : ");
  Serial.println(hlw8012.getPowerMultiplier());
  Serial.println();
}

//Feedback dari MQTT
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Pesan Masuk dari topic [");
  Serial.print(topic);
  Serial.print("] :");
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

//MQTT Reconnect
unsigned long lastMQTTAttempt = 0;

void reconnect() {
  if (mqtt.connected()) return;
  if (millis() - lastMQTTAttempt < 5000) return;

  lastMQTTAttempt = millis();
  Serial.print("Attempting MQTT connection...");

  String clientId = "ESP32Client-";
  clientId += String(random(0xffff), HEX);

  if (mqtt.connect(clientId.c_str())) {
    Serial.println("connected!");
    mqtt.subscribe(TOPIC_relay);
    Serial.println("Subscribe ke topic: " + String(TOPIC_relay));
  } else {
    Serial.print("Failed, rc=");
    Serial.println(mqtt.state());
  }
}

void publish_json() {
  JsonDocument doc;

  // Format raw values
  sprintf(bufferActivePower, "%.3f", activePower);
  sprintf(bufferVoltage, "%.1f", voltage);
  sprintf(bufferCurrent, "%.3f", current);

  // Format calibrated values
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
}

void setup() {
  Serial.begin(SERIAL_BAUDRATE);
  
  // Memanggil fungsi WiFiManager
  setup_wifi();

  mqtt.setServer(mqtt_server, 1883);
  mqtt.setCallback(callback);

  //GPIO Setup
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);  // Relay default OFF
  digitalWrite(LED_PIN, LOW);     // LED default OFF

  //HLW8012 Setup
  hlw8012.begin(
    CF_PIN,
    CF1_PIN,
    SEL_PIN,
    CURRENT_MODE,
    false,
    500000);

  hlw8012.setResistors(
    CURRENT_RESISTOR,
    VOLTAGE_RESISTOR_UPSTREAM,
    VOLTAGE_RESISTOR_DOWNSTREAM);

  //calibrate();
}

void loop() {
  reconnect();

  if (mqtt.connected()) {
    mqtt.loop();
  }

  if (millis() - prevMillis >= intervalPengiriman * 1000) {
    activePower = hlw8012.getActivePower();
    voltage = hlw8012.getVoltage();
    current = hlw8012.getCurrent();

    // Kalkulasi kalibrasi polynomial
    activePowerCalibrated = activePowerCalc.a * pow(activePower, 4) + activePowerCalc.b * pow(activePower, 3) + activePowerCalc.c * pow(activePower, 2) + activePowerCalc.d * activePower + activePowerCalc.e;
    voltageCalibrated = voltageCalc.a * pow(voltage, 2) + voltageCalc.b * voltage + voltageCalc.c;
    currentCalibrated = currentCalc.a * pow(current, 4) + currentCalc.b * pow(current, 3) + currentCalc.c * pow(current, 2) + currentCalc.d * current + currentCalc.e;

    hlw8012.toggleMode();

    if (mqtt.connected()) {
      publish_json();
    }

    prevMillis = millis();
  }
}
