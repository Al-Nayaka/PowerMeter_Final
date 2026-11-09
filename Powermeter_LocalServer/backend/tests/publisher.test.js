import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublisher } from '../src/mqtt/mqttPublisher.js';

test('publication timeout cancels allocated QoS1 replay but reports uncertain delivery', async () => {
    let removed;
    const client = {
        connected: true, outgoing: {},
        publish(topic, payload, options, callback) { this.outgoing[12] = { cb: callback }; },
        removeOutgoingMessage(id) { removed = id; this.outgoing[id].cb(new Error('removed')); delete this.outgoing[id]; },
    };
    const result = await createPublisher(() => client, 10)('topic', { command_id: 'test' });
    assert.equal(result.acknowledged, false);
    assert.equal(removed, 12);
    assert.deepEqual(client.outgoing, {});
});
