import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../state/auth'
import {
  analytics,
  type EmotionReport,
  type GameScore,
  type ParticipantSkillReport,
  type SkillScore,
  type StudentReport,
} from '../services/analytics'
import { gameById, skillMeta, type Skill } from '../types'
import { ageFromDob, initials } from '../lib/participant'
import { LineChart } from '../components/charts/LineChart'
import { SkillRadar } from '../components/charts/SkillRadar'
import { StarIcon } from '../components/icons'
import { emotionMeta, type EmotionId } from '../games/emotionVocab'

const gameTitle = (key: string) => gameById(key)?.title ?? key
const fmt = (v: number | null) => (v == null ? '—' : Math.round(v).toString())

/** Coloured ± improvement chip; hidden when there is nothing to compare. */
function DeltaChip({ delta }: { delta: number | null }) {
  if (delta == null || Math.abs(delta) < 0.5) return null
  const up = delta > 0
  return (
    <span className={`delta-chip ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {Math.abs(Math.round(delta))}
    </span>
  )
}

/** One 0–100 score as a horizontal bar with an optional improvement chip. */
function ScoreBar({
  label,
  score,
  color,
  delta,
  sub,
}: {
  label: string
  score: number | null
  color: string
  delta?: number | null
  sub?: string
}) {
  const played = score != null
  return (
    <div className={`score-bar-row${played ? '' : ' empty'}`}>
      <div className="score-bar-head">
        <span className="score-bar-label">{label}</span>
        <span className="score-bar-value">
          {fmt(score)}
          {delta !== undefined && <DeltaChip delta={delta ?? null} />}
        </span>
      </div>
      <div className="score-bar-track">
        <div
          className="score-bar-fill"
          style={{ width: `${played ? Math.max(2, Math.min(100, score!)) : 0}%`, background: color }}
        />
      </div>
      {sub && <span className="score-bar-sub">{sub}</span>}
    </div>
  )
}

function SkillCard({ skill }: { skill: SkillScore }) {
  const meta = skillMeta(skill.skill as Skill)
  return (
    <div className="skill-card" style={{ '--card-accent': meta.color } as React.CSSProperties}>
      <div className="skill-card-head">
        <span className="skill-card-title">
          <span aria-hidden>{meta.icon}</span> {meta.label}
        </span>
        <span className="skill-card-score">
          {fmt(skill.score)}
          <DeltaChip delta={skill.delta} />
        </span>
      </div>
      <div className="skill-card-games">
        {skill.games.map((g: GameScore) => (
          <ScoreBar
            key={g.game_key}
            label={gameTitle(g.game_key)}
            score={g.score}
            color={meta.color}
            delta={g.delta}
            sub={
              g.n_trials > 0
                ? `${g.n_trials} trials · ${g.n_sessions} session${g.n_sessions === 1 ? '' : 's'}` +
                  (g.median_latency_ms != null ? ` · ${(g.median_latency_ms / 1000).toFixed(1)}s` : '')
                : 'Not played yet'
            }
          />
        ))}
      </div>
    </div>
  )
}

export function Progress() {
  const students = useAuth((s) => s.students)
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const active = students.find((s) => s.id === activeStudentId) ?? null

  const [report, setReport] = useState<StudentReport | null>(null)
  const [emotions, setEmotions] = useState<EmotionReport | null>(null)
  const [skills, setSkills] = useState<ParticipantSkillReport | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!activeStudentId) {
      setReport(null)
      setEmotions(null)
      setSkills(null)
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
    void analytics
      .getSkillReport(activeStudentId)
      .then((r) => !cancelled && setSkills(r))
      .catch(() => !cancelled && setSkills(null))
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

  const age = ageFromDob(active.date_of_birth)
  const hasScores = skills != null && skills.n_trials > 0
  const radarAxes = (skills?.skills ?? []).map((s) => ({ label: skillMeta(s.skill as Skill).icon, value: s.score }))

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

      {/* --- Standardised skill scores ------------------------------------ */}
      {hasScores ? (
        <>
          <section className="panel composite-panel">
            <div className="composite-hero">
              <div className="composite-score">
                <span className="composite-value">{fmt(skills!.composite)}</span>
                <span className="composite-max">/100</span>
                <DeltaChip delta={skills!.composite_delta} />
              </div>
              <div className="composite-caption">
                <strong>Social-Emotional Score</strong>
                <span>{skills!.n_sessions} sessions · {skills!.n_trials} scored trials</span>
                <small>Chance-corrected accuracy, comparable across all games.</small>
              </div>
            </div>
            <SkillRadar axes={radarAxes} />
            <div className="radar-legend">
              {skills!.skills.map((s) => {
                const m = skillMeta(s.skill as Skill)
                return (
                  <span key={s.skill} className="radar-legend-item">
                    <span className="radar-legend-dot" style={{ background: m.color }} />
                    {m.icon} {m.label} · <strong>{fmt(s.score)}</strong>
                  </span>
                )
              })}
            </div>
          </section>

          <section className="panel">
            <h2>Skill Breakdown</h2>
            <p className="empty small">
              Each score is 0–100 (0 = chance, 100 = ceiling). ▲/▼ shows change from the first to the most recent session.
            </p>
            <div className="skill-card-list">
              {skills!.skills.map((s) => (
                <SkillCard key={s.skill} skill={s} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel">
          <h2>Skill Scores</h2>
          <p className="empty small">
            {loading ? 'Loading…' : 'No scored gameplay yet. Play a few games to build this participant’s skill profile.'}
          </p>
        </section>
      )}

      <section className="panel">
        <h2>Activity Over Time</h2>
        {report && <LineChart points={report.timeseries} />}
        <p className="empty small">Average session score per week.</p>
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
