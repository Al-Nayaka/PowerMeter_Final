import test from 'node:test';
import assert from 'node:assert/strict';
import { testDatabase } from './helpers/database.js';
import { createServices } from '../src/services.js';

test('Postgres domain persists, deduplicates, orders history and confirms relay only on matching ACK', async (t) => {
    const { db, pool } = await testDatabase();
    t.after(() => db.close());
    const events = [];
    const commands = [];
    const config = { offlineTimeoutMs: 45000, relayTimeoutMs: 10000 };
    const services = createServices({ pool, config, broadcast: (type, data) => events.push({ type, data }), publish: async (topic, data) => commands.push({ topic, data }), isMqttConnected: () => true, logger: { error() {} } });
    const code = 'PM-ESP32-001';
    await services.devices.create({ device_code: code, device_name: 'Panel 1', mqtt_topic_prefix: `powermeter/${code}` });
    await assert.rejects(services.measurements.latest(code), /No measurements/);
    const now = new Date().toISOString();
    const data = { device_code: code, message_id: 'boot-1', voltage: 220, current: 1, active_power: 220, energy_wh: 10, power_factor: null, recorded_at: now };
    await services.acceptMessage({ type: 'measurement', code, data });
    await services.acceptMessage({ type: 'measurement', code, data });
    assert.equal(events.filter((e) => e.type === 'measurement').length, 1);
    assert.equal((await services.measurements.history(code, { limit: 1 })).length, 1);
    assert.ok((await services.devices.get(code)).last_seen_at);
    const command = await services.relays.command(code, { relay_number: 1, state: true });
    assert.equal(command.status, 'published');
    assert.equal(commands.length, 1);
    assert.equal(Date.parse(commands[0].data.expires_at) - Date.parse(commands[0].data.issued_at), config.relayTimeoutMs);
    assert.equal((await services.relays.states(code)).length, 0);
    const ack = { device_code: code, command_id: command.command_id, relay_number: 1, state: false, confirmed_at: now };
    await assert.rejects(services.acceptMessage({ type: 'relay_state', code, data: ack }), /match/);
    await services.acceptMessage({ type: 'relay_state', code, data: { ...ack, state: true } });
    await services.acceptMessage({ type: 'relay_state', code, data: { ...ack, state: true } });
    assert.equal((await services.relays.getCommand(code, command.command_id)).status, 'confirmed');
    assert.equal((await services.relays.states(code))[0].state, true);
    assert.equal((await db.query('SELECT count(*) FROM relay_states')).rows[0].count, 1);
    await services.devices.setEnabled(code, { is_enabled: false });
    await assert.rejects(services.acceptMessage({ type: 'measurement', code, data: { ...data, message_id: 'boot-2' } }), /disabled/);
    await assert.rejects(services.relays.command(code, { relay_number: 1, state: false }));
});

test('relay lifecycle records publish failure, times out and rejects late ACK/offline commands', async (t) => {
    const { db, pool } = await testDatabase();
    t.after(() => db.close());
    let connected = true;
    let fail = true;
    const config = { offlineTimeoutMs: 45000, relayTimeoutMs: 1000 };
    const services = createServices({ pool, config, broadcast() {}, publish: async () => { if (fail) throw new Error('broker down'); }, isMqttConnected: () => connected, logger: { error() {} } });
    const code = 'PM-ESP32-001';
    await services.devices.create({ device_code: code, device_name: 'Panel', mqtt_topic_prefix: `powermeter/${code}` });
    await assert.rejects(services.relays.command(code, { relay_number: 1, state: true }), /offline/);
    await services.acceptMessage({ type: 'heartbeat', code, data: { device_code: code } });
    await assert.rejects(services.relays.command(code, { relay_number: 1, state: true }), /publication failed/);
    assert.equal((await db.query('SELECT status FROM relay_commands')).rows[0].status, 'failed');
    assert.equal((await services.relays.states(code)).length, 0);
    fail = false;
    const command = await services.relays.command(code, { relay_number: 1, state: true });
    await assert.rejects(services.relays.command(code, { relay_number: 1, state: false }), /pending/);
    await db.query("UPDATE relay_commands SET requested_at = NOW() - INTERVAL '5 seconds' WHERE command_id = $1", [command.command_id]);
    await services.sweep();
    assert.equal((await services.relays.getCommand(code, command.command_id)).status, 'timed_out');
    await assert.rejects(services.acceptMessage({ type: 'relay_state', code, data: { command_id: command.command_id, relay_number: 1, state: true, confirmed_at: new Date().toISOString() } }), /expired/);
    connected = false;
    await assert.rejects(services.relays.command(code, { relay_number: 1, state: false }), /MQTT/);
});

test('server owns command identifiers even if request contains extra command_id', async (t) => {
    const { db, pool } = await testDatabase();
    t.after(() => db.close());
    const services = createServices({ pool, config: { offlineTimeoutMs: 45000, relayTimeoutMs: 10000 }, broadcast() {}, publish: async () => {}, isMqttConnected: () => true, logger: { error() {} } });
    const code = 'PM-ESP32-001';
    await services.devices.create({ device_code: code, device_name: 'Panel', mqtt_topic_prefix: `powermeter/${code}` });
    await services.acceptMessage({ type: 'heartbeat', code, data: {} });
    const injected = '123e4567-e89b-42d3-a456-426614174000';
    const cmd = await services.relays.command(code, { relay_number: 1, state: true, command_id: injected });
    assert.notEqual(cmd.command_id, injected);
});

test('latest relay state follows confirmed insertion order, not device clock regression', async (t) => {
    const { db, pool } = await testDatabase();
    t.after(() => db.close());
    const services = createServices({ pool, config: { offlineTimeoutMs: 45000, relayTimeoutMs: 10000 }, broadcast() {}, publish: async () => {}, isMqttConnected: () => true, logger: { error() {} } });
    const code = 'PM-ESP32-001';
    await services.devices.create({ device_code: code, device_name: 'Panel', mqtt_topic_prefix: `powermeter/${code}` });
    await services.acceptMessage({ type: 'heartbeat', code, data: {} });
    const on = await services.relays.command(code, { relay_number: 1, state: true });
    await services.acceptMessage({ type: 'relay_state', code, data: { command_id: on.command_id, relay_number: 1, state: true, confirmed_at: new Date(Date.now() + 3000).toISOString() } });
    const off = await services.relays.command(code, { relay_number: 1, state: false });
    await services.acceptMessage({ type: 'relay_state', code, data: { command_id: off.command_id, relay_number: 1, state: false, confirmed_at: new Date().toISOString() } });
    assert.equal((await services.relays.states(code))[0].state, false);
});

test('missing broker PUBACK is uncertain delivery and keeps command pending until deadline', async (t) => {
    const { db, pool } = await testDatabase();
    t.after(() => db.close());
    const services = createServices({ pool, config: { offlineTimeoutMs: 45000, relayTimeoutMs: 10000 }, broadcast() {}, publish: async () => ({ acknowledged: false }), isMqttConnected: () => true, logger: { error() {} } });
    const code = 'PM-ESP32-001';
    await services.devices.create({ device_code: code, device_name: 'Panel', mqtt_topic_prefix: `powermeter/${code}` });
    await services.acceptMessage({ type: 'heartbeat', code, data: {} });
    const command = await services.relays.command(code, { relay_number: 1, state: true });
    assert.equal(command.status, 'requested');
    await assert.rejects(services.relays.command(code, { relay_number: 1, state: false }), /pending/);
});
