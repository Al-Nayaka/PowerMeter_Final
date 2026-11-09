export function readEnvironment(env = process.env) {
    const required = (key) => {
        if (!env[key]?.trim()) throw new Error(`Missing configuration: ${key}`);
        return env[key];
    };
    const integer = (key, fallback, min, max) => {
        const value = Number(env[key] ?? fallback);
        if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid configuration: ${key}`);
        return value;
    };
    const mqttUrl = required('MQTT_URL');
    let url;
    try { url = new URL(mqttUrl); } catch { throw new Error('Invalid configuration: MQTT_URL'); }
    if (!['mqtt:', 'mqtts:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid configuration: MQTT_URL (use separate credentials)');
    const adminKey = env.ADMIN_API_KEY || '';
    if (env.NODE_ENV === 'production' && adminKey.length < 32) throw new Error('ADMIN_API_KEY must contain at least 32 characters in production');
    const allowedOrigins = (env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((s) => s.trim());
    for (const origin of allowedOrigins) {
        try { if (new URL(origin).origin !== origin || !/^https?:/.test(origin)) throw new Error(); }
        catch { throw new Error('Invalid configuration: ALLOWED_ORIGINS'); }
    }
    return {
        port: integer('PORT', 3000, 1, 65535), host: env.HOST || '127.0.0.1',
        database: { host: required('DB_HOST'), port: integer('DB_PORT', 5432, 1, 65535), database: required('DB_NAME'), user: required('DB_USER'), password: required('DB_PASSWORD'), max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000, statement_timeout: 10000 },
        mqttUrl, mqttUsername: env.MQTT_USERNAME || undefined, mqttPassword: env.MQTT_PASSWORD || undefined,
        mqttClientId: env.MQTT_CLIENT_ID || 'powermeter-backend', adminKey, allowedOrigins,
        historyMaxLimit: integer('HISTORY_MAX_LIMIT', 1000, 1, 10000),
        offlineTimeoutMs: integer('DEVICE_OFFLINE_SECONDS', 45, 20, 3600) * 1000,
        relayTimeoutMs: integer('RELAY_TIMEOUT_SECONDS', 10, 1, 60) * 1000,
        maxPayloadBytes: integer('MQTT_MAX_PAYLOAD_BYTES', 4096, 256, 65536),
        maxPendingMessages: integer('MQTT_MAX_PENDING', 100, 1, 10000),
    };
}
