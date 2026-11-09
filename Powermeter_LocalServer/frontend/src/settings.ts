import { meters } from './data.ts'

export interface LocalDevice {
  id: string
  name: string
  location: string
  protocol: 'MQTT' | 'HTTP'
  interval: number
}

export const defaultLimits = { enabled: true, minVoltage: 198, maxVoltage: 231, maxCurrent: 10, maxPower: 2200 }
export const defaultSettings = {
  limits: defaultLimits,
  notifications: { voltage: true, current: true, power: false, device: true, mqtt: true, dashboard: true },
  preferences: { powerUnit: 'W', range: '24h', timeFormat: '24', dateFormat: 'DD/MM/YYYY', exportFormat: 'CSV' },
  connection: { broker: '', topic: '', api: '' },
}
export type LocalSettings = typeof defaultSettings

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0

export function validateLimits(limits: typeof defaultLimits): string {
  if (![limits.minVoltage, limits.maxVoltage, limits.maxCurrent, limits.maxPower].every(positive)) return 'Semua batas harus berupa angka positif.'
  if (limits.minVoltage >= limits.maxVoltage) return 'Tegangan minimum harus lebih kecil dari tegangan maksimum.'
  return ''
}

export function validateDevice(device: LocalDevice, devices: LocalDevice[], originalId?: string): string {
  if (!device.name.trim() || !device.id.trim() || !device.location.trim()) return 'Nama, ID, dan lokasi perangkat wajib diisi.'
  if (!positive(device.interval)) return 'Interval polling harus lebih dari 0 detik.'
  if (devices.some(item => item.id !== originalId && (item.id.toLowerCase() === device.id.trim().toLowerCase() || item.name.toLowerCase() === device.name.trim().toLowerCase()))) return 'ID dan nama perangkat harus unik.'
  return ''
}

export function parseSettings(value: unknown): LocalSettings {
  const result: LocalSettings = structuredClone(defaultSettings)
  if (!object(value)) return result
  if (object(value.limits)) {
    const candidate = { ...result.limits }
    for (const key of ['minVoltage', 'maxVoltage', 'maxCurrent', 'maxPower'] as const) {
      if (positive(value.limits[key])) candidate[key] = value.limits[key]
    }
    if (typeof value.limits.enabled === 'boolean') candidate.enabled = value.limits.enabled
    if (!validateLimits(candidate)) result.limits = candidate
  }
  if (object(value.notifications)) {
    for (const key of Object.keys(result.notifications) as (keyof LocalSettings['notifications'])[]) {
      if (typeof value.notifications[key] === 'boolean') result.notifications[key] = value.notifications[key]
    }
  }
  if (object(value.preferences)) {
    const allowed = { powerUnit: ['W', 'kW'], range: ['1h', '24h', '7d'], timeFormat: ['12', '24'], dateFormat: ['DD/MM/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'], exportFormat: ['CSV'] }
    for (const key of Object.keys(allowed) as (keyof typeof allowed)[]) {
      const entry = value.preferences[key]
      if (typeof entry === 'string' && allowed[key].includes(entry)) result.preferences[key] = entry
    }
  }
  if (object(value.connection)) {
    for (const key of ['broker', 'topic', 'api'] as const) {
      if (typeof value.connection[key] === 'string') result.connection[key] = value.connection[key]
    }
    if (validateConnection(result.connection)) result.connection = { ...defaultSettings.connection }
  }
  return result
}

export function initialDevices(): LocalDevice[] {
  return meters.map((meter, index) => ({ id: `PM-${String(index + 1).padStart(3, '0')}`, name: meter.name, location: index === 0 ? 'Panel Utama' : `Panel ${index + 1}`, protocol: 'MQTT', interval: 2 }))
}

export function parseDevices(value: unknown): LocalDevice[] {
  if (!Array.isArray(value) || !value.length) return initialDevices()
  const result: LocalDevice[] = []
  for (const entry of value) {
    if (!object(entry) || typeof entry.id !== 'string' || typeof entry.name !== 'string' || typeof entry.location !== 'string' || !['MQTT', 'HTTP'].includes(String(entry.protocol)) || !positive(entry.interval)) return initialDevices()
    const device = entry as unknown as LocalDevice
    if (validateDevice(device, result)) return initialDevices()
    result.push({ id: device.id.trim(), name: device.name.trim(), location: device.location.trim(), protocol: device.protocol, interval: device.interval })
  }
  return result
}

export function validateConnection(connection: LocalSettings['connection']): string {
  for (const [key, protocols] of [['broker', ['mqtt:', 'mqtts:', 'ws:', 'wss:']], ['api', ['http:', 'https:']]] as const) {
    if (!connection[key]) continue
    try {
      const url = new URL(connection[key])
      if (!(protocols as readonly string[]).includes(url.protocol) || !url.hostname || url.username || url.password) return 'Gunakan URL yang valid tanpa username atau kata sandi.'
    } catch { return 'URL broker atau API tidak valid.' }
  }
  if ([...connection.topic].some(character => character.charCodeAt(0) < 32 || character === '+' || character === '#')) return 'Topik MQTT tidak boleh berisi karakter kontrol atau wildcard (+, #).'
  return ''
}

export function loadLocal<T>(key: string, parse: (value: unknown) => T): { value: T; error: string } {
  try {
    const raw = localStorage.getItem(key)
    return { value: parse(raw ? JSON.parse(raw) : undefined), error: '' }
  } catch { return { value: parse(undefined), error: 'Data lokal tidak dapat dibaca. Nilai bawaan digunakan.' } }
}

export function saveLocal(key: string, value: unknown): string {
  try { localStorage.setItem(key, JSON.stringify(value)); return '' }
  catch { return 'Penyimpanan lokal tidak tersedia. Perubahan belum tersimpan.' }
}
