import { Router } from 'express';
import { deviceCode } from '../middleware/validation.js';
import { relayController } from '../modules/relays/relayController.js';
export function relayRoutes(service, admin) {
    const router = Router();
    const controller = relayController(service);
    router.param('deviceCode', (req, res, next, value) => { try { deviceCode(value); next(); } catch (e) { next(e); } });
    router.get('/:deviceCode', controller.states);
    router.get('/:deviceCode/commands/:commandId', controller.getCommand);
    router.post('/:deviceCode/commands', controller.command);
    return router;
}
