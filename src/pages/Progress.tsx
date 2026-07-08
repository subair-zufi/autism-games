import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { analytics, type StudentReport } from '../services/analytics'
import { gameById } from '../types'
import { ageFromDob, initials } from '../lib/participant'
import { LineChart } from '../components/charts/LineChart'
import { BarChart } from '../components/charts/BarChart'
import { StarIcon } from '../components/icons'

const gameTitle = (key: string) => gameById(key)?.title ?? key
const shortLabel = (key: string) => (gameById(key)?.title ?? key).split(' ')[0]

export function Progress() {
  const students = useAuth((s) => s.students)
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const active = students.find((s) => s.id === activeStudentId) ?? null

  const [report, setReport] = useState<StudentReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeStudentId) {
      setReport(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void analytics
      .getStudentReport(activeStudentId)
      .then((r) => !cancelled && setReport(r))
      .catch(() => !cancelled && setReport(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [activeStudentId])

  if (!active) {
    return (
      <div className="page progress">
        <header className="page-head"><h1>Progress</h1></header>
        <p className="empty">
          Select a participant to view their progress. <Link to="/participants" className="link-accent">Choose one →</Link>
        </p>
      </div>
    )
  }

  const s = report?.summary
  const age = ageFromDob(active.date_of_birth)

  return (
    <div className="page progress">
      <header className="page-head"><h1>Progress</h1></header>

      <div className="progress-participant">
        <span className="pc-avatar">{active.avatar ? active.avatar : initials(active.full_name)}</span>
        <div className="pc-info">
          <span className="pc-name">{active.full_name}</span>
          <span className="pc-meta">
            {[active.autism_level, age != null ? `${age} years` : null].filter(Boolean).join(' · ')}
          </span>
        </div>
        <Link to="/participants" className="link-accent">Change</Link>
      </div>

      <div className="stat-row">
        <div className="stat-tile stat-blue">
          <span className="stat-value">{s ? `${s.completion_pct}%` : '—'}</span>
          <span className="stat-label">Completion</span>
        </div>
        <div className="stat-tile stat-green">
          <span className="stat-value">{s ? `${s.games_done}/${s.total_games}` : '—'}</span>
          <span className="stat-label">Games Done</span>
        </div>
        <div className="stat-tile stat-purple">
          <span className="stat-value">{s ? s.sessions : '—'}</span>
          <span className="stat-label">Sessions</span>
        </div>
      </div>

      <section className="panel">
        <h2>Progress Over Time</h2>
        {report && <LineChart points={report.timeseries} />}
      </section>

      <section className="panel">
        <h2>Activities Completed per Game</h2>
        {report && report.by_game.length > 0 ? (
          <BarChart bars={report.by_game.map((b) => ({ label: shortLabel(b.game_key), value: b.activities }))} />
        ) : (
          <p className="empty small">No activity yet.</p>
        )}
      </section>

      <section className="panel">
        <h2>Recent Activities</h2>
        {loading && <p className="empty small">Loading…</p>}
        {report && report.recent.length === 0 && !loading && <p className="empty small">No sessions yet.</p>}
        <ul className="recent-list">
          {report?.recent.map((r, i) => (
            <li key={i} className="recent-item">
              <span className="recent-icon" aria-hidden><StarIcon /></span>
              <div className="recent-body">
                <span className="recent-name">{gameTitle(r.game_key)}</span>
                <span className="recent-when">{new Date(r.when).toLocaleString()}</span>
              </div>
              {r.score != null && <span className="recent-score">{r.score}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
