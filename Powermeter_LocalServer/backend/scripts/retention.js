import { createPool, fail, isMain, safeError } from './db.js';

export function positiveInteger(value, fallback, max) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(result) || result < 1 || result > max) throw safeError('Retention parameters must be positive bounded integers');
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw safeError('Usage: node scripts/retention.js [--apply]');
  const pool = await createPool();
  try {
    const days = positiveInteger(process.env.RETENTION_DAYS, 30, 36500);
    const batch = positiveInteger(process.env.RETENTION_BATCH_SIZE, 1000, 10000);
    const maxBatches = positiveInteger(process.env.RETENTION_MAX_BATCHES, 10, 1000);
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    // Only measurements are covered; events, relay history and commands are preserved.
    if (!args.includes('--apply')) {
      const result = await pool.query('SELECT id FROM public.measurements WHERE recorded_at < $1 LIMIT $2', [cutoff, batch * maxBatches + 1]);
      console.log(`DRY RUN: ${result.rowCount} candidate(s), capped sample ${batch * maxBatches + 1}; cutoff ${cutoff}; maximum deletion per run ${batch * maxBatches}. No rows deleted.`);
      return;
    }
    let deleted = 0;
    for (let index = 0; index < maxBatches; index++) {
      const result = await pool.query(`WITH expired AS (
        SELECT id FROM public.measurements WHERE recorded_at < $1
        ORDER BY recorded_at, id LIMIT $2 FOR UPDATE SKIP LOCKED
      ) DELETE FROM public.measurements m USING expired e WHERE m.id = e.id`, [cutoff, batch]);
      deleted += result.rowCount;
      if (result.rowCount < batch) break;
    }
    console.log(`Deleted ${deleted} measurement(s) before ${cutoff}; run is bounded, older rows may remain.`);
  } finally {
    await pool.end();
  }
}
if (isMain(import.meta.url)) main().catch(error => fail('Retention', error));
