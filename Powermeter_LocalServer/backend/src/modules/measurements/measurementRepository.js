export const measurementRepository = (pool) => ({
    insert: async (id, data, client = pool) => (await client.query(`INSERT INTO measurements (device_id, voltage, current, active_power, energy_wh, power_factor, recorded_at, message_id)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (device_id, message_id) DO NOTHING RETURNING *`, [id, data.voltage, data.current, data.active_power, data.energy_wh, data.power_factor ?? null, data.recorded_at, data.message_id ?? null])).rows[0] ?? null,
    latest: async (id) => (await pool.query('SELECT * FROM measurements WHERE device_id = $1 ORDER BY recorded_at DESC, id DESC LIMIT 1', [id])).rows[0],
    history: async (id, { limit, from, to }) => {
        const params = [id];
        let sql = 'SELECT * FROM measurements WHERE device_id = $1';
        if (from) { params.push(from); sql += ` AND recorded_at >= $${params.length}`; }
        if (to) { params.push(to); sql += ` AND recorded_at <= $${params.length}`; }
        params.push(limit);
        return (await pool.query(`${sql} ORDER BY recorded_at DESC, id DESC LIMIT $${params.length}`, params)).rows;
    },
});
