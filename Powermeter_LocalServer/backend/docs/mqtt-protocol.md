# MQTT interoperability contract

Topics are case-sensitive: `powermeter/{device_code}/{suffix}`. Registered database topic prefix must be exactly canonical. Payload `device_code` must match topic and an enabled registered device. Simulator and deploy ACL cover the same protocol as the PRD.

| Suffix | Publisher | QoS | Retained | Payload |
| --- | --- | --- | --- | --- |
| `measurement` | device | 0 | no | `device_code`, `message_id`, finite numeric `voltage`, `current`, `active_power`, cumulative `energy_wh`, `power_factor` [0,1] or null, `recorded_at` ISO UTC |
| `heartbeat` | device | 1 | no | `device_code`, `timestamp` ISO UTC |
| `availability` | device | 1 | yes | `device_code`, `status`: `online` or `offline` |
| `relay/command` | backend | 1 | **no** | UUID `command_id`, `device_code`, `relay_number: 1`, boolean `state`, `issued_at` ISO UTC, `expires_at` ISO UTC |
| `relay/state` | device | 1 | no | same command/device/relay/state, `confirmed_at` ISO UTC |

Broker LWT is retained `{ "device_code": "PM-ESP32-001", "status": "offline" }` on the availability topic; online is published retained on connect. LWT cannot know the future disconnect timestamp, so availability intentionally has no required timestamp. Heartbeats carry server-validated ISO timestamps; freshness/online timeout is based on valid reception time, not arbitrary device time or stale retained online claims.

Measurements use a unique boot-token + sequence ID (maximum 128 characters); UUID command IDs are required by migration 002. Plain string numeric values, negative/nonfinite values, malformed JSON, invalid timestamps, wrong identity and disabled/unknown devices must be rejected. All values are low-voltage simulation/telemetry only; a relay simulator ACK is not proof of physical switching.

QoS 1 may duplicate commands, state and heartbeats. Apply a desired boolean state idempotently, never toggle blindly. Correlate command ID, device, relay and desired state before confirming; duplicate or stale ACK must not create a second successful transition. A successful MQTT publish is only `published`, not `confirmed`. Firmware must not execute retained stale commands. Backend broadcasts stored measurements only after commit and only for newly inserted measurements. HTTP/WebSocket NUMERIC fields may be strings even though MQTT samples must be JSON numbers.

Before commissioning actual firmware, verify numeric units (volts, amperes, watts, cumulative watt-hours), UTC timestamp synchronization, boot ID persistence semantics, relay ON polarity, topic ACL isolation, availability shapes and command timeout behavior against the implemented backend. Do not use a network relay command as a substitute for physical overcurrent protection.
