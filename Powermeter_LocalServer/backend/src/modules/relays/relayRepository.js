export const relayRepository = (pool) => ({
    states: async (deviceId) => (await pool.query('SELECT DISTINCT ON (relay_number) * FROM relay_states WHERE device_id = $1 ORDER BY relay_number, id DESC', [deviceId])).rows,
    create: async (id, data, client = pool) => (await client.query(`INSERT INTO relay_commands (command_id, device_id, relay_number, state, status) VALUES ($1,$2,$3,$4,'requested') RETURNING *`, [data.command_id, id, data.relay_number, data.state])).rows[0],
    get: async (commandId, client = pool, lock = false) => (await client.query(`SELECT * FROM relay_commands WHERE command_id = $1${lock ? ' FOR UPDATE' : ''}`, [commandId])).rows[0],
    pending: async (deviceId, client) => (await client.query("SELECT command_id FROM relay_commands WHERE device_id = $1 AND status IN ('requested','published') LIMIT 1", [deviceId])).rows[0],
    published: async (commandId) => (await pool.query("UPDATE relay_commands SET status = 'published', published_at = NOW() WHERE command_id = $1 AND status = 'requested' RETURNING *", [commandId])).rows[0],
    fail: async (commandId) => pool.query("UPDATE relay_commands SET status = 'failed', error = 'MQTT publication failed' WHERE command_id = $1 AND status IN ('requested','published')", [commandId]),
    confirm: async (command, data, client) => {
        await client.query("UPDATE relay_commands SET status = 'confirmed', confirmed_at = $2 WHERE command_id = $1", [command.command_id, data.confirmed_at]);
        return (await client.query('INSERT INTO relay_states (device_id, relay_number, state, changed_at) VALUES ($1,$2,$3,$4) RETURNING *', [command.device_id, data.relay_number, data.state, data.confirmed_at])).rows[0];
    },
    expire: async (timeoutMs) => (await pool.query("UPDATE relay_commands SET status = 'timed_out', error = 'Device acknowledgement timed out' WHERE status IN ('requested','published') AND requested_at < NOW() - ($1 * INTERVAL '1 millisecond') RETURNING *", [timeoutMs])).rows,
});
