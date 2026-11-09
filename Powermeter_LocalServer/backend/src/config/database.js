import pg from 'pg';

export function createPool(config, logger = console) {
    const pool = new pg.Pool(config.database);
    pool.on('error', () => logger.error({ event: 'database_connection_error' }));
    return pool;
}
