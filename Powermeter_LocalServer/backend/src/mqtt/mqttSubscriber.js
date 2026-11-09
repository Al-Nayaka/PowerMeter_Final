import { parseMessage } from './topicHandler.js';

export const topics = ['measurement', 'heartbeat', 'availability', 'relay/state'].map((type) => `powermeter/+/${type}`);
export function createSubscriber({ config, services, logger }) {
    let tail = Promise.resolve();
    let pending = 0;
    let lastRejection = 0;
    let stopping = false;
    const reject = async () => {
        // Invalid or hostile traffic must not turn into an unbounded event log.
        if (Date.now() - lastRejection < 10000) return;
        lastRejection = Date.now();
        logger.error({ event: 'mqtt_message_rejected' });
        await services.event('invalid_payload', 'MQTT payload rejected; check topic, registration, enabled status and numeric/timestamp fields');
    };
    return {
        receive(topic, payload, packet) {
            if (stopping) return;
            if (pending >= config.maxPendingMessages || payload.length > config.maxPayloadBytes) { void reject().catch(() => {}); return; }
            pending++;
            tail = tail.then(async () => {
                try {
                    const message = parseMessage(topic, payload, config.maxPayloadBytes);
                    if (packet?.retain && !(message.type === 'availability' && message.data.status === 'offline')) return;
                    await services.acceptMessage(message);
                } catch { await reject(); }
            }).catch(() => logger.error({ event: 'mqtt_processing_error' })).finally(() => { pending--; });
        },
        idle: () => tail,
        async stop() { stopping = true; await tail; },
    };
}
