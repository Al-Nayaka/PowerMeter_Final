"""Source-level guards for provisioning and serial diagnostics; not hardware tests."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class WifiSetupTests(unittest.TestCase):
    def test_nonblocking_portal_is_serviced(self):
        source = (ROOT / "src/main.cpp").read_text()
        self.assertIn("wifiManager.setConfigPortalBlocking(false)", source)
        self.assertIn("wifiManager.autoConnect(", source)
        self.assertIn("wifiManager.process()", source)
        self.assertNotIn("WiFi.begin(WIFI_SSID", source)
        self.assertNotIn("*WIFI_SSID", source)
        self.assertNotIn("resetSettings()", source)

    def test_serial_and_dependency_remain_enabled(self):
        source = (ROOT / "src/main.cpp").read_text()
        config = (ROOT / "platformio.ini").read_text()
        self.assertIn("Serial.begin(115200)", source)
        self.assertIn("wifiManager.setDebugOutput(true)", source)
        self.assertIn("[METER]", source)
        self.assertIn("monitor_speed = 115200", config)
        self.assertIn("tzapu/WiFiManager@2.0.17", config)


if __name__ == "__main__":
    unittest.main()
