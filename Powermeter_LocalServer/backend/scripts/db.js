import { pathToFileURL } from 'node:url';

export function isMain(metaUrl) {
  return Boolean(process.argv[1]) && metaUrl === pathToFileURL(process.argv[1]).href;
}

export async function createPool() {
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ quiet: true });
  const { default: pg } = await import('pg');
  const env = process.env;
  if (!env.DATABASE_URL && !(env.DB_NAME || env.PGDATABASE)) {
    throw new Error('Set DATABASE_URL or DB_NAME/PGDATABASE');
  }
  const pool = new pg.Pool(env.DATABASE_URL ? { connectionString: env.DATABASE_URL, max: 2 } : {
    host: env.DB_HOST || env.PGHOST || '127.0.0.1',
    port: Number(env.DB_PORT || env.PGPORT || 5432),
    database: env.DB_NAME || env.PGDATABASE,
    user: env.DB_USER || env.PGUSER,
    password: env.DB_PASSWORD || env.PGPASSWORD,
    max: 2,
    connectionTimeoutMillis: 10000,
  });
  pool.on('error', () => console.error('PostgreSQL connection error'));
  return pool;
}

export function fail(operation, error) {
  // Never print driver messages: they can contain connection strings or payloads.
  console.error(`${operation} failed${/^[0-9A-Z]{5}$/.test(error.code || '') ? ` (SQLSTATE ${error.code})` : ''}. Check configuration and database state.`);
  if (error.safeMessage) console.error(error.safeMessage);
  process.exitCode = 1;
}

export function safeError(message) {
  const error = new Error(message);
  error.safeMessage = message;
  return error;
}
