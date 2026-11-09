export function deviceRepository(pool) {
    return {
        list: async () => (await pool.query('SELECT * FROM devices ORDER BY device_code')).rows,
        find: async (code, client = pool, lock = false) => (await client.query(`SELECT * FROM devices WHERE device_code = $1${lock ? ' FOR UPDATE' : ''}`, [code])).rows[0],
        touch: async (id, client = pool) => client.query('UPDATE devices SET last_seen_at = NOW() WHERE id = $1', [id]),
        create: async (data) => (await pool.query('INSERT INTO devices (device_code, device_name, location, mqtt_topic_prefix) VALUES ($1,$2,$3,$4) RETURNING *', [data.device_code, data.device_name, data.location ?? null, data.mqtt_topic_prefix])).rows[0],
        update: async (code, data) => (await pool.query('UPDATE devices SET device_name = COALESCE($2,device_name), location = CASE WHEN $3 THEN $4 ELSE location END WHERE device_code = $1 RETURNING *', [code, data.device_name ?? null, Object.hasOwn(data, 'location'), data.location ?? null])).rows[0],
        setEnabled: async (code, enabled) => (await pool.query('UPDATE devices SET is_enabled = $2 WHERE device_code = $1 RETURNING *', [code, enabled])).rows[0],
    };
}
