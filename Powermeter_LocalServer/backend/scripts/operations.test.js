import test from 'node:test';
import assert from 'node:assert/strict';
import { interval, measurement, createRelaySimulator } from './simulate.js';
import { positiveInteger } from './retention.js';
import { readFile } from 'node:fs/promises';

test('fresh baseline preserves PRD device columns and nullable command error', async () => {
  const core = await readFile(new URL('../migrations/001_core.sql', import.meta.url), 'utf8');
  const enhancements = await readFile(new URL('../migrations/002_ingestion_and_commands.sql', import.meta.url), 'utf8');
  assert.match(core, /device_name VARCHAR\(120\) NOT NULL/);
  assert.match(core, /is_enabled BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(enhancements, /error TEXT\s*\n/);
  assert.doesNotMatch(enhancements, /error_message/);
});

test('simulator rejects expired reconnect commands and duplicates cannot reverse newer relay state', () => {
  const relay = createRelaySimulator('PM-ESP32-001');
  const now = Date.parse('2026-11-09T10:00:00.000Z');
  const on = { command_id: '123e4567-e89b-42d3-a456-426614174000', device_code: 'PM-ESP32-001', relay_number: 1, state: true, issued_at: new Date(now).toISOString(), expires_at: new Date(now + 10000).toISOString() };
  assert.equal(relay.accept(on, false, now).state, true);
  assert.equal(relay.state, true);
  const off = { ...on, command_id: '123e4567-e89b-42d3-a456-426614174001', state: false };
  assert.equal(relay.accept(off, false, now + 1000).state, false);
  assert.equal(relay.accept(on, false, now + 2000).state, true);
  assert.equal(relay.state, false);
  assert.equal(relay.accept(on, false, now + 10000), null);
  assert.equal(relay.accept({ ...on, expires_at: undefined }, false, now), null);
  assert.equal(relay.accept(on, true, now), null);
  assert.equal(relay.accept({ ...on, expires_at: 'not a time' }, false, now), null);
  assert.equal(relay.accept({ ...on, state: false }, false, now + 2000), null);
});

test('simulator emits numeric, timestamped bounded measurements', () => {
  const payload = measurement('PM-ESP32-001', 'boot', 1, 123.4567, new Date('2026-11-09T00:00:00Z'));
  assert.equal(payload.message_id, 'boot-1');
  assert.equal(payload.energy_wh, 123.457);
  assert.equal(payload.recorded_at, '2026-11-09T00:00:00.000Z');
  for (const key of ['voltage', 'current', 'active_power', 'energy_wh', 'power_factor']) {
    assert.equal(typeof payload[key], 'number');
    assert.ok(Number.isFinite(payload[key]) && payload[key] >= 0);
  }
});
test('operator inputs reject unsafe bounds', () => {
  for (const bad of ['0', '-1', 'NaN', 'Infinity', '1.5', '100000000']) {
    assert.throws(() => interval(bad, 1000));
    assert.throws(() => positiveInteger(bad, 30, 36500));
  }
  assert.equal(interval(undefined, 1000), 1000);
  assert.equal(positiveInteger(undefined, 30, 36500), 30);
});
