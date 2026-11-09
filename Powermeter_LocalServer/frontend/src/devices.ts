export interface Device {
  id: string
  name: string
  online: boolean
  enabled: boolean
}

export function parseDevices(data: unknown): Device[] {
  if (!Array.isArray(data)) throw new Error('Daftar perangkat dari server tidak valid.')
  return data.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Data perangkat tidak valid.')
    const item = row as Record<string, unknown>
    if (typeof item.device_code !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(item.device_code)
      || typeof item.device_name !== 'string' || !item.device_name.trim()) {
      throw new Error('Identitas perangkat dari server tidak valid.')
    }
    return { id: item.device_code, name: item.device_name, online: item.online === true && item.is_enabled === true, enabled: item.is_enabled === true }
  })
}

export function selectedDevice(devices: Device[], id: string): Device | undefined {
  return devices.find((device) => device.id === id) ?? devices[0]
}
