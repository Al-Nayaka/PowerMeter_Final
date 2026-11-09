import { AppError, check, deviceCode } from '../../middleware/validation.js';

export function deviceService(repository, { config, broadcast, event }) {
    const presence = new Map();
    const status = (device) => {
        const live = presence.get(device.device_code);
        const seen = live?.seen ?? new Date(device.last_seen_at || 0).getTime();
        return device.is_enabled && live?.offline !== true && seen > Date.now() - config.offlineTimeoutMs;
    };
    const get = async (code) => {
        const device = await repository.find(deviceCode(code));
        if (!device) throw new AppError(404, 'Device not found');
        return { ...device, online: status(device) };
    };
    const requireEnabled = async (code, client, lock = false) => {
        const device = await repository.find(deviceCode(code), client, lock);
        if (!device || !device.is_enabled || device.mqtt_topic_prefix !== `powermeter/${code}`) throw new AppError(403, 'Device unknown, disabled or topic not registered');
        return device;
    };
    const transition = async (device, online) => {
        const previous = presence.get(device.device_code);
        presence.set(device.device_code, { seen: online ? Date.now() : (previous?.seen ?? new Date(device.last_seen_at || 0).getTime()), offline: !online });
        if (previous && previous.offline === !online) return;
        broadcast('device_status', { device_code: device.device_code, online, is_enabled: device.is_enabled });
        await event(online ? 'device_online' : 'device_offline', `Device ${online ? 'online' : 'offline'}`, device.id);
    };
    const validateDetails = (data) => {
        check(data && typeof data === 'object' && !Array.isArray(data), 'Invalid device body');
        if (Object.hasOwn(data, 'device_name')) check(typeof data.device_name === 'string' && data.device_name.trim().length > 0 && data.device_name.length <= 120, 'Invalid device_name');
        if (Object.hasOwn(data, 'location')) check(data.location === null || (typeof data.location === 'string' && data.location.length <= 200), 'Invalid location');
    };
    return {
        get, requireEnabled,
        list: async () => (await repository.list()).map((d) => ({ ...d, online: status(d) })),
        async create(data) {
            validateDetails(data);
            deviceCode(data.device_code);
            check(data.device_name && data.mqtt_topic_prefix === `powermeter/${data.device_code}`, 'device_name and canonical mqtt_topic_prefix required');
            const device = await repository.create(data);
            await event('device_registered', 'Device registered', device.id);
            broadcast('device_status', { device_code: device.device_code, online: false, is_enabled: device.is_enabled });
            return { ...device, online: false };
        },
        async update(code, data) {
            validateDetails(data);
            check(Object.keys(data).length > 0 && Object.keys(data).every((k) => ['device_name', 'location'].includes(k)), 'Only device_name and location may be updated');
            await get(code);
            const device = await repository.update(code, data);
            broadcast('device_status', { ...device, online: status(device) });
            return { ...device, online: status(device) };
        },
        async setEnabled(code, data) {
            check(typeof data?.is_enabled === 'boolean', 'is_enabled must be boolean');
            await get(code);
            const device = await repository.setEnabled(code, data.is_enabled);
            if (!data.is_enabled) presence.set(code, { seen: 0, offline: true });
            await event(data.is_enabled ? 'device_enabled' : 'device_disabled', `Device ${data.is_enabled ? 'enabled' : 'disabled'}`, device.id);
            broadcast('device_status', { device_code: code, online: status(device), is_enabled: device.is_enabled });
            return { ...device, online: status(device) };
        },
        async markOnline(code) { await transition(await requireEnabled(code), true); },
        async availability(code, online) {
            const device = await requireEnabled(code);
            if (online) await repository.touch(device.id);
            await transition(device, online);
        },
        async sweep() {
            for (const device of await repository.list()) {
                if (!status(device) && presence.get(device.device_code)?.offline === false) await transition(device, false);
            }
        },
    };
}
