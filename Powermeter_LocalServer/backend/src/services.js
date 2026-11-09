import { deviceRepository } from './modules/devices/deviceRepository.js';
import { deviceService } from './modules/devices/deviceService.js';
import { measurementRepository } from './modules/measurements/measurementRepository.js';
import { createIngestionService } from './modules/measurements/ingestionService.js';
import { historyService } from './modules/measurements/historyService.js';
import { relayRepository } from './modules/relays/relayRepository.js';
import { relayService } from './modules/relays/relayService.js';
import { eventRepository } from './modules/events/eventRepository.js';
import { eventService } from './modules/events/eventService.js';

export function createServices({ pool, config, broadcast, publish, isMqttConnected, logger = console }) {
    const deviceRepo = deviceRepository(pool);
    const measurementRepo = measurementRepository(pool);
    const event = eventService(eventRepository(pool), broadcast, logger);
    const devices = deviceService(deviceRepo, { config, event, broadcast });
    const measurements = historyService(measurementRepo, devices);
    const ingest = createIngestionService({ pool, devices: deviceRepo, measurements: measurementRepo, broadcast, markOnline: devices.markOnline });
    const relays = relayService({ pool, repository: relayRepository(pool), devices, config, event, broadcast, publish, isMqttConnected });
    return {
        devices, measurements, relays, event,
        async acceptMessage({ type, code, data }) {
            if (type === 'measurement') return ingest(code, data);
            if (type === 'relay_state') await relays.acknowledge(code, data);
            await devices.availability(code, type !== 'availability' || data.status === 'online');
        },
        async sweep() { await devices.sweep(); await relays.sweep(); },
    };
}
