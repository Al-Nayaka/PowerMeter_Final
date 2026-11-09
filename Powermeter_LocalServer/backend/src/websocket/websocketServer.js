import { WebSocketServer, WebSocket } from 'ws';
import { deviceCode } from '../middleware/validation.js';

export function createRealtime(server, config) {
    const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
    const upgrade = (request, socket, head) => {
        try {
            const url = new URL(request.url, 'http://localhost');
            if (url.pathname !== '/ws') throw new Error();
            if (request.headers.origin && !config.allowedOrigins.includes(request.headers.origin)) throw new Error();
            const code = url.searchParams.get('device_code');
            if (code !== null) deviceCode(code);
            if (wss.clients.size >= 100) throw new Error();
            wss.handleUpgrade(request, socket, head, (ws) => {
                ws.deviceCode = code;
                ws.alive = true;
                ws.on('pong', () => { ws.alive = true; });
                ws.on('error', () => ws.terminate());
                wss.emit('connection', ws, request);
            });
        } catch { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); }
    };
    server.on('upgrade', upgrade);
    const timer = setInterval(() => {
        for (const ws of wss.clients) {
            if (!ws.alive) { ws.terminate(); continue; }
            ws.alive = false;
            ws.ping();
        }
    }, 30000);
    timer.unref();
    return {
        broadcast(type, data) {
            const payload = JSON.stringify({ type, data });
            for (const ws of wss.clients) {
                if (ws.readyState !== WebSocket.OPEN || (ws.deviceCode && ws.deviceCode !== data.device_code)) continue;
                if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); continue; }
                ws.send(payload, (error) => { if (error) ws.terminate(); });
            }
        },
        async close() {
            clearInterval(timer);
            server.off('upgrade', upgrade);
            for (const ws of wss.clients) ws.terminate();
            await new Promise((resolve) => wss.close(resolve));
        },
    };
}
