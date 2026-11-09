import { useId } from 'react'
import type { CompareMetric } from '../data'

export interface CompareSeries {
  label: string
  color: string
  data: number[]
}

interface ComparisonChartProps {
  metric: CompareMetric
  series: [CompareSeries, CompareSeries]
  xLabels: string[]
}

export function ComparisonChart({
  metric,
  series,
  xLabels,
}: ComparisonChartProps) {
  const rawId = useId()
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '')
  const range = metric.max - metric.min

  const paths = series.map((item) => {
    const points = item.data.map((value, index) => {
      const x = (index / (item.data.length - 1)) * 100
      const rawY = 100 - ((value - metric.min) / range) * 100
      const y = Math.min(100, Math.max(0, rawY))
      return `${x.toFixed(3)},${y.toFixed(3)}`
    })
    const line = `M${points.join(' L')}`
    return { line, area: `${line} L100,100 L0,100 Z` }
  })

  return (
    <section className="card compare-chart">
      <div className="compare-chart-head">
        <h2 className="compare-chart-title">
          {metric.title}
          {metric.unit ? ` (${metric.unit})` : ''}
        </h2>

        <div className="chart-legend">
          {series.map((item) => (
            <span className="legend-item" key={item.label}>
              <span
                className="legend-dot"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="chart compare-chart-body">
        <div className="chart-y compare-y">
          {metric.ticks.map((tick, index) => (
            <span
              key={tick}
              style={{
                top: `${(index / (metric.ticks.length - 1)) * 100}%`,
              }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="chart-main">
          <div className="chart-plot compare-plot">
            {metric.ticks.map((tick, index) => (
              <span
                key={tick}
                className="grid-line"
                style={{
                  top: `${(index / (metric.ticks.length - 1)) * 100}%`,
                }}
              />
            ))}

            <svg
              className="chart-svg"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              role="img"
              aria-label={`Grafik perbandingan ${metric.title}`}
            >
              <defs>
                {series.map((item, index) => (
                  <linearGradient
                    key={item.label}
                    id={`${id}-grad-${index}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={item.color}
                      stopOpacity="0.22"
                    />
                    <stop
                      offset="100%"
                      stopColor={item.color}
                      stopOpacity="0.02"
                    />
                  </linearGradient>
                ))}
              </defs>

              {series.map((item, index) => (
                <g key={item.label}>
                  <path
                    d={paths[index].area}
                    fill={`url(#${id}-grad-${index})`}
                  />
                  <path
                    d={paths[index].line}
                    fill="none"
                    stroke={item.color}
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </g>
              ))}
            </svg>
          </div>

          <div
            className="chart-x compare-x"
            style={{ gridTemplateColumns: `repeat(${xLabels.length}, minmax(0, 1fr))` }}
          >
            {xLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
