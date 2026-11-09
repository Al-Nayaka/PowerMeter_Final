import { useId } from 'react'
import type { ChartConfig, ChartPill } from '../data'
import { sampleTime } from '../live-api'

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

export function ChartCard({ config }: { config: ChartConfig & { times?: number[] } }) {
  const rawId = useId()
  const gradientId = `area-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
  const range = config.max - config.min || 1
  const start = config.times?.[0]
  const end = config.times?.at(-1)
  const points = config.data.map((value, index) => {
    const x = config.data.length === 1 ? 50 : start !== undefined && end !== undefined && end > start
      ? ((config.times![index] - start) / (end - start)) * 100
      : (index / (config.data.length - 1)) * 100
    const y = 100 - ((value - config.min) / range) * 100
    return `${x.toFixed(3)},${y.toFixed(3)}`
  })
  const linePath = points.length ? `M${points.join(' L')}` : ''
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
              key={index}
              style={{ top: `${(index / (config.ticks.length - 1)) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="chart-main">
          <div className="chart-plot">
            {config.ticks.map((_, index) => (
              <span
                key={index}
                className="grid-line"
                style={{ top: `${(index / (config.ticks.length - 1)) * 100}%` }}
              />
            ))}

            {points.length === 0 ? <p role="status">Belum ada sampel pengukuran.</p> : <svg
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
              {points.length > 1 && <path d={areaPath} fill={`url(#${gradientId})`} />}
              {points.length === 1 && <circle cx="50" cy={points[0].split(',')[1]} r="1" fill={config.color} />}
              <path
                d={linePath}
                fill="none"
                stroke={config.color}
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>}
          </div>

          <div className="chart-x">
            <span>{start !== undefined ? sampleTime(start) : '—'}</span>
            <span>{end !== undefined ? sampleTime(end) : '—'}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
