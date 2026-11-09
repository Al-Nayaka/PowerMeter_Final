import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ApiError, apiRequest, buildLiveCharts, mergeMeasurements, parseMeasurement, parseLiveEvent, reactivePower, energyKwh, parseRelay, parseCommand, relaySnapshot } from './live-api.ts'

const row = (changes: Record<string, unknown> = {}) => ({
  id: '9007199254740993', device_id: '9007199254740995', device_code: 'PM-01',
  recorded_at: '2026-11-09T01:00:00.000Z', voltage: '220.5', current: '2',
  active_power: '352.8', energy_wh: '12345', power_factor: '0.8', ...changes,
})

test('parses PostgreSQL numerics without rounding bigint identifiers or making missing values zero', () => {
  const value = parseMeasurement(row({ current: null, voltage: '', power_factor: null }))!
  assert.equal(value.id, '9007199254740993')
  assert.equal(value.device_id, '9007199254740995')
  assert.equal(value.current, null)
  assert.equal(value.voltage, null)
  assert.equal(value.power_factor, null)
  assert.equal(value.active_power, 352.8)
  assert.equal(parseMeasurement(row({ recorded_at: 'bad' })), null)
  assert.equal(parseMeasurement(row({ id: 9007199254740992 })), null)
  assert.equal(parseMeasurement(row({ id: 'not-a-numeric-id' })), null)
})

test('history is ascending, deduplicated by exact ID and latest is not regressed by late data', () => {
  const a = parseMeasurement(row())!
  const b = parseMeasurement(row({ id: '9007199254740994', recorded_at: '2026-11-09T01:00:10Z', active_power: '500' }))!
  const rows = mergeMeasurements([b, a], [a])
  assert.deepEqual(rows.map((v) => v.id), [a.id, b.id])
  const charts = buildLiveCharts(rows, b)
  assert.deepEqual(charts[0].data, [352.8, 500])
  assert.equal(charts[0].current, '500')
  assert.equal(charts[0].times[1], Date.parse(b.recorded_at))
  assert.ok(charts[0].min < 352.8 && charts[0].max > 500)
})

test('empty and single-value charts do not invent samples or invalid ranges', () => {
  assert.deepEqual(buildLiveCharts([], null)[0].data, [])
  assert.equal(buildLiveCharts([], null)[0].current, '—')
  const a = parseMeasurement(row({ active_power: '0' }))!
  const chart = buildLiveCharts([a], a)[0]
  assert.deepEqual(chart.data, [0])
  assert.ok(chart.max > chart.min)
})

test('energy is a cumulative counter converted once; reactive estimate requires valid active power and PF', () => {
  const a = parseMeasurement(row())!
  assert.equal(energyKwh(a), 12.345)
  assert.ok(Math.abs(reactivePower(a)! - 264.6) < 0.001)
  for (const pf of [null, 0, -0.2, 1.2]) assert.equal(reactivePower({ ...a, power_factor: pf }), null)
})

test('realtime events are filtered by device, malformed packets ignored and relay state must be boolean', () => {
  assert.equal(parseLiveEvent(JSON.stringify({ type: 'measurement', data: row() }), 'PM-02'), null)
  assert.equal(parseLiveEvent('not JSON', 'PM-01'), null)
  assert.equal(parseRelay({ relay_number: 1, state: 'false' }), null)
  assert.equal(parseLiveEvent(JSON.stringify({ type: 'measurement', data: row() }), 'PM-01')?.type, 'measurement')
  assert.equal(parseRelay({ relay_number: 1, state: false })?.state, false)
})

test('unknown relay is distinct from OFF, and a published command is not an ACK', () => {
  assert.equal(parseRelay({ relay_number: 1, state: null }), null)
  const command = parseCommand({ command_id: 'test-command', relay_number: 1, state: true, status: 'published' })
  assert.equal(command.status, 'published')
  assert.throws(() => parseCommand({ ...command, status: 'success' }), /tidak valid/)
  assert.equal(parseLiveEvent(JSON.stringify({ type: 'device_status', data: { device_code: 'PM-01', online: false, is_enabled: true } }), 'PM-01')?.type, 'device_status')
})

test('relay snapshots follow backend insertion order, not a regressing device clock', () => {
  const previous = parseRelay({ relay_number: 1, state: true, changed_at: '2026-11-09T10:00:00Z' })!
  const snapshot = parseRelay({ relay_number: 1, state: false, changed_at: '2026-11-09T09:59:59Z' })!
  assert.equal(relaySnapshot(previous, snapshot, false), snapshot)
  assert.equal(relaySnapshot(previous, snapshot, true), previous)
  assert.equal(relaySnapshot(previous, null, false), null)
})

test('REST control sends the explicit command with session key; reads omit credentials and server errors surface', async (context) => {
  const calls: { path: string; init?: RequestInit }[] = []
  context.mock.method(globalThis, 'fetch', async (path: string, init?: RequestInit) => {
    calls.push({ path, init })
    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })
  })
  const signal = new AbortController().signal
  await apiRequest('/api/relays/PM-01', signal)
  await apiRequest('/api/relays/PM-01/commands', signal, 'session-only-key', { relay_number: 1, state: false })
  assert.equal(calls[0].init?.method, 'GET')
  assert.equal(new Headers(calls[0].init?.headers).has('X-Admin-Key'), false)
  assert.equal(calls[1].init?.method, 'POST')
  assert.equal(new Headers(calls[1].init?.headers).get('X-Admin-Key'), 'session-only-key')
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), { relay_number: 1, state: false })
  assert.equal(calls[1].path.includes('session-only-key'), false)
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ success: false, message: 'Administrative authentication required' }), { status: 401 }))
  await assert.rejects(apiRequest('/api/relays/PM-01/commands/test', signal, 'wrong-key'), (error: unknown) => error instanceof ApiError && error.status === 401 && error.message === 'Administrative authentication required')
})
