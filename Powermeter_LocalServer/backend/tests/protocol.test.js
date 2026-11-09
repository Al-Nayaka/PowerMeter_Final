import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMessage } from '../src/mqtt/topicHandler.js';

const topic = 'powermeter/PM-ESP32-001/measurement';
const data = { device_code: 'PM-ESP32-001', message_id: 'boot-1', voltage: 220.5, current: 1.25, active_power: 275, energy_wh: 100, power_factor: null, recorded_at: '2026-11-09T10:00:00Z' };
const parse = (value, path = topic) => parseMessage(path, Buffer.from(JSON.stringify(value)));
test('measurement uses numeric values and accepts unavailable PF', () => {
    assert.equal(parse(data).type, 'measurement');
    assert.equal(parse(data).data.power_factor, null);
});
test('rejects legacy topic, malformed JSON and mismatched identity', () => {
    assert.throws(() => parse(data, 'esp/hlw8012/meter1'), /topic/i);
    assert.throws(() => parseMessage(topic, Buffer.from('{')), /JSON/);
    assert.throws(() => parse({ ...data, device_code: 'other' }), /identity/i);
});
test('rejects negative, nonnumeric, nonfinite, invalid PF or timestamp', () => {
    for (const change of [{ voltage: -1 }, { current: '1.2' }, { energy_wh: null }, { active_power: Infinity }, { power_factor: 1.01 }, { recorded_at: '2026-02-30T10:00:00Z' }, { recorded_at: '2026-11-09T10:00:00' }]) {
        assert.throws(() => parse({ ...data, ...change }));
    }
});
test('validates availability and relay acknowledgement', () => {
    assert.equal(parse({ device_code: data.device_code, status: 'offline' }, 'powermeter/PM-ESP32-001/availability').data.status, 'offline');
    assert.throws(() => parse({ device_code: data.device_code, status: 'maybe' }, 'powermeter/PM-ESP32-001/availability'));
    assert.equal(parse({ device_code: data.device_code, command_id: '123e4567-e89b-42d3-a456-426614174000', relay_number: 1, state: true, confirmed_at: data.recorded_at }, 'powermeter/PM-ESP32-001/relay/state').type, 'relay_state');
});
test('heartbeat may omit time before NTP, but supplied timestamp must be valid', () => {
    const topic = 'powermeter/PM-ESP32-001/heartbeat';
    assert.equal(parse({ device_code: data.device_code }, topic).type, 'heartbeat');
    assert.throws(() => parse({ device_code: data.device_code, timestamp: 'bad' }, topic));
    assert.throws(() => parse({ device_code: data.device_code, recorded_at: '2026-02-30T10:00:00Z' }, topic));
});
