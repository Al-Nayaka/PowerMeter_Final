export const deviceController = (service) => ({
    list: async (req, res) => res.json({ success: true, data: await service.list() }),
    get: async (req, res) => res.json({ success: true, data: await service.get(req.params.deviceCode) }),
    create: async (req, res) => res.status(201).json({ success: true, data: await service.create(req.body) }),
    update: async (req, res) => res.json({ success: true, data: await service.update(req.params.deviceCode, req.body) }),
    status: async (req, res) => res.json({ success: true, data: await service.setEnabled(req.params.deviceCode, req.body) }),
});
