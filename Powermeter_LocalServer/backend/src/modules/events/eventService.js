export function eventService(repository, broadcast, logger) {
    return async (type, description, deviceId) => {
        try {
            const event = await repository.insert(type, description, deviceId);
            broadcast('system_event', event);
        } catch (error) {
            logger.error({ event: 'event_storage_failed', code: error.code || 'DATABASE_ERROR' });
        }
    };
}
