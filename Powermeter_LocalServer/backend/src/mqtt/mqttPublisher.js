export function createPublisher(getClient, timeoutMs = 5000) {
    return (topic, data) => new Promise((resolve, reject) => {
        const client = getClient();
        if (!client?.connected) return reject(new Error('MQTT unavailable'));
        let settled = false;
        const callback = (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            // Once publish was attempted, a missing PUBACK cannot prove non-delivery.
            resolve({ acknowledged: !error });
        };
        const timer = setTimeout(() => {
            settled = true;
            // MQTT.js exposes allocated QoS1 callbacks in outgoing. Remove only this
            // publication, never unrelated devices' messages. Device expiry is still
            // authoritative: cancellation cannot retract an already transmitted packet.
            for (const [id, message] of Object.entries(client.outgoing || {})) {
                if (message.cb === callback) client.removeOutgoingMessage(Number(id));
            }
            resolve({ acknowledged: false });
        }, timeoutMs);
        try { client.publish(topic, JSON.stringify(data), { qos: 1, retain: false }, callback); }
        catch { clearTimeout(timer); callback(new Error('MQTT publication uncertain')); }
    });
}
