import { useId } from 'react'
import type { ChartConfig, ChartPill } from '../data'

function Pill({ pill, color }: { pill: ChartPill; color: string }) {
  return (
    <div className="pill">
      <span className="pill-label">
        {pill.label} <span className="pill-time">{pill.time}</span>
      </span>
      <span className="pill-value" style={{ color }}>
        {pill.value}
      </span>
    </div>
  )
}

export function ChartCard({ config }: { config: ChartConfig }) {
  const rawId = useId()
  const gradientId = `area-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const range = config.max - config.min
  const points = config.data.map((value, index) => {
    const x = (index / (config.data.length - 1)) * 100
    const y = 100 - ((value - config.min) / range) * 100
    return `${x.toFixed(3)},${y.toFixed(3)}`
  })
  const linePath = `M${points.join(' L')}`
  const areaPath = `${linePath} L100,100 L0,100 Z`

  return (
    <section className="card chart-card">
      <div className="chart-head">
        <div className="metric">
          <span className="metric-label">{config.title}</span>
          <div className="metric-value" style={{ color: config.color }}>
            {config.current}
            <span className="metric-unit">{config.unit}</span>
          </div>
        </div>

        <div className="pills">
          <Pill pill={config.peak} color="#FB923C" />
          <Pill pill={config.trough} color="#38BDF8" />
        </div>
      </div>

      <div className="chart">
        <div className="chart-y">
          {config.ticks.map((tick, index) => (
            <span
              key={tick}
              style={{ top: `${(index / (config.ticks.length - 1)) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="chart-main">
          <div className="chart-plot">
            {config.ticks.map((tick, index) => (
              <span
                key={tick}
                className="grid-line"
                style={{ top: `${(index / (config.ticks.length - 1)) * 100}%` }}
              />
            ))}

            <svg
              className="chart-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Grafik ${config.title}`}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={config.color} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={config.color} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d={areaPath} fill={`url(#${gradientId})`} />
              <path
                d={linePath}
                fill="none"
                stroke={config.color}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="chart-x">
            <span>2 menit lalu</span>
            <span>sekarang</span>
          </div>
        </div>
      </div>
    </section>
  )
}
