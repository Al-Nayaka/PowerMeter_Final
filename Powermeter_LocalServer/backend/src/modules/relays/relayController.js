import { relayBody, uuid } from '../../middleware/validation.js';
export const relayController = (service) => ({
    states: async (req, res) => res.json({ success: true, data: await service.states(req.params.deviceCode) }),
    command: async (req, res) => {
        relayBody(req.body);
        res.status(202).json({ success: true, data: await service.command(req.params.deviceCode, req.body) });
    },
    getCommand: async (req, res) => {
        uuid(req.params.commandId);
        res.json({ success: true, data: await service.getCommand(req.params.deviceCode, req.params.commandId) });
    },
});
