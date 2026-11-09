import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from './middleware/validation.js';
import { errorHandler } from './middleware/errorHandler.js';
import { deviceRoutes } from './routes/deviceRoutes.js';
import { measurementRoutes } from './routes/measurementRoutes.js';
import { relayRoutes } from './routes/relayRoutes.js';

export function createApp({ config, services, health, logger = console }) {
    const app = express();
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cache-Control', 'no-store');
        const origin = req.get('origin');
        if (origin && !config.allowedOrigins.includes(origin)) return next(new AppError(403, 'Origin not allowed'));
        if (origin) { res.set('Access-Control-Allow-Origin', origin); res.vary('Origin'); }
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Key');
        res.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
    });
    app.use(express.json({ limit: '16kb' }));
    const admin = (req, res, next) => {
        if (!config.adminKey) return next(new AppError(503, 'Administrative access is not configured'));
        const supplied = Buffer.from(req.get('x-admin-key') ? `Bearer ${req.get('x-admin-key')}` : (req.get('authorization') || ''));
        const expected = Buffer.from(`Bearer ${config.adminKey}`);
        if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return next(new AppError(401, 'Administrative authentication required'));
        next();
    };
    app.get('/api/health', async (req, res) => {
        const dependencies = await health();
        const ok = dependencies.database && dependencies.mqtt;
        res.status(ok ? 200 : 503).json({ success: !!ok, status: ok ? 'ok' : 'degraded', dependencies });
    });
    app.use('/api/devices', deviceRoutes(services.devices, admin));
    app.use('/api/measurements', measurementRoutes(services.measurements, config));
    app.use('/api/relays', relayRoutes(services.relays, admin));
    app.use((req, res, next) => next(new AppError(404, 'Endpoint not found')));
    app.use(errorHandler(logger));
    return app;
}
