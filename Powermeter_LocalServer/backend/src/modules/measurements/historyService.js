import { AppError } from '../../middleware/validation.js';
export const historyService = (repository, devices) => ({
    async latest(code) {
        const device = await devices.get(code);
        const row = await repository.latest(device.id);
        if (!row) throw new AppError(404, 'No measurements for this device');
        return { ...row, device_code: code };
    },
    async history(code, query) {
        const device = await devices.get(code);
        return (await repository.history(device.id, query)).map((row) => ({ ...row, device_code: code }));
    },
});
