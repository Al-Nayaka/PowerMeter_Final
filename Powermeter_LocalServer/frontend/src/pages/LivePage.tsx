import { ChartCard } from '../components/ChartCard'
import {
  PowerFactorCard,
  ReactivePowerCard,
  RelayCard,
  TotalUsageCard,
} from '../components/Cards'
import { buildLiveCharts, sampleTime } from '../live-api'
import { useLiveMeter } from '../useLiveMeter'

export function LivePage({ meterName, deviceCode }: { meterName: string; deviceCode?: string }) {
  const live = useLiveMeter(deviceCode)
  const charts = buildLiveCharts(live.history, live.latest)
  return (
    <>
      <header className="page-head">
        <h1>{meterName}</h1>
        <p>
          Pengukuran dari perangkat melalui WebSocket; sinkronisasi REST setiap 15 detik.
          Puncak dan lembah berasal dari maksimal 100 sampel terbaru yang ditampilkan.
        </p>
        <p role="status" aria-live="polite">
          {!deviceCode ? 'Pilih perangkat terdaftar untuk memulai pemantauan.' : live.loading ? 'Memuat pengukuran dan status perangkat…'
            : !live.connected ? 'Koneksi live terputus; menyambungkan ulang. Data terakhir tetap ditampilkan.'
              : !live.device ? 'Status perangkat belum diketahui.' : !live.device.is_enabled ? 'Perangkat dinonaktifkan. Data terakhir tetap ditampilkan.'
                : !live.device.online ? 'Perangkat offline. Data terakhir tetap ditampilkan.' : 'Perangkat online · koneksi live aktif.'}
          {live.latest && ` Pengukuran terakhir: ${sampleTime(Date.parse(live.latest.recorded_at))}.`}
        </p>
        {live.error && <p role="alert">{live.error}</p>}
        {deviceCode && !live.loading && !live.latest && !live.error && <p>Belum ada pengukuran untuk perangkat ini. Pastikan perangkat mengirim telemetri.</p>}
        {deviceCode && <button type="button" style={{ minHeight: 44, border: '1px solid var(--card-border)', borderRadius: 6, padding: '8px 12px' }} onClick={live.refresh}>Muat ulang status</button>}
      </header>

      <div className="dashboard">
        <div className="charts-column">
          {charts.map((chart) => (
            <ChartCard key={chart.id} config={chart} />
          ))}
        </div>

        <aside className="side-cards" aria-label="Ringkasan daya">
          <RelayCard key={deviceCode ?? 'none'} relay={live.relay} pending={live.sending}
            enabled={!!live.connected && !!live.device?.online && !!live.device.is_enabled}
            commandStatus={live.command?.status} error={live.commandError} onCommand={live.sendRelay} />
          <TotalUsageCard latest={live.latest} />
          <PowerFactorCard latest={live.latest} history={live.history} />
          <ReactivePowerCard latest={live.latest} history={live.history} />
        </aside>
      </div>
    </>
  )
}
