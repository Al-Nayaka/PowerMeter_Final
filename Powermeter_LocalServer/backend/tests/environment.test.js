import test from 'node:test';
import assert from 'node:assert/strict';
import { readEnvironment } from '../src/config/environment.js';

const env = { DB_HOST: 'localhost', DB_NAME: 'test', DB_USER: 'tester', DB_PASSWORD: 'secret', MQTT_URL: 'mqtt://localhost:1883' };
test('requires database configuration without exposing secrets', () => {
    assert.throws(() => readEnvironment({ ...env, DB_HOST: '' }), /DB_HOST/);
});
test('rejects invalid limits and unsafe production access', () => {
    assert.throws(() => readEnvironment({ ...env, PORT: 'NaN' }), /PORT/);
    assert.throws(() => readEnvironment({ ...env, NODE_ENV: 'production' }), /ADMIN_API_KEY/);
});
test('reads bounded defaults and allowed origins', () => {
    const config = readEnvironment(env);
    assert.equal(config.port, 3000);
    assert.equal(config.historyMaxLimit, 1000);
    assert.deepEqual(config.allowedOrigins, ['http://localhost:5173']);
});
