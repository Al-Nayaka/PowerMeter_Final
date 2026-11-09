import { randomUUID } from 'node:crypto';
import { isMain, fail, safeError } from './db.js';

export function interval(value, fallback) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 100 || number > 3600000) throw safeError('Simulator intervals must be integers between 100 and 3600000 ms');
  return number;
}

export function measurement(code, boot, sequence, energy, now = new Date()) {
  const voltage = Number((220 + Math.random() * 4).toFixed(2));
  const current = Number((0.8 + Math.random() * 0.4).toFixed(3));
  return {
    device_code: code, message_id: `${boot}-${sequence}`,
    voltage, current, active_power: Number((voltage * current * 0.95).toFixed(2)),
    energy_wh: Number(energy.toFixed(3)), power_factor: 0.95, recorded_at: now.toISOString(),
  };
}

export function createRelaySimulator(code) {
  const recent = new Map();
  let state = false;
  const utc = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
  return {
    get state() { return state; },
    accept(command, retained = false, now = Date.now()) {
      if (retained || !command || command.device_code !== code || command.relay_number !== 1 || typeof command.state !== 'boolean' ||
          typeof command.command_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(command.command_id) ||
          !utc(command.issued_at) || !utc(command.expires_at)) return null;
      const issued = Date.parse(command.issued_at), expires = Date.parse(command.expires_at);
      if (issued > now + 5000 || now - issued > 30000 || expires <= issued || expires - issued > 60000 || now >= expires) return null;
      if (recent.has(command.command_id)) {
        const result = recent.get(command.command_id);
        return result.state === command.state ? result : null;
      }
      state = command.state;
      const result = { command_id: command.command_id, device_code: code, relay_number: 1, state, confirmed_at: new Date(now).toISOString() };
      if (recent.size >= 16) recent.delete(recent.keys().next().value);
      recent.set(command.command_id, result);
      return result;
    },
  };
}

async function main() {
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ quiet: true });
  const { default: mqtt } = await import('mqtt');
  const env = process.env;
  const code = env.SIM_DEVICE_CODE || 'PM-ESP32-001';
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(code)) throw safeError('Invalid SIM_DEVICE_CODE');
  const measurementMs = interval(env.SIM_MEASUREMENT_MS, 1000);
  const heartbeatMs = interval(env.SIM_HEARTBEAT_MS, 15000);
  const prefix = `powermeter/${code}`;
  const boot = randomUUID();
  const relay = createRelaySimulator(code);
  const client = mqtt.connect(env.MQTT_URL || 'mqtt://127.0.0.1:1883', {
    username: env.MQTT_USERNAME, password: env.MQTT_PASSWORD,
    clientId: `sim-${code}-${boot.slice(0, 8)}`, reconnectPeriod: 2000,
    will: { topic: `${prefix}/availability`, payload: JSON.stringify({ device_code: code, status: 'offline' }), qos: 1, retain: true },
  });
  let sequence = 0;
  let energy = 0;
  let lastSample = Date.now();
  let timers = [];
  let stopping = false;
  const publish = (suffix, payload, options = {}) => client.publish(`${prefix}/${suffix}`, JSON.stringify(payload), options, error => {
    if (error) console.error('Simulator publish failed');
  });
  const heartbeat = () => publish('heartbeat', { device_code: code, timestamp: new Date().toISOString() }, { qos: 1 });
  client.on('connect', () => {
    timers.forEach(clearInterval);
    client.subscribe(`${prefix}/relay/command`, { qos: 1 }, error => {
      if (error) console.error('Simulator command subscription failed');
    });
    publish('availability', { device_code: code, status: 'online' }, { qos: 1, retain: true });
    heartbeat();
    lastSample = Date.now();
    timers = [setInterval(() => {
      if (!client.connected) return;
      const now = Date.now();
      const payload = measurement(code, boot, ++sequence, energy);
      energy += payload.active_power * (now - lastSample) / 3600000;
      lastSample = now;
      payload.energy_wh = Number(energy.toFixed(3));
      publish('measurement', payload, { qos: 0 });
    }, measurementMs), setInterval(() => { if (client.connected) heartbeat(); }, heartbeatMs)];
    console.log(`Simulator connected for ${code}; no database registration is performed`);
  });
  client.on('message', (topic, buffer, packet) => {
    if (topic !== `${prefix}/relay/command` || packet.retain) return;
    try {
      const command = JSON.parse(buffer.toString());
      const acknowledgement = relay.accept(command, packet.retain);
      if (acknowledgement) publish('relay/state', acknowledgement, { qos: 1 });
    } catch { console.error('Simulator ignored malformed relay command'); }
  });
  client.on('error', () => console.error('Simulator MQTT connection error; check broker and credentials'));
  client.on('offline', () => { timers.forEach(clearInterval); timers = []; });
  const stop = () => {
    if (stopping) return;
    stopping = true;
    timers.forEach(clearInterval);
    const timeout = setTimeout(() => client.end(true), 3000);
    timeout.unref();
    if (!client.connected) { client.end(true); return; }
    client.publish(`${prefix}/availability`, JSON.stringify({ device_code: code, status: 'offline' }), { qos: 1, retain: true }, () => {
      clearTimeout(timeout);
      client.end();
    });
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
if (isMain(import.meta.url)) main().catch(error => fail('Simulator', error));
