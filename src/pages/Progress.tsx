import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { analytics, type EmotionReport, type StudentReport } from '../services/analytics'
import { gameById } from '../types'
import { ageFromDob, initials } from '../lib/participant'
import { LineChart } from '../components/charts/LineChart'
import { BarChart } from '../components/charts/BarChart'
import { StarIcon } from '../components/icons'
import { emotionMeta, type EmotionId } from '../games/emotionVocab'

const gameTitle = (key: string) => gameById(key)?.title ?? key
const shortLabel = (key: string) => (gameById(key)?.title ?? key).split(' ')[0]

export function Progress() {
  const students = useAuth((s) => s.students)
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const active = students.find((s) => s.id === activeStudentId) ?? null

  const [report, setReport] = useState<StudentReport | null>(null)
  const [emotions, setEmotions] = useState<EmotionReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeStudentId) {
      setReport(null)
      setEmotions(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void analytics
      .getStudentReport(activeStudentId)
      .then((r) => !cancelled && setReport(r))
      .catch(() => !cancelled && setReport(null))
      .finally(() => !cancelled && setLoading(false))
    void analytics
      .getEmotionReport(activeStudentId)
      .then((r) => !cancelled && setEmotions(r))
      .catch(() => !cancelled && setEmotions(null))
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

      {emotions && emotions.stats.some((s) => s.total > 0) && (
        <section className="panel">
          <h2>Emotion Identification Profile</h2>
          <p className="empty small">
            First attempts only, across Emotion Recognition and Emotion Clips.
          </p>
          <ul className="emotion-stat-list">
            {emotions.stats.map((s) => {
              const m = emotionMeta(s.emotion as EmotionId)
              return (
                <li key={s.emotion} className="emotion-stat">
                  <span className="emotion-stat-label">{m.emoji} {m.label}</span>
                  <span className="emotion-stat-acc">
                    {s.total > 0 ? `${Math.round(s.accuracy * 100)}%` : '—'}
                    <small> ({s.correct}/{s.total})</small>
                  </span>
                  <span className="emotion-stat-latency">
                    {s.median_latency_ms != null ? `${(s.median_latency_ms / 1000).toFixed(1)}s` : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
          <h3 className="confusion-title">Confusion matrix (shown → picked)</h3>
          <div className="confusion-scroll">
            <table className="confusion-matrix">
              <thead>
                <tr>
                  <th aria-label="Shown emotion" />
                  {emotions.emotions.map((id) => (
                    <th key={id} title={emotionMeta(id as EmotionId).label}>
                      {emotionMeta(id as EmotionId).emoji}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emotions.emotions.map((shown) => (
                  <tr key={shown}>
                    <th title={emotionMeta(shown as EmotionId).label}>
                      {emotionMeta(shown as EmotionId).emoji}
                    </th>
                    {emotions.emotions.map((picked) => {
                      const n = emotions.confusion[shown]?.[picked] ?? 0
                      const cls =
                        shown === picked ? 'diag' : n > 0 ? 'confused' : ''
                      return (
                        <td key={picked} className={cls}>
                          {n > 0 ? n : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
