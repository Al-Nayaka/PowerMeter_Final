import { ChartCard } from '../components/ChartCard'
import {
  PowerFactorCard,
  ReactivePowerCard,
  RelayCard,
  TotalUsageCard,
} from '../components/Cards'
import { charts } from '../data'

export function LivePage({ meterName }: { meterName: string }) {
  return (
    <>
      <header className="page-head">
        <h1>{meterName}</h1>
        <p>
          Data langsung diperbarui setiap 2 detik. Puncak dan lembah dihitung
          sejak halaman dibuka.
        </p>
      </header>

      <div className="dashboard">
        <div className="charts-column">
          {charts.map((chart) => (
            <ChartCard key={chart.id} config={chart} />
          ))}
        </div>

        <aside className="side-cards" aria-label="Ringkasan daya">
          <RelayCard />
          <TotalUsageCard />
          <PowerFactorCard />
          <ReactivePowerCard />
        </aside>
      </div>
    </>
  )
}
