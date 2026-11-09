import test from 'node:test';
import assert from 'node:assert/strict';
import { createSubscriber } from '../src/mqtt/mqttSubscriber.js';

test('ignores retained measurements, heartbeat and ACK but accepts offline LWT', async () => {
    const messages = [];
    const sub = createSubscriber({ config: { maxPendingMessages: 10, maxPayloadBytes: 4096 }, services: { acceptMessage: async (m) => messages.push(m), event: async () => {} }, logger: { error() {} } });
    const code = 'PM-ESP32-001';
    const send = (type, data) => sub.receive(`powermeter/${code}/${type}`, Buffer.from(JSON.stringify({ device_code: code, ...data })), { retain: true });
    send('measurement', { voltage: 220, current: 1, active_power: 220, energy_wh: 1, recorded_at: new Date().toISOString() });
    send('heartbeat', {});
    send('relay/state', { command_id: '123e4567-e89b-42d3-a456-426614174000', relay_number: 1, state: true, confirmed_at: new Date().toISOString() });
    send('availability', { status: 'online' });
    send('availability', { status: 'offline' });
    await sub.idle();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].data.status, 'offline');
});

test('bounds message backlog and rate-limits invalid payload events', async () => {
    let unblock;
    const gate = new Promise((r) => { unblock = r; });
    let calls = 0;
    let events = 0;
    const sub = createSubscriber({ config: { maxPendingMessages: 2, maxPayloadBytes: 4096 }, services: { acceptMessage: async () => { calls++; await gate; }, event: async () => { events++; } }, logger: { error() {} } });
    for (let i = 0; i < 100; i++) sub.receive('powermeter/PM-ESP32-001/heartbeat', Buffer.from('{"device_code":"PM-ESP32-001"}'), {});
    unblock();
    await sub.idle();
    assert.equal(calls, 2);
    assert.equal(events, 1);
    await sub.stop();
    sub.receive('powermeter/PM-ESP32-001/heartbeat', Buffer.from('{"device_code":"PM-ESP32-001"}'), {});
    await sub.idle();
    assert.equal(calls, 2);
});
