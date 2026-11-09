import { Router } from 'express';
import { deviceController } from '../modules/devices/deviceController.js';
import { deviceCode } from '../middleware/validation.js';
export function deviceRoutes(service, admin) {
    const router = Router();
    const controller = deviceController(service);
    router.param('deviceCode', (req, res, next, value) => { try { deviceCode(value); next(); } catch (e) { next(e); } });
    router.get('/', controller.list);
    router.get('/:deviceCode', controller.get);
    router.post('/', admin, controller.create);
    router.patch('/:deviceCode', admin, controller.update);
    router.patch('/:deviceCode/status', admin, controller.status);
    return router;
}
