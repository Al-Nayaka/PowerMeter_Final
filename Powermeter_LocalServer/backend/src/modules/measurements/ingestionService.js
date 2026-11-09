import { AppError } from '../../middleware/validation.js';

export function createIngestionService({ pool, devices, measurements, broadcast, markOnline }) {
    return async (code, data) => {
        const client = await pool.connect();
        let row;
        try {
            await client.query('BEGIN');
            const device = await devices.find(code, client, true);
            if (!device || !device.is_enabled || device.mqtt_topic_prefix !== `powermeter/${code}`) throw new AppError(403, 'Device unknown, disabled or topic not registered');
            row = await measurements.insert(device.id, data, client);
            await devices.touch(device.id, client);
            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally { client.release(); }
        if (row) broadcast('measurement', { ...row, device_code: code });
        await markOnline(code);
        return row;
    };
}
