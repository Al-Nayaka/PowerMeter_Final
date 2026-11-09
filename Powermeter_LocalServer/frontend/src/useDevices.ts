import { useEffect, useState } from 'react'
import { parseDevices } from './devices'
import type { Device } from './devices'

export function useDevices() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [health, setHealth] = useState(false)

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController
    const refresh = async () => {
      controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      try {
        const [deviceResponse, healthResponse] = await Promise.all([
          fetch('/api/devices', { signal: controller.signal }),
          fetch('/api/health', { signal: controller.signal }),
        ])
        if (!deviceResponse.ok) throw new Error('Daftar perangkat tidak dapat dimuat dari backend.')
        const body = await deviceResponse.json()
        if (body.success !== true) throw new Error('Backend menolak permintaan daftar perangkat.')
        const next = parseDevices(body.data)
        const status = await healthResponse.json()
        if (!stopped) {
          setDevices(next)
          setHealth(healthResponse.ok && status.dependencies?.database === true && status.dependencies?.mqtt === true)
          setError('')
        }
      } catch {
        if (!stopped) {
          setHealth(false)
          setDevices((current) => current.map((device) => ({ ...device, online: false })))
          setError('Koneksi backend gagal. Mencoba lagi otomatis; periksa service backend dan jaringan.')
        }
      } finally {
        clearTimeout(timeout)
        if (!stopped) {
          setLoading(false)
          timer = setTimeout(refresh, 5000)
        }
      }
    }
    void refresh()
    return () => { stopped = true; clearTimeout(timer); controller?.abort() }
  }, [])

  return { devices, loading, error, health }
}
