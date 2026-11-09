import { createPool, fail, isMain, safeError } from './db.js';

async function main() {
  // Require explicit development intent, never infer it from a missing NODE_ENV.
  if (process.env.NODE_ENV !== 'development' || !process.argv.includes('--apply')) {
    throw safeError('Dev seed requires NODE_ENV=development and --apply. It only registers PM-ESP32-001..003.');
  }
  const pool = await createPool();
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    for (let number = 1; number <= 3; number++) {
      const code = `PM-ESP32-${String(number).padStart(3, '0')}`;
      await client.query(`INSERT INTO public.devices (device_code, device_name, location, mqtt_topic_prefix)
        VALUES ($1, $2, $3, $4) ON CONFLICT (device_code) DO NOTHING`,
      [code, `Development meter ${number}`, `Development room ${number}`, `powermeter/${code}`]);
    }
    await client.query('COMMIT');
    console.log('Development devices registered; existing devices left unchanged');
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}
if (isMain(import.meta.url)) main().catch(error => fail('Seed', error));
