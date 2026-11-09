import { randomUUID } from 'node:crypto';
import { AppError, relayBody } from '../../middleware/validation.js';

export function relayService({ pool, repository, devices, config, publish, isMqttConnected, event, broadcast }) {
    const sweep = async () => {
        for (const command of await repository.expire(config.relayTimeoutMs)) {
            await event('relay_command_timeout', `Relay command ${command.command_id} timed out`, command.device_id);
        }
    };
    return {
        sweep,
        states: async (code) => repository.states((await devices.get(code)).id),
        async getCommand(code, id) {
            const device = await devices.get(code);
            await sweep();
            const command = await repository.get(id);
            if (!command || String(command.device_id) !== String(device.id)) throw new AppError(404, 'Command not found');
            return command;
        },
        async command(code, body) {
            relayBody(body);
            if (!isMqttConnected()) throw new AppError(503, 'MQTT unavailable');
            const current = await devices.get(code);
            if (!current.online || !current.is_enabled) throw new AppError(409, 'Device offline or disabled');
            await sweep();
            const client = await pool.connect();
            let command;
            try {
                await client.query('BEGIN');
                const device = await devices.requireEnabled(code, client, true);
                if (await repository.pending(device.id, client)) throw new AppError(409, 'Another relay command is pending');
                command = await repository.create(device.id, { command_id: randomUUID(), relay_number: body.relay_number, state: body.state }, client);
                await client.query('COMMIT');
            } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
            finally { client.release(); }
            try {
                const delivery = await publish(`powermeter/${code}/relay/command`, { command_id: command.command_id, device_code: code, relay_number: body.relay_number, state: body.state, issued_at: new Date(command.requested_at).toISOString(), expires_at: new Date(new Date(command.requested_at).getTime() + config.relayTimeoutMs).toISOString() });
                if (delivery?.acknowledged !== false) await repository.published(command.command_id);
            } catch {
                await repository.fail(command.command_id);
                await event('relay_command_failed', `Relay command ${command.command_id} failed`, command.device_id);
                throw new AppError(503, 'Relay command publication failed');
            }
            return repository.get(command.command_id);
        },
        async acknowledge(code, data) {
            const client = await pool.connect();
            let row;
            let device;
            try {
                await client.query('BEGIN');
                device = await devices.requireEnabled(code, client, true);
                const command = await repository.get(data.command_id, client, true);
                if (!command || String(command.device_id) !== String(device.id) || command.relay_number !== data.relay_number || command.state !== data.state) throw new AppError(400, 'Acknowledgement does not match command');
                if (command.status !== 'confirmed') {
                    if (!['requested', 'published'].includes(command.status) || Date.now() - new Date(command.requested_at).getTime() > config.relayTimeoutMs) throw new AppError(409, 'Command already expired or failed');
                    const confirmed = Date.parse(data.confirmed_at);
                    if (confirmed < new Date(command.requested_at).getTime() - 2000 || confirmed > Date.now() + 5000) throw new AppError(400, 'Invalid confirmation time');
                    row = await repository.confirm(command, data, client);
                }
                await client.query('COMMIT');
            } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
            finally { client.release(); }
            if (row) {
                broadcast('relay_state', { ...row, device_code: code, command_id: data.command_id });
                await event('relay_state_changed', `Relay 1 ${data.state ? 'ON' : 'OFF'} confirmed`, device.id);
            }
        },
    };
}
