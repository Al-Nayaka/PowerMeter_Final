import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { createPool, fail, isMain, safeError } from './db.js';

const LOCK = 746932801;
export const checksum = sql => createHash('sha256').update(sql).digest('hex');

export function planMigrations(files, applied) {
  const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name));
  for (const row of applied) {
    const file = sorted.find(file => file.name === row.name);
    if (!file) throw safeError('Applied migration missing from local files');
    if (checksum(file.sql) !== row.checksum) throw safeError('Applied migration checksum mismatch; restore the original file');
  }
  const names = new Set(applied.map(row => row.name));
  let pendingSeen = false;
  for (const file of sorted) {
    if (!names.has(file.name)) pendingSeen = true;
    else if (pendingSeen) throw safeError('Migration order is inconsistent');
  }
  return sorted.filter(file => !names.has(file.name));
}

export async function runMigrations(client, files) {
  await client.query('SELECT pg_advisory_lock($1)', [LOCK]);
  try {
    await client.query("SET search_path TO public");
    const tables = await client.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
    const tracked = tables.rows.some(row => row.tablename === 'schema_migrations');
    if (!tracked && tables.rows.length) throw safeError('Untracked existing public tables: refusing schema adoption. Use a fresh database or reviewed reconciliation plan.');
    const applied = tracked ? (await client.query('SELECT name, checksum FROM public.schema_migrations ORDER BY name')).rows : [];
    if (tracked && !applied.length && tables.rows.some(row => row.tablename !== 'schema_migrations')) {
      throw safeError('Untracked existing application tables with empty migration history');
    }
    const pending = planMigrations(files, applied);
    for (const file of pending) {
      await client.query('BEGIN');
      try {
        await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
          name TEXT PRIMARY KEY, checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        await client.query(file.sql);
        await client.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)', [file.name, checksum(file.sql)]);
        await client.query('COMMIT');
        console.log(`Applied ${file.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
    return pending.length;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK]);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--apply', '--approve-enhancements'].includes(arg))) throw safeError('Usage: node scripts/migrate.js [--apply] [--approve-enhancements]');
  const dir = new URL('../migrations/', import.meta.url);
  const names = (await readdir(dir)).filter(name => /^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
  const files = await Promise.all(names.map(async name => ({ name, sql: await readFile(new URL(name, dir), 'utf8') })));
  const selected = args.includes('--approve-enhancements') ? files : files.filter(file => file.name.startsWith('001_'));
  if (!args.includes('--apply')) {
    console.log(`Local preview only; no database connection. Selected: ${selected.map(file => file.name).join(', ')}. Use --apply to execute; --approve-enhancements includes 002.`);
    return;
  }
  const pool = await createPool();
  let client;
  try {
    client = await pool.connect();
    // Validate already-applied enhancements too, even when approval is not repeated.
    if (!args.includes('--approve-enhancements')) {
      const history = await client.query("SELECT to_regclass('public.schema_migrations') AS relation");
      if (history.rows[0]?.relation) {
        const applied = await client.query('SELECT name, checksum FROM public.schema_migrations');
        planMigrations(files, applied.rows);
        for (const file of files) if (applied.rows.some(row => row.name === file.name) && !selected.includes(file)) selected.push(file);
      }
    }
    console.log(`${await runMigrations(client, selected)} migration(s) applied`);
  } finally {
    client?.release();
    await pool.end();
  }
}

if (isMain(import.meta.url)) main().catch(error => fail('Migration', error));
