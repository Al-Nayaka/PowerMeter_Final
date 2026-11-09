import test from 'node:test';
import assert from 'node:assert/strict';
import { createIngestionService } from '../src/modules/measurements/ingestionService.js';

function fixture({ device = { id: '1', device_code: 'PM-ESP32-001', mqtt_topic_prefix: 'powermeter/PM-ESP32-001', is_enabled: true }, fail = false, duplicate = false } = {}) {
    const calls = [];
    const client = { query: async (sql) => calls.push(sql), release: () => calls.push('release') };
    const ingest = createIngestionService({ pool: { connect: async () => client }, devices: { find: async () => device, touch: async () => calls.push('touch') }, measurements: { insert: async (id, data) => { if (fail) throw new Error('db down'); return duplicate ? null : { id: '2', device_id: id, ...data }; } }, broadcast: (type) => calls.push(type), markOnline: async () => calls.push('online') });
    return { ingest, calls };
}
const data = { device_code: 'PM-ESP32-001', voltage: 220, current: 1, active_power: 220, energy_wh: 100, recorded_at: new Date().toISOString() };
test('commits measurement and last_seen before broadcasting', async () => {
    const { ingest, calls } = fixture();
    await ingest(data.device_code, data);
    assert.ok(calls.indexOf('COMMIT') < calls.indexOf('measurement'));
    assert.ok(calls.indexOf('touch') < calls.indexOf('COMMIT'));
});
test('rejects unknown and disabled devices without broadcast', async () => {
    for (const device of [null, { id: '1', is_enabled: false }]) {
        const { ingest, calls } = fixture({ device });
        await assert.rejects(ingest(data.device_code, data));
        assert.ok(calls.includes('ROLLBACK'));
        assert.ok(!calls.includes('measurement'));
    }
});
test('database failure rolls back and never broadcasts', async () => {
    const { ingest, calls } = fixture({ fail: true });
    await assert.rejects(ingest(data.device_code, data), /db down/);
    assert.ok(calls.includes('ROLLBACK'));
    assert.ok(!calls.includes('measurement'));
});
test('duplicate message does not broadcast a second measurement', async () => {
    const { ingest, calls } = fixture({ duplicate: true });
    await ingest(data.device_code, data);
    assert.ok(!calls.includes('measurement'));
});
