import { Router } from 'express';
import { deviceCode } from '../middleware/validation.js';
import { measurementController } from '../modules/measurements/measurementController.js';
export function measurementRoutes(service, config) {
    const router = Router();
    const controller = measurementController(service, config);
    router.param('deviceCode', (req, res, next, value) => { try { deviceCode(value); next(); } catch (e) { next(e); } });
    router.get('/latest/:deviceCode', controller.latest);
    router.get('/history/:deviceCode', controller.history);
    return router;
}
