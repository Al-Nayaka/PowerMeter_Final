export const eventRepository = (pool) => ({
    insert: async (type, description, deviceId) => (await pool.query('INSERT INTO system_events (device_id, event_type, description) VALUES ($1,$2,$3) RETURNING *', [deviceId ?? null, type, description])).rows[0],
});
