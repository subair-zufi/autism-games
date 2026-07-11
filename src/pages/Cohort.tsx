/**
 * Cohort comparison — group-wise and demographic analytics across all of the
 * mentor's participants. Reads the standardised group report
 * (GET /api/reports/groups) and lets the researcher slice it by gender, autism
 * level, age band or IQ band. Everything shown is a 0–100 chance-corrected
 * score, so groups and skills are directly comparable.
 */
import { useEffect, useState } from 'react'
import { analytics, type GroupBy, type GroupReport } from '../services/analytics'
import { GroupedBarChart, type BarSeries } from '../components/charts/GroupedBarChart'

const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: 'overall', label: 'Overall' },
  { id: 'gender', label: 'Gender' },
  { id: 'autism_level', label: 'Autism Level' },
  { id: 'age_band', label: 'Age' },
  { id: 'iq_band', label: 'IQ' },
]

// Short x-axis labels for the five metrics (composite + the four skills), in the
// order the server returns them (see app/scoring.aggregate_group).
const METRIC_SHORT: Record<string, string> = {
  composite: 'Overall',
  emotion: 'Emotion',
  turntaking: 'Turns',
  socialnorms: 'Social',
  jointattention: 'Joint Att.',
}

// A colour-blind-friendly palette assigned to buckets by order.
const GROUP_COLORS = ['#4a76d4', '#e8833a', '#2fa36b', '#b5539c', '#d64550', '#6d5ac0', '#c9a227']

const fmt = (v: number | null) => (v == null ? '—' : Math.round(v).toString())

function Delta({ delta }: { delta: number | null }) {
  if (delta == null || Math.abs(delta) < 0.5) return null
  const up = delta > 0
  return <span className={`delta-chip ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {Math.abs(Math.round(delta))}</span>
}

export function Cohort() {
  const [groupBy, setGroupBy] = useState<GroupBy>('gender')
  const [report, setReport] = useState<GroupReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void analytics
      .getGroupReport(groupBy)
      .then((r) => !cancelled && setReport(r))
      .catch(() => !cancelled && setReport(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [groupBy])

  // Metric order/labels come from the first bucket's stats.
  const metricIds = report?.breakdowns[0]?.stats.map((s) => s.metric) ?? []
  const metricLabels = metricIds.map((m) => METRIC_SHORT[m] ?? m)

  const series: BarSeries[] = (report?.breakdowns ?? []).map((b, i) => ({
    label: b.group,
    color: GROUP_COLORS[i % GROUP_COLORS.length],
    values: b.stats.map((s) => s.mean),
  }))

  const hasData = report != null && report.total_participants > 0

  return (
    <div className="page cohort">
      <header className="page-head"><h1>Cohort Comparison</h1></header>

      <div className="cohort-controls">
        <span className="cohort-controls-label">Compare by</span>
        <div className="cohort-pills">
          {GROUP_OPTIONS.map((o) => (
            <button
              key={o.id}
              className={groupBy === o.id ? 'toggle-pill on' : 'toggle-pill'}
              onClick={() => setGroupBy(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <section className="panel">
          <p className="empty small">
            {loading
              ? 'Loading…'
              : 'No scored gameplay across your participants yet. Once participants play, their group scores appear here.'}
          </p>
        </section>
      ) : (
        <>
          <section className="panel">
            <h2>Skill scores by {GROUP_OPTIONS.find((o) => o.id === groupBy)?.label.toLowerCase()}</h2>
            <p className="empty small">
              Mean 0–100 score per group ({report!.total_participants} participants with data). Higher is better.
            </p>
            <GroupedBarChart metrics={metricLabels} series={series} />
            <div className="cohort-legend">
              {report!.breakdowns.map((b, i) => (
                <span key={b.group} className="cohort-legend-item">
                  <span className="cohort-legend-dot" style={{ background: GROUP_COLORS[i % GROUP_COLORS.length] }} />
                  {b.group} <small>(n={b.n_participants})</small>
                </span>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2>Detail</h2>
            <p className="empty small">Mean ± SD, and mean improvement (Δ, first → latest session) per group.</p>
            <div className="cohort-table-scroll">
              <table className="cohort-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    {metricIds.map((m) => (
                      <th key={m}>{METRIC_SHORT[m] ?? m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report!.breakdowns.map((b) => (
                    <tr key={b.group}>
                      <th className="cohort-row-head">
                        {b.group}
                        <small>n={b.n_participants}</small>
                      </th>
                      {b.stats.map((s) => (
                        <td key={s.metric} className={s.metric === 'composite' ? 'composite-cell' : ''}>
                          <span className="cohort-mean">{fmt(s.mean)}</span>
                          {s.sd != null && s.mean != null && <small className="cohort-sd">±{Math.round(s.sd)}</small>}
                          <Delta delta={s.mean_delta} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
