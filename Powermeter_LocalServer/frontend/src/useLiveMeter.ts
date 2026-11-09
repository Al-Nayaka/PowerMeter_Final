import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiRequest, mergeMeasurements, parseCommand, parseDevice, parseLiveEvent, parseMeasurement, parseRelay, relaySnapshot } from './live-api'
import type { DeviceStatus, Measurement, RelayCommand, RelayState } from './live-api'

interface LiveState {
  code?: string
  latest: Measurement | null
  history: Measurement[]
  relay: RelayState | null
  device: DeviceStatus | null
  loading: boolean
  error: string | null
  connected: boolean
}
const initialState = (code?: string): LiveState => ({ code, latest: null, history: [], relay: null, device: null, loading: !!code, error: null, connected: false })
const message = (error: unknown) => error instanceof Error ? error.message : 'Permintaan gagal. Coba lagi.'

export function useLiveMeter(deviceCode?: string) {
  const [state, setState] = useState<LiveState>(() => initialState(deviceCode))
  const [command, setCommand] = useState<RelayCommand | null>(null)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const refreshRef = useRef<() => void>(() => {})
  const sessionRef = useRef<{ code: string; controller: AbortController; busy: boolean; relayRevision: number } | null>(null)

  // Clear the previous device before it can render under the newly selected name.
  if (state.code !== deviceCode) {
    setState(initialState(deviceCode))
    setCommand(null)
    setCommandError(null)
    setSending(false)
  }

  useEffect(() => {
    if (!deviceCode) { refreshRef.current = () => {}; return }
    const controller = new AbortController()
    const session = { code: deviceCode, controller, busy: false, relayRevision: 0 }
    sessionRef.current = session
    const code = encodeURIComponent(deviceCode)
    let socket: WebSocket | undefined
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let retry = 1000
    let sequence = 0
    const refresh = async () => {
      const request = ++sequence
      const relayRevision = session.relayRevision
      const results = await Promise.allSettled([
        apiRequest(`/api/measurements/latest/${code}`, controller.signal).catch((error: unknown) => {
          if (error instanceof ApiError && error.status === 404 && error.message === 'No measurements for this device') return null
          throw error
        }),
        apiRequest(`/api/measurements/history/${code}?limit=100`, controller.signal),
        apiRequest(`/api/relays/${code}`, controller.signal),
        apiRequest(`/api/devices/${code}`, controller.signal),
      ])
      if (controller.signal.aborted || request !== sequence) return
      setState((previous) => {
        const next = { ...previous, loading: false }
        const errors: string[] = []
        const labels = ['Pengukuran terbaru', 'Riwayat', 'Status relay', 'Status perangkat']
        results.forEach((result, index) => {
          if (result.status === 'rejected') { errors.push(`${labels[index]}: ${message(result.reason)}`); return }
          try {
            if (index === 0) {
              const latest = result.value === null ? null : parseMeasurement(result.value)
              if (result.value !== null && !latest) throw new Error('Respons pengukuran tidak valid.')
              if (latest && latest.device_code !== deviceCode) throw new Error('Respons berasal dari perangkat berbeda.')
              if (latest?.device_code === deviceCode) next.history = mergeMeasurements(next.history, [latest])
            } else if (index === 1) {
              if (!Array.isArray(result.value)) throw new Error('Respons riwayat tidak valid.')
              const rows = result.value.map(parseMeasurement)
              if (rows.some((row) => !row || row.device_code !== deviceCode)) throw new Error('Respons riwayat tidak valid.')
              next.history = mergeMeasurements(next.history, rows as Measurement[])
            } else if (index === 2) {
              if (!Array.isArray(result.value)) throw new Error('Respons relay tidak valid.')
              const relay = result.value.find((row: { relay_number?: number }) => row.relay_number === 1)
              const parsed = relay ? parseRelay(relay) : null
              if (relay && !parsed) throw new Error('Respons relay tidak valid.')
              // A websocket ACK received during this request must not be replaced by an older snapshot.
              next.relay = relaySnapshot(next.relay, parsed, relayRevision !== session.relayRevision)
            } else next.device = parseDevice(result.value)
          } catch (error) { errors.push(`${labels[index]}: ${message(error)}`) }
        })
        next.latest = next.history.at(-1) ?? null
        next.error = errors.length ? errors.join(' ') : null
        return next
      })
    }
    refreshRef.current = () => { void refresh() }
    const connect = () => {
      if (controller.signal.aborted) return
      const url = new URL('/ws', window.location.href)
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
      url.searchParams.set('device_code', deviceCode)
      socket = new WebSocket(url)
      socket.onopen = () => {
        retry = 1000
        setState((previous) => ({ ...previous, connected: true }))
        void refresh()
      }
      socket.onmessage = (event) => {
        if (controller.signal.aborted || typeof event.data !== 'string') return
        const packet = parseLiveEvent(event.data, deviceCode)
        if (!packet) return
        if (packet.type === 'relay_state') session.relayRevision++
        setState((previous) => {
          if (packet.type === 'measurement') {
            const history = mergeMeasurements(previous.history, [packet.data])
            return { ...previous, history, latest: history.at(-1) ?? null }
          }
          if (packet.type === 'relay_state') return { ...previous, relay: packet.data }
          return { ...previous, device: packet.data }
        })
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        if (controller.signal.aborted) return
        setState((previous) => ({ ...previous, connected: false }))
        reconnectTimer = setTimeout(connect, retry)
        retry = Math.min(retry * 2, 15000)
      }
    }
    void refresh()
    connect()
    const fallback = setInterval(() => { void refresh() }, 15000)
    return () => {
      controller.abort()
      sessionRef.current = null
      refreshRef.current = () => {}
      clearInterval(fallback)
      clearTimeout(reconnectTimer)
      if (socket) { socket.onopen = null; socket.onclose = null; socket.onerror = null; socket.onmessage = null; socket.close() }
    }
  }, [deviceCode])

  const sendRelay = useCallback(async (on: boolean, adminKey: string) => {
    const session = sessionRef.current
    if (!session || session.busy || !adminKey.trim()) return
    session.busy = true
    setSending(true)
    setCommand(null)
    setCommandError(null)
    const { signal } = session.controller
    const code = encodeURIComponent(session.code)
    try {
      let result = parseCommand(await apiRequest(`/api/relays/${code}/commands`, signal, adminKey, { relay_number: 1, state: on }))
      if (signal.aborted) return
      setCommand(result)
      const deadline = Date.now() + 120000
      while (result.status === 'requested' || result.status === 'published') {
        if (Date.now() >= deadline) throw new Error('Konfirmasi relay belum diterima. Status hardware belum diketahui; periksa koneksi sebelum mencoba lagi.')
        await new Promise<void>((resolve, reject) => {
          const aborted = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }
          const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve() }, 1000)
          signal.addEventListener('abort', aborted, { once: true })
          if (signal.aborted) aborted()
        })
        result = parseCommand(await apiRequest(`/api/relays/${code}/commands/${encodeURIComponent(result.command_id)}`, signal, adminKey))
        if (signal.aborted) return
        setCommand(result)
      }
      if (result.status !== 'confirmed') throw new Error(result.error || `Perintah relay ${result.status}. Status terakhir tetap ditampilkan.`)
      // A historical command ACK may precede another operator's command; reload the latest relay row.
      refreshRef.current()
    } catch (error) {
      if (!signal.aborted) setCommandError(`${message(error)} Muat ulang status; jangan anggap relay telah berubah.`)
    } finally {
      if (!signal.aborted) { session.busy = false; setSending(false) }
    }
  }, [])
  const visible = state.code === deviceCode ? state : initialState(deviceCode)
  return { ...visible, command, commandError, sending, sendRelay, refresh: () => refreshRef.current() }
}
