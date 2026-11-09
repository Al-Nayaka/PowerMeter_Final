import type { ChartConfig } from './data'

export interface Measurement {
  id: string
  device_id: string
  device_code: string
  recorded_at: string
  voltage: number | null
  current: number | null
  active_power: number | null
  energy_wh: number | null
  power_factor: number | null
}
export interface RelayState { relay_number: number; state: boolean; changed_at?: string }
export interface RelayCommand {
  command_id: string
  status: 'requested' | 'published' | 'confirmed' | 'failed' | 'timed_out'
  state: boolean
  relay_number: number
  error?: string | null
}
export interface DeviceStatus { online: boolean; is_enabled: boolean }
export interface LiveChart extends ChartConfig { times: number[] }
type RecordValue = Record<string, unknown>
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value)
const numeric = (value: unknown): number | null => {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
const identifier = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? value : typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? String(value) : ''

export function parseMeasurement(value: unknown): Measurement | null {
  if (!record(value) || typeof value.device_code !== 'string' || typeof value.recorded_at !== 'string' || !Number.isFinite(Date.parse(value.recorded_at))) return null
  const id = identifier(value.id)
  const device_id = identifier(value.device_id)
  if (!id || !device_id) return null
  const pf = numeric(value.power_factor)
  return {
    id, device_id, device_code: value.device_code, recorded_at: value.recorded_at,
    voltage: numeric(value.voltage), current: numeric(value.current), active_power: numeric(value.active_power),
    energy_wh: numeric(value.energy_wh), power_factor: pf !== null && pf >= 0 && pf <= 1 ? pf : null,
  }
}
export function parseRelay(value: unknown): RelayState | null {
  if (!record(value) || value.relay_number !== 1 || typeof value.state !== 'boolean') return null
  return { relay_number: 1, state: value.state, changed_at: typeof value.changed_at === 'string' ? value.changed_at : undefined }
}
export function relaySnapshot(previous: RelayState | null, snapshot: RelayState | null, receivedAckDuringRequest: boolean) {
  return receivedAckDuringRequest ? previous : snapshot
}
export function parseCommand(value: unknown): RelayCommand {
  if (!record(value) || typeof value.command_id !== 'string' || typeof value.state !== 'boolean' || value.relay_number !== 1 || !['requested', 'published', 'confirmed', 'failed', 'timed_out'].includes(String(value.status))) throw new Error('Respons perintah relay tidak valid.')
  return value as unknown as RelayCommand
}
export type LiveEvent =
  | { type: 'measurement'; data: Measurement }
  | { type: 'relay_state'; data: RelayState }
  | { type: 'device_status'; data: DeviceStatus }
export function parseLiveEvent(raw: string, code: string): LiveEvent | null {
  try {
    const value: unknown = JSON.parse(raw)
    if (!record(value) || !record(value.data) || value.data.device_code !== code) return null
    if (value.type === 'measurement') { const data = parseMeasurement(value.data); return data ? { type: value.type, data } : null }
    if (value.type === 'relay_state') { const data = parseRelay(value.data); return data ? { type: value.type, data } : null }
    if (value.type === 'device_status' && typeof value.data.online === 'boolean' && typeof value.data.is_enabled === 'boolean') return { type: value.type, data: { online: value.data.online, is_enabled: value.data.is_enabled } }
  } catch { /* Ignore malformed or unrelated realtime packets. */ }
  return null
}
export function mergeMeasurements(previous: Measurement[], incoming: Measurement[], limit = 100): Measurement[] {
  const unique = new Map(previous.map((row) => [row.id, row]))
  for (const row of incoming) unique.set(row.id, row)
  return [...unique.values()].sort((a, b) => Date.parse(a.recorded_at) - Date.parse(b.recorded_at) || (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0)).slice(-limit)
}
export const formatValue = (value: number | null | undefined, digits = 2) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('id-ID', { maximumFractionDigits: digits })
export const sampleTime = (time: number) => new Date(time).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const energyKwh = (row: Measurement | null) => row?.energy_wh == null ? null : row.energy_wh / 1000
export function reactivePower(row: Measurement | null): number | null {
  if (row?.active_power == null || row.active_power < 0 || row.power_factor == null || row.power_factor <= 0 || row.power_factor > 1) return null
  return row.active_power * Math.sqrt(1 / row.power_factor ** 2 - 1)
}
export function buildLiveCharts(history: Measurement[], latest: Measurement | null): LiveChart[] {
  return ([
    { id: 'watt', title: 'Watt', unit: 'W', color: '#F2AC2E', field: 'active_power' },
    { id: 'voltage', title: 'Voltage', unit: 'V', color: '#F0806C', field: 'voltage' },
    { id: 'arus', title: 'Arus', unit: 'A', color: '#6EA2F5', field: 'current' },
  ] as const).map(({ field, ...meta }) => {
    const samples = history.filter((row) => row[field] !== null)
    const data = samples.map((row) => row[field]!)
    const low = data.length ? Math.min(...data) : 0
    const high = data.length ? Math.max(...data) : 1
    const padding = Math.max((high - low) * 0.1, Math.abs(high) * 0.01, 0.01)
    const min = low - padding
    const max = high + padding
    const pill = (label: string, value: number) => {
      const row = samples[data.indexOf(value)]
      return { label, time: row ? sampleTime(Date.parse(row.recorded_at)) : '', value: row ? `${formatValue(value)} ${meta.unit}` : '—' }
    }
    return { ...meta, current: formatValue(latest?.[field]), data, times: samples.map((row) => Date.parse(row.recorded_at)), min, max,
      ticks: Array.from({ length: 4 }, (_, i) => formatValue(max - (max - min) * i / 3)),
      peak: pill(`${meta.title} peak`, high), trough: pill(`${meta.title} lembah`, low) }
  })
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}
export async function apiRequest(path: string, signal: AbortSignal, adminKey?: string, body?: unknown): Promise<unknown> {
  const response = await fetch(path, { signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]), cache: 'no-store', method: body === undefined ? 'GET' : 'POST',
    headers: { ...(adminKey ? { 'X-Admin-Key': adminKey } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok || !record(payload) || payload.success !== true) {
    throw new ApiError(record(payload) && typeof payload.message === 'string' ? payload.message : `Permintaan gagal (HTTP ${response.status}).`, response.status)
  }
  return payload.data
}
export function parseDevice(value: unknown): DeviceStatus {
  if (!record(value) || typeof value.online !== 'boolean' || typeof value.is_enabled !== 'boolean') throw new Error('Respons status perangkat tidak valid.')
  return { online: value.online, is_enabled: value.is_enabled }
}
