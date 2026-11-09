import http from 'node:http';
import { createApp } from './app.js';
import { createRealtime } from './websocket/websocketServer.js';
import { createServices } from './services.js';
import { createMqtt } from './mqtt/mqttClient.js';
import { createPublisher } from './mqtt/mqttPublisher.js';

export async function createRuntime({ config, pool, logger = console }) {
    // Fail before opening listeners if the approved schema has not been installed.
    await pool.query('SELECT device_name, mqtt_topic_prefix, is_enabled FROM devices LIMIT 0');
    await pool.query('SELECT message_id, received_at FROM measurements LIMIT 0');
    await pool.query('SELECT command_id, status, error FROM relay_commands LIMIT 0');
    const server = http.createServer();
    server.requestTimeout = 15000;
    server.headersTimeout = 10000;
    const realtime = createRealtime(server, config);
    let mqttConnection;
    const services = createServices({ pool, config, logger, broadcast: realtime.broadcast, publish: createPublisher(() => mqttConnection?.client), isMqttConnected: () => !!mqttConnection?.isConnected() });
    const health = async () => {
        let database = false;
        try { await pool.query('SELECT 1'); database = true; } catch { /* Report degraded without leaking connection details. */ }
        return { database, mqtt: !!mqttConnection?.isConnected() };
    };
    server.on('request', createApp({ config, services, health, logger }));
    let timer;
    let sweeping = false;
    let sweepPromise = Promise.resolve();
    let closePromise;
    return {
        server, services,
        get mqtt() { return mqttConnection; },
        async start() {
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen(config.port, config.host, () => { server.off('error', reject); resolve(); });
            });
            mqttConnection = createMqtt({ config, services, logger });
            timer = setInterval(() => {
                if (sweeping) return;
                sweeping = true;
                sweepPromise = services.sweep().catch(() => logger.error({ event: 'maintenance_failed' })).finally(() => { sweeping = false; });
            }, 1000);
            timer.unref();
            logger.info({ event: 'server_started', port: server.address().port });
        },
        close() {
            closePromise ??= (async () => {
                clearInterval(timer);
                // Stop accepting HTTP work before draining MQTT and closing the pool.
                const stopped = new Promise((resolve) => { if (server.listening) server.close(resolve); else resolve(); });
                await realtime.close();
                await stopped;
                if (mqttConnection) await mqttConnection.close();
                await sweepPromise;
                await pool.end();
                logger.info({ event: 'server_stopped' });
            })();
            return closePromise;
        },
    };
}
