import mqtt from 'mqtt';
import { mqttOptions } from '../config/mqtt.js';
import { createSubscriber, topics } from './mqttSubscriber.js';

export function createMqtt({ config, services, logger = console }) {
    const subscriber = createSubscriber({ config, services, logger });
    const client = mqtt.connect(config.mqttUrl, mqttOptions(config));
    let connected = false;
    let resolveReady;
    const ready = new Promise((resolve) => { resolveReady = resolve; });
    client.on('connect', () => {
        client.subscribe(topics, { qos: 1 }, (error, granted) => {
            if (error || granted?.some((item) => item.qos === 128)) { logger.error({ event: 'mqtt_subscribe_failed' }); return; }
            connected = true;
            logger.info({ event: 'mqtt_connected' });
            void services.event('mqtt_connected', 'MQTT connection and subscriptions ready');
            resolveReady();
        });
    });
    client.on('message', subscriber.receive);
    const disconnected = () => {
        if (connected) void services.event('mqtt_disconnected', 'MQTT connection lost');
        connected = false;
    };
    client.on('offline', disconnected);
    client.on('close', disconnected);
    client.on('error', () => logger.error({ event: 'mqtt_connection_error' }));
    return {
        client, ready, idle: subscriber.idle,
        isConnected: () => connected && client.connected,
        async close() { await subscriber.stop(); connected = false; await client.endAsync(true); },
    };
}
