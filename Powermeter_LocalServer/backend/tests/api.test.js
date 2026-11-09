import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';

test('HTTP API bounds history, protects writes, validates origins and masks failures', async (t) => {
    const config = { adminKey: 'test-key', allowedOrigins: ['http://localhost:5173'], historyMaxLimit: 1000 };
    const services = {
        devices: { list: async () => [{ device_code: 'PM-ESP32-001' }], create: async (body) => body },
        measurements: { history: async (code, query) => { if (code === 'broken') throw new Error('password=secret'); return [{ code, ...query }]; } },
        relays: { command: async () => ({ status: 'published' }) },
    };
    const server = http.createServer(createApp({ config, services, health: async () => ({ database: true, mqtt: false }), logger: { error() {} } }));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    t.after(() => { server.closeAllConnections(); return new Promise((r) => server.close(r)); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    assert.equal((await fetch(`${base}/health`)).status, 503);
    assert.equal((await fetch(`${base}/devices`)).status, 200);
    assert.equal((await fetch(`${base}/measurements/history/PM-ESP32-001?limit=1001`)).status, 400);
    assert.equal((await fetch(`${base}/measurements/history/PM-ESP32-001?limit=-1`)).status, 400);
    assert.equal((await fetch(`${base}/measurements/history/PM-ESP32-001?from=bad`)).status, 400);
    assert.equal((await fetch(`${base}/devices`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
    assert.equal((await fetch(`${base}/devices`, { headers: { Origin: 'https://evil.example' } })).status, 403);
    const response = await fetch(`${base}/measurements/history/broken`);
    assert.equal(response.status, 500);
    assert.ok(!(await response.text()).includes('secret'));
    const relay = await fetch(`${base}/relays/PM-ESP32-001/commands`, { method: 'POST', headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }, body: JSON.stringify({ relay_number: 1, state: true }) });
    assert.equal(relay.status, 202);
    assert.equal((await relay.json()).data.status, 'published');
    assert.equal((await fetch(`${base}/relays/PM-ESP32-001/commands`, { method: 'POST', headers: { Authorization: 'Basic cHJveHk6dGVzdA==', 'X-Admin-Key': 'test-key', 'Content-Type': 'application/json' }, body: JSON.stringify({ relay_number: 1, state: false }) })).status, 202);
    assert.equal((await fetch(`${base}/relays/PM-ESP32-001/commands`, { method: 'POST', headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' }, body: '{' })).status, 400);
});
