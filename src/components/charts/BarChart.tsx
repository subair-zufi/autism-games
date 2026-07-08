/** Minimal inline-SVG bar chart. No deps. Bars auto-scale to the max value. */
interface Bar {
  label: string
  value: number
}

export function BarChart({ bars, height = 160 }: { bars: Bar[]; height?: number }) {
  const W = 320
  const H = height
  const padL = 24
  const padB = 22
  const padT = 10
  const padR = 8
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxV = Math.max(1, ...bars.map((b) => b.value))
  const n = bars.length || 1
  const slot = innerW / n
  const bw = Math.min(34, slot * 0.55)

  const ticks = [0, maxV / 2, maxV].map((t) => Math.round(t))

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Activities completed per game">
      {ticks.map((t, i) => {
        const yy = padT + innerH - (t / maxV) * innerH
        return (
          <g key={i}>
            <line className="chart-grid" x1={padL} y1={yy} x2={W - padR} y2={yy} />
            <text className="chart-axis" x={padL - 6} y={yy + 3} textAnchor="end">{t}</text>
          </g>
        )
      })}
      {bars.map((b, i) => {
        const bh = (b.value / maxV) * innerH
        const bx = padL + i * slot + (slot - bw) / 2
        const by = padT + innerH - bh
        return (
          <g key={b.label}>
            <rect className="chart-bar" x={bx} y={by} width={bw} height={Math.max(0, bh)} rx={4} />
            <text className="chart-axis" x={bx + bw / 2} y={H - 6} textAnchor="middle">{b.label}</text>
          </g>
        )
      })}
    </svg>
  )
}
