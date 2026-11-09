import { useState } from 'react'
import { ArrowLeftRight, ChevronDown } from 'lucide-react'
import { ComparisonChart } from '../components/ComparisonChart'
import {
  compareMetrics,
  comparisonSeries,
  meterSummaries,
  meters,
  type CompareMetricId,
} from '../data'

type RangeId = 'live' | '1h' | '24h' | '7d'

const ranges: Array<{ id: RangeId; label: string; xLabels: string[] }> = [
  {
    id: 'live',
    label: 'Live',
    xLabels: ['120 s', '90 s', '60 s', '30 s', 'sekarang'],
  },
  {
    id: '1h',
    label: '1 jam',
    xLabels: ['60 mnt', '45 mnt', '30 mnt', '15 mnt', 'sekarang'],
  },
  {
    id: '24h',
    label: '24 jam',
    xLabels: ['24 jam', '18 jam', '12 jam', '6 jam', 'sekarang'],
  },
  {
    id: '7d',
    label: '7 hari',
    xLabels: ['7 hari', '5 hari', '3 hari', '1 hari', 'sekarang'],
  },
]

const boardColors = {
  a: '#F2AC2E',
  b: '#6EA2F5',
}

function formatNumber(value: number, digits = 2) {
  return value.toFixed(digits).replace('.', ',')
}

function formatRupiah(value: number) {
  return `Rp${value.toLocaleString('id-ID')}`
}

export function ComparisonPage() {
  const [boardA, setBoardA] = useState('pm1')
  const [boardB, setBoardB] = useState('pm2')
  const [range, setRange] = useState<RangeId>('live')
  const [visibleMetrics, setVisibleMetrics] = useState<CompareMetricId[]>([
    'watt',
    'voltage',
  ])

  const nameA = meters.find((meter) => meter.id === boardA)?.name ?? 'Power Meter 1'
  const nameB = meters.find((meter) => meter.id === boardB)?.name ?? 'Power Meter 2'
  const seriesA = comparisonSeries[boardA] ?? comparisonSeries.pm1
  const seriesB = comparisonSeries[boardB] ?? comparisonSeries.pm2

  const summaryA = meterSummaries[boardA] ?? meterSummaries.pm1
  const summaryB = meterSummaries[boardB] ?? meterSummaries.pm2

  const energyDelta = summaryA.energy - summaryB.energy
  const percent = Math.round(
    (Math.abs(energyDelta) / Math.max(summaryB.energy, 0.01)) * 100,
  )
  const costDelta = Math.abs(summaryA.cost - summaryB.cost)

  const swapBoards = () => {
    setBoardA(boardB)
    setBoardB(boardA)
  }

  const toggleMetric = (id: CompareMetricId) => {
    setVisibleMetrics((current) => {
      if (current.includes(id)) {
        return current.length === 1
          ? current
          : current.filter((metricId) => metricId !== id)
      }
      return [...current, id]
    })
  }

  const activeRange = ranges.find((item) => item.id === range) ?? ranges[0]
  const activeMetrics = compareMetrics.filter((metric) =>
    visibleMetrics.includes(metric.id),
  )

  return (
    <>
      <header className="page-head compare-head">
        <h1>Power comparison</h1>
        <p>
          Bandingkan dua board pada powermeter dan rentang waktu yang sama.
        </p>
      </header>

      <section className="card compare-filter" aria-label="Filter perbandingan">
        <div className="compare-top">
          <div className="boards">
            <label className="board-field">
              <span className="board-label">
                <span className="legend-dot a" />
                Board A
              </span>
              <span className="select-wrap">
                <select
                  className="board-select"
                  value={boardA}
                  onChange={(event) => setBoardA(event.target.value)}
                  aria-label="Pilih board A"
                >
                  {meters.map((meter) => (
                    <option key={meter.id} value={meter.id}>
                      {meter.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </label>

            <button
              type="button"
              className="swap-btn"
              onClick={swapBoards}
              aria-label="Tukar board A dan board B"
            >
              <ArrowLeftRight size={22} strokeWidth={2} />
            </button>

            <label className="board-field">
              <span className="board-label">
                <span className="legend-dot b" />
                Board B
              </span>
              <span className="select-wrap">
                <select
                  className="board-select"
                  value={boardB}
                  onChange={(event) => setBoardB(event.target.value)}
                  aria-label="Pilih board B"
                >
                  {meters.map((meter) => (
                    <option key={meter.id} value={meter.id}>
                      {meter.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </label>
          </div>

          <div className="range-field">
            <span className="range-label">Rentang waktu</span>
            <div className="chips" role="group" aria-label="Rentang waktu">
              {ranges.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`chip${range === item.id ? ' is-active' : ''}`}
                  aria-pressed={range === item.id}
                  onClick={() => setRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="metric-field">
          <span className="metric-label">Grafik yang ditampilkan</span>
          <div
            className="chips"
            role="group"
            aria-label="Grafik yang ditampilkan"
          >
            {compareMetrics.map((metric) => (
              <button
                key={metric.id}
                type="button"
                className={`chip${visibleMetrics.includes(metric.id) ? ' is-active' : ''}`}
                aria-pressed={visibleMetrics.includes(metric.id)}
                onClick={() => toggleMetric(metric.id)}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="compare-summary">
        <section className="card compare-summary-card">
          <span className="summary-title">Kesimpulan</span>
          <p className="summary-conclusion">
            {energyDelta === 0 ? (
              'Konsumsi energi kedua board setara.'
            ) : (
              <>
                {nameA} {energyDelta > 0 ? 'lebih boros' : 'lebih hemat'}{' '}
                <span className="pct">{percent}%</span>{' '}
                {energyDelta > 0 ? 'dari' : 'dibanding'} {nameB}.
              </>
            )}
          </p>
          <div className="summary-foot">
            <span>Selisih biaya</span>
            <strong>{formatRupiah(costDelta)}</strong>
          </div>
        </section>

        <section className="card compare-summary-card">
          <span className="summary-title">Total energi</span>
          <div className="summary-pair">
            <span className="pair-a">A {formatNumber(summaryA.energy)} kWh</span>
            <span className="pair-b">B {formatNumber(summaryB.energy)} kWh</span>
          </div>
          <div className="summary-sub">
            <span>
              Biaya A <strong>{formatRupiah(summaryA.cost)}</strong>
            </span>
            <span>
              B <strong>{formatRupiah(summaryB.cost)}</strong>
            </span>
          </div>
        </section>

        <section className="card compare-summary-card">
          <span className="summary-title">Rata-rata power factor</span>
          <div className="summary-pair">
            <span className="pair-a">A {formatNumber(summaryA.pf)}</span>
            <span className="pair-b">B {formatNumber(summaryB.pf)}</span>
          </div>
          <p className="summary-note">Ideal di atas 0,85</p>
        </section>
      </div>

      <div className="compare-charts">
        {activeMetrics.map((metric) => (
          <ComparisonChart
            key={metric.id}
            metric={metric}
            series={[
              { label: nameA, color: boardColors.a, data: seriesA[metric.id] },
              { label: nameB, color: boardColors.b, data: seriesB[metric.id] },
            ]}
            xLabels={activeRange.xLabels}
          />
        ))}
      </div>
    </>
  )
}
