import { check, deviceCode, timestamp, relayBody, uuid } from '../middleware/validation.js';

export function parseMessage(topic, payload, maxBytes = 4096) {
    check(payload.length <= maxBytes, 'Payload too large');
    const match = /^powermeter\/([^/]+)\/(measurement|heartbeat|availability|relay\/state)$/.exec(topic);
    check(match, 'Invalid topic');
    const code = deviceCode(match[1]);
    let data;
    try { data = JSON.parse(payload.toString('utf8')); } catch { throw new Error('Invalid JSON payload'); }
    check(data && !Array.isArray(data) && typeof data === 'object', 'Payload must be an object');
    check(data.device_code === code, 'Topic/payload identity mismatch');
    const type = match[2].replace('/', '_');
    if (type === 'measurement') {
        for (const [field, max] of Object.entries({ voltage: 99999999.99, current: 999999999.999, active_power: 999999999999.99, energy_wh: 999999999999999.999 })) {
            check(typeof data[field] === 'number' && Number.isFinite(data[field]) && data[field] >= 0 && data[field] <= max, `Invalid ${field}`);
        }
        check(data.power_factor == null || (typeof data.power_factor === 'number' && Number.isFinite(data.power_factor) && data.power_factor >= 0 && data.power_factor <= 1), 'Invalid power_factor');
        data.power_factor ??= null;
        if (data.message_id != null) check(typeof data.message_id === 'string' && /^[A-Za-z0-9_.:-]{1,128}$/.test(data.message_id), 'Invalid message_id');
        timestamp(data.recorded_at, 'recorded_at');
    } else if (type === 'heartbeat') {
        for (const field of ['timestamp', 'recorded_at']) if (Object.hasOwn(data, field)) timestamp(data[field], field);
    } else if (type === 'availability') {
        check(['online', 'offline'].includes(data.status), 'Invalid availability status');
    } else if (type === 'relay_state') {
        relayBody(data);
        uuid(data.command_id);
        timestamp(data.confirmed_at, 'confirmed_at');
    }
    return { type, code, data };
}
