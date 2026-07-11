import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { GAMES_BY_SKILL, type GameMeta } from '../types'
import { useScores } from '../state/scores'
import { playTap } from '../services/sounds'
import { analytics } from '../services/analytics'
import { ProgressBar } from '../components/ProgressBar'
import { initials, participantMeta } from '../lib/participant'

export function Home() {
  const navigate = useNavigate()
  const students = useAuth((s) => s.students)
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const loadStudents = useAuth((s) => s.loadStudents)
  const best = useScores((s) => s.best)

  const active = students.find((s) => s.id === activeStudentId) ?? null

  // Emotion Recognition is the only level-tracked game; show its real % on the
  // card. Recomputed when the active student changes.
  const [erPercent, setErPercent] = useState(0)
  useEffect(() => {
    void loadStudents().catch(() => {})
  }, [loadStudents])
  useEffect(() => {
    let cancelled = false
    void analytics.getProgress('emotionrecognition').then((rows) => {
      if (cancelled) return
      const pct = rows.length
        ? Math.round((rows.reduce((a, r) => a + r.best_accuracy, 0) / rows.length) * 100)
        : 0
      setErPercent(pct)
    })
    return () => {
      cancelled = true
    }
  }, [activeStudentId])

  return (
    <div className="page home">
      <header className="participant-banner">
        {active ? (
          <>
            <span className="pb-avatar">{active.avatar ? active.avatar : initials(active.full_name)}</span>
            <div className="pb-info">
              <span className="pb-eyebrow">Current Participant</span>
              <h1>{active.full_name}</h1>
              <span className="pb-meta">
                {participantMeta(active)}
                {active.autism_level ? ` · ${active.autism_level}` : ''}
              </span>
            </div>
            <Link to="/participants" className="pb-change">⟳ Change</Link>
          </>
        ) : (
          <>
            <span className="pb-avatar">＋</span>
            <div className="pb-info">
              <span className="pb-eyebrow">No participant selected</span>
              <h1>Choose a participant</h1>
              <span className="pb-meta">Progress is saved to the selected participant</span>
            </div>
            <Link to="/participants" className="pb-change">Select</Link>
          </>
        )}
      </header>

      {GAMES_BY_SKILL.map(({ skill, games }) => (
        <section key={skill.id}>
          <div className="section-head">
            <h2>{skill.icon} {skill.label}</h2>
            <span className="section-count">{games.length} MODULES</span>
          </div>
          <div className="game-grid">
            {games.map((g) => (
              <GameCard key={g.id} game={g} erPercent={erPercent} best={best[g.id] ?? 0} onOpen={navigate} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function GameCard({
  game,
  erPercent,
  best,
  onOpen,
}: {
  game: GameMeta
  erPercent: number
  best: number
  onOpen: (path: string) => void
}) {
  return (
    <button
      className="game-card"
      style={{ '--card-accent': game.color } as React.CSSProperties}
      onClick={() => {
        playTap()
        onOpen(`/game/${game.id}`)
      }}
    >
      <span className="game-icon" aria-hidden>{game.icon}</span>
      <span className="game-name">{game.title}</span>
      <span className="game-desc">{game.description}</span>
      {game.hasLevels ? (
        <div className="game-progress">
          <span className="game-progress-pct">{erPercent}%</span>
          <ProgressBar value={erPercent} />
        </div>
      ) : (
        <span className="game-best">⭐ Best {best}</span>
      )}
    </button>
  )
}
