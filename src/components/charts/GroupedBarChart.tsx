/**
 * Minimal inline-SVG grouped bar chart. No deps. Compares several series
 * (e.g. demographic groups) across a set of metrics (composite + skills), each
 * value on a 0–100 scale. Missing values (null) are simply not drawn.
 */
export interface BarSeries {
  label: string
  color: string
  values: (number | null)[] // one per metric, same order as `metrics`
}

export function GroupedBarChart({
  metrics,
  series,
  height = 220,
}: {
  metrics: string[]
  series: BarSeries[]
  height?: number
}) {
  const W = 360
  const H = height
  const padL = 26
  const padB = 34
  const padT = 10
  const padR = 8
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const nMetrics = Math.max(1, metrics.length)
  const nSeries = Math.max(1, series.length)

  const slot = innerW / nMetrics
  const groupW = slot * 0.72
  const barW = Math.min(26, groupW / nSeries)
  const ticks = [0, 25, 50, 75, 100]
  const y = (v: number) => padT + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH

  return (
    <svg className="chart grouped-bar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Group comparison">
      {ticks.map((t) => (
        <g key={t}>
          <line className="chart-grid" x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} />
          <text className="chart-axis" x={padL - 6} y={y(t) + 3} textAnchor="end">{t}</text>
        </g>
      ))}
      {metrics.map((m, mi) => {
        const groupX = padL + mi * slot + (slot - groupW) / 2
        return (
          <g key={m}>
            {series.map((s, si) => {
              const v = s.values[mi]
              if (v == null) return null
              const bx = groupX + si * (groupW / nSeries) + (groupW / nSeries - barW) / 2
              const by = y(v)
              const bh = padT + innerH - by
              return (
                <rect
                  key={s.label}
                  x={bx}
                  y={by}
                  width={barW}
                  height={Math.max(0, bh)}
                  rx={3}
                  fill={s.color}
                >
                  <title>{`${s.label} · ${m}: ${Math.round(v)}`}</title>
                </rect>
              )
            })}
            <text className="chart-axis" x={groupX + groupW / 2} y={H - padB + 14} textAnchor="middle">
              {m}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
