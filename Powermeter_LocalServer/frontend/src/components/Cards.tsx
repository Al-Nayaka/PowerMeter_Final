import { useState } from 'react'
import { energyKwh, formatValue, reactivePower, sampleTime } from '../live-api'
import type { Measurement, RelayState } from '../live-api'

interface RelayProps {
  relay?: RelayState | null
  enabled?: boolean
  pending?: boolean
  error?: string | null
  commandStatus?: string
  onCommand?: (on: boolean, adminKey: string) => Promise<void>
}
export function RelayCard({ relay = null, enabled = false, pending = false, error, commandStatus, onCommand }: RelayProps) {
  // Credentials live only in this mounted session, never browser storage.
  const [adminKey, setAdminKey] = useState('')
  const buttonStyle = { minHeight: 44, border: '1px solid var(--card-border)', borderRadius: 6, padding: '8px 12px', opacity: !enabled || pending || !adminKey.trim() ? 0.6 : 1 }
  return (
    <section className="card relay-card" aria-busy={pending}>
      <div className="relay-head">
        <span className="card-label">Relay 1</span>
        {relay !== null && <button
          type="button"
          className={`toggle${relay.state ? ' is-on' : ''}`}
          role="switch"
          aria-checked={relay.state}
          aria-label={relay.state ? 'Matikan relay 1' : 'Nyalakan relay 1'}
          disabled={!enabled || pending || !adminKey.trim() || !onCommand}
          onClick={() => { void onCommand?.(!relay.state, adminKey) }}
        ><span className="knob" /></button>}
      </div>
      <div className="relay-row row">
        <span className="label">Status terakhir (ACK)</span>
        <strong>{relay === null ? 'Belum diketahui' : relay.state ? 'ON' : 'OFF'}</strong>
      </div>
      {relay?.changed_at && <p className="card-sub">Dikonfirmasi {sampleTime(Date.parse(relay.changed_at))}</p>}
      <label className="card-sub" htmlFor="relay-admin-key">Kunci admin (sesi ini)</label>
      <input id="relay-admin-key" type="password" value={adminKey} autoComplete="off"
        disabled={pending} style={{ width: '100%', minHeight: 44, boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '8px 12px' }}
        onChange={(event) => setAdminKey(event.target.value)} aria-describedby="relay-help" />
      <p id="relay-help" className="card-sub">Kunci tidak disimpan. Perubahan berlaku setelah konfirmasi perangkat.</p>
      {relay === null && <div className="row">
        <button type="button" style={buttonStyle} disabled={!enabled || pending || !adminKey.trim() || !onCommand}
          onClick={() => { void onCommand?.(true, adminKey) }}>Nyalakan</button>
        <button type="button" style={buttonStyle} disabled={!enabled || pending || !adminKey.trim() || !onCommand}
          onClick={() => { void onCommand?.(false, adminKey) }}>Matikan</button>
      </div>}
      {!enabled && <p className="card-sub">Kontrol dinonaktifkan: tunggu koneksi live dan perangkat online.</p>}
      <p className="card-sub" role="status">{pending ? 'Menunggu ACK perangkat…' : commandStatus === 'confirmed' ? 'Perintah dikonfirmasi perangkat.' : ''}</p>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

export function TotalUsageCard({ latest = null }: { latest?: Measurement | null }) {
  const apparent = latest?.voltage != null && latest.current != null ? latest.voltage * latest.current : null
  return (
    <section className="card">
      <span className="card-label">Energi kumulatif meter</span>
      <div className="big-value total-value">{formatValue(energyKwh(latest), 3)}<span className="unit">kWh</span></div>
      <p className="card-sub">Counter Wh perangkat ÷ 1.000; bukan penggunaan hari ini.</p>
      <div className="info-rows">
        <div className="row"><span className="label">Biaya</span><strong>—</strong></div>
        <div className="row"><span className="label">Estimasi sebulan</span><strong>—</strong></div>
        <div className="row"><span className="label">Daya semu (V × A)</span><strong>{formatValue(apparent)} VA</strong></div>
      </div>
      <p className="card-sub">Biaya belum dihitung: tarif dan selisih energi periode belum tersedia.</p>
    </section>
  )
}

export function PowerFactorCard({ latest = null, history = [] }: { latest?: Measurement | null; history?: Measurement[] }) {
  const pf = latest?.power_factor ?? null
  const samples = history.flatMap((row) => row.power_factor === null ? [] : [row.power_factor])
  return (
    <section className="card">
      <span className="card-label">Power factor</span>
      <div className="big-value pf-value">{formatValue(pf)}</div>
      <div className="progress" role="progressbar" aria-valuenow={pf === null ? undefined : pf * 100}
        aria-valuemin={0} aria-valuemax={100} aria-label="Power factor" aria-valuetext={pf === null ? 'Belum tersedia' : formatValue(pf)}>
        <span style={{ width: `${pf === null ? 0 : pf * 100}%` }} />
      </div>
      <p className="pf-note">{pf === null ? 'Belum ada nilai PF dari perangkat.' : pf >= 0.85 ? 'Baik. Idealnya di atas 0,85.' : 'Di bawah 0,85.'}</p>
      <div className="info-rows"><div className="row"><span className="label">Terendah di riwayat tampil</span><strong>{formatValue(samples.length ? Math.min(...samples) : null)}</strong></div></div>
    </section>
  )
}

export function ReactivePowerCard({ latest = null, history = [] }: { latest?: Measurement | null; history?: Measurement[] }) {
  const samples = history.flatMap((row) => { const value = reactivePower(row); return value === null ? [] : [value] })
  return (
    <section className="card">
      <span className="card-label">Daya reaktif (estimasi)</span>
      <div className="big-value reactive-value">{formatValue(reactivePower(latest))}<span className="unit">VAR</span></div>
      <p className="card-desc">Magnitudo dihitung dari daya aktif dan PF valid; bukan pengukuran VAR langsung. Arah induktif/kapasitif tidak diketahui.</p>
      <div className="info-rows"><div className="row"><span className="label">Puncak di riwayat tampil</span><strong>{formatValue(samples.length ? Math.max(...samples) : null)} VAR</strong></div></div>
    </section>
  )
}
