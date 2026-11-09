import test from 'node:test';
import assert from 'node:assert/strict';
import { checksum, planMigrations, runMigrations } from './migrate.js';

const files = [{ name: '001_core.sql', sql: 'CREATE TABLE devices(id bigint);' }];
test('plans new migrations and accepts exact tracked checksums', () => {
  assert.deepEqual(planMigrations(files, []), files);
  assert.deepEqual(planMigrations(files, [{ name: files[0].name, checksum: checksum(files[0].sql) }]), []);
});
test('rejects modified, missing and out-of-order migrations', () => {
  assert.throws(() => planMigrations(files, [{ name: files[0].name, checksum: 'changed' }]), /checksum/);
  assert.throws(() => planMigrations(files, [{ name: '002_missing.sql', checksum: 'x' }]), /missing/);
  assert.throws(() => planMigrations([...files, { name: '002_extra.sql', sql: 'SELECT 1' }],
    [{ name: '002_extra.sql', checksum: checksum('SELECT 1') }]), /order/);
});
test('refuses untracked application tables and always releases lock', async () => {
  const calls = [];
  const client = { query: async (sql) => {
    calls.push(sql);
    if (sql.includes('pg_catalog.pg_tables')) return { rows: [{ tablename: 'devices' }] };
    return { rows: [] };
  } };
  await assert.rejects(runMigrations(client, files), /Untracked/);
  assert.equal(calls.some(sql => sql.includes('CREATE TABLE')), false);
  assert.equal(calls.at(-1), 'SELECT pg_advisory_unlock($1)');
});
test('rolls back failed migration without recording success', async () => {
  const calls = [];
  const client = { query: async (sql) => {
    calls.push(sql);
    if (sql === files[0].sql) throw new Error('SQL failed');
    return { rows: [] };
  } };
  await assert.rejects(runMigrations(client, files), /SQL failed/);
  assert.ok(calls.includes('ROLLBACK'));
  assert.equal(calls.some(sql => sql.startsWith('INSERT INTO public.schema_migrations')), false);
});

test('commits SQL and checksum together, then skips exact applied history', async () => {
  const calls = [];
  const client = { query: async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [] };
  } };
  assert.equal(await runMigrations(client, files), 1);
  const insert = calls.findIndex(call => call.sql.startsWith('INSERT INTO public.schema_migrations'));
  assert.deepEqual(calls[insert].params, [files[0].name, checksum(files[0].sql)]);
  assert.equal(calls[insert - 1].sql, files[0].sql);
  assert.equal(calls[insert + 1].sql, 'COMMIT');
  const secondCalls = [];
  const trackedClient = { query: async sql => {
    secondCalls.push(sql);
    if (sql.includes('pg_catalog.pg_tables')) return { rows: [{ tablename: 'schema_migrations' }, { tablename: 'devices' }] };
    if (sql.startsWith('SELECT name')) return { rows: [{ name: files[0].name, checksum: checksum(files[0].sql) }] };
    return { rows: [] };
  } };
  assert.equal(await runMigrations(trackedClient, files), 0);
  assert.equal(secondCalls.includes('BEGIN'), false);
});

test('empty tracking table does not authorize adoption of existing tables', async () => {
  const client = { query: async sql => ({ rows: sql.includes('pg_catalog.pg_tables')
    ? [{ tablename: 'schema_migrations' }, { tablename: 'devices' }] : [] }) };
  await assert.rejects(runMigrations(client, files), /Untracked/);
});
