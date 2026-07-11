/**
 * Minimal inline-SVG radar (spider) chart for the four skill scores. No deps.
 * Values are 0–100; missing skills (no data yet) are drawn at the centre and
 * their label is dimmed. Generalises to any number of axes ≥ 3.
 */
export interface RadarAxis {
  label: string
  value: number | null // 0–100, or null when the skill has no data yet
}

export function SkillRadar({ axes, accent = '#4a76d4' }: { axes: RadarAxis[]; accent?: string }) {
  const W = 260
  const H = 240
  const cx = W / 2
  const cy = H / 2 + 4
  const R = 82
  const n = axes.length
  const rings = [0.25, 0.5, 0.75, 1]

  // Axis i points at angle starting from straight up, going clockwise.
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n
  const point = (i: number, r: number): [number, number] => [
    cx + Math.cos(angle(i)) * R * r,
    cy + Math.sin(angle(i)) * R * r,
  ]
  const poly = (r: (i: number) => number) =>
    axes.map((_, i) => point(i, r(i)).join(',')).join(' ')

  const valueR = (i: number) => Math.max(0, Math.min(100, axes[i].value ?? 0)) / 100

  return (
    <svg className="chart radar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Skill profile radar">
      {/* grid rings */}
      {rings.map((ring) => (
        <polygon key={ring} className="radar-grid" points={poly(() => ring)} />
      ))}
      {/* spokes + labels */}
      {axes.map((a, i) => {
        const [ex, ey] = point(i, 1)
        const [lx, ly] = point(i, 1.22)
        const anchor = Math.abs(lx - cx) < 6 ? 'middle' : lx > cx ? 'start' : 'end'
        return (
          <g key={a.label}>
            <line className="radar-grid" x1={cx} y1={cy} x2={ex} y2={ey} />
            <text
              className={`radar-label${a.value == null ? ' muted' : ''}`}
              x={lx}
              y={ly}
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {a.label}
            </text>
            <text className="radar-value" x={lx} y={ly + 12} textAnchor={anchor} dominantBaseline="middle">
              {a.value == null ? '—' : Math.round(a.value)}
            </text>
          </g>
        )
      })}
      {/* value polygon */}
      <polygon
        className="radar-area"
        points={poly(valueR)}
        style={{ fill: `${accent}22`, stroke: accent }}
      />
      {axes.map((a, i) => {
        if (a.value == null) return null
        const [px, py] = point(i, valueR(i))
        return <circle key={a.label} className="radar-dot" cx={px} cy={py} r={3} style={{ fill: accent }} />
      })}
    </svg>
  )
}
