/** Minimal inline-SVG line chart with an area fill and dot markers. No deps.
 *  Values are assumed 0-100; the y-axis shows 0/20/40/60/80. */
interface Point {
  label: string
  value: number
}

export function LineChart({ points, height = 160 }: { points: Point[]; height?: number }) {
  const W = 320
  const H = height
  const padL = 28
  const padB = 22
  const padT = 10
  const padR = 8
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const maxY = 100
  const n = points.length

  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (v: number) => padT + innerH - (Math.max(0, Math.min(maxY, v)) / maxY) * innerH

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ')
  const areaPath =
    n > 0
      ? `${linePath} L${x(n - 1)},${padT + innerH} L${x(0)},${padT + innerH} Z`
      : ''
  const ticks = [0, 20, 40, 60, 80]

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Progress over time">
      {ticks.map((t) => (
        <g key={t}>
          <line className="chart-grid" x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} />
          <text className="chart-axis" x={padL - 6} y={y(t) + 3} textAnchor="end">{t}</text>
        </g>
      ))}
      {areaPath && <path className="chart-area" d={areaPath} />}
      {linePath && <path className="chart-line" d={linePath} />}
      {points.map((p, i) => (
        <g key={p.label}>
          <circle className="chart-dot" cx={x(i)} cy={y(p.value)} r={3.5} />
          <text className="chart-axis" x={x(i)} y={H - 6} textAnchor="middle">{p.label}</text>
        </g>
      ))}
    </svg>
  )
}
