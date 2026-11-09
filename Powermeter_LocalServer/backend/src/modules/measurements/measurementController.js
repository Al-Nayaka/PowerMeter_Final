import { check, timestamp } from '../../middleware/validation.js';
export const measurementController = (service, config) => ({
    latest: async (req, res) => res.json({ success: true, data: await service.latest(req.params.deviceCode) }),
    history: async (req, res) => {
        const { limit = '100', from, to } = req.query;
        check(typeof limit === 'string' && /^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= config.historyMaxLimit, `limit must be 1..${config.historyMaxLimit}`);
        if (from !== undefined) timestamp(from, 'from');
        if (to !== undefined) timestamp(to, 'to');
        if (from && to) check(Date.parse(from) <= Date.parse(to), 'from must not be after to');
        res.json({ success: true, data: await service.history(req.params.deviceCode, { limit: Number(limit), from, to }) });
    },
});
