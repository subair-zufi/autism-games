import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/auth'
import { GAMES_BY_SKILL, GAME_LIST, type GameId, type GameMeta } from '../types'
import { useScores } from '../state/scores'
import { useSettings } from '../state/settings'
import { playTap } from '../services/sounds'
import { analytics } from '../services/analytics'
import { ProgressBar } from '../components/ProgressBar'
import { initials, participantMeta } from '../lib/participant'
import { useOffline } from '../state/offline'

export function Home() {
  const navigate = useNavigate()
  const students = useAuth((s) => s.students)
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const loadStudents = useAuth((s) => s.loadStudents)
  const best = useScores((s) => s.best)
  const playMode = useSettings((s) => s.playMode)
  const offlineMode = useOffline((s) => s.offlineMode)

  const active = students.find((s) => s.id === activeStudentId) ?? null

  // Level-progress % shown on each level-tracked card, keyed by game id. Every
  // hasLevels game is fetched independently; reusing one game's % for all of
  // them silently mis-reports the others. Recomputed per active student.
  const [percents, setPercents] = useState<Partial<Record<GameId, number>>>({})
  useEffect(() => {
    if (offlineMode) return
    void loadStudents().catch(() => {})
  }, [loadStudents, offlineMode])
  useEffect(() => {
    if (offlineMode) return
    let cancelled = false
    const levelGames = GAME_LIST.filter((g) => g.hasLevels)
    void Promise.all(
      levelGames.map(async (g) => {
        const rows = await analytics.getProgress(g.id)
        const pct = rows.length
          ? Math.round((rows.reduce((a, r) => a + r.best_accuracy, 0) / rows.length) * 100)
          : 0
        return [g.id, pct] as const
      }),
    ).then((entries) => {
      if (cancelled) return
      setPercents(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
  }, [activeStudentId, offlineMode])

  return (
    <div className="page home">
      {!offlineMode && (
        <Link to="/play-offline" className="link-accent home-offline-link">Play Offline</Link>
      )}

      {!offlineMode && (
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
      )}

      {GAMES_BY_SKILL.map(({ skill, games: allGames }) => {
        const games = allGames.filter((g) => g.mode === playMode)
        if (games.length === 0) return null
        return (
          <section key={skill.id}>
            <div className="section-head">
              <h2>{skill.icon} {skill.label}</h2>
              <span className="section-count">{games.length} MODULES</span>
            </div>
            <div className="game-grid">
              {games.map((g) => (
                <GameCard key={g.id} game={g} percent={percents[g.id] ?? 0} best={best[g.id] ?? 0} onOpen={navigate} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function GameCard({
  game,
  percent,
  best,
  onOpen,
}: {
  game: GameMeta
  percent: number
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
          <span className="game-progress-pct">{percent}%</span>
          <ProgressBar value={percent} />
        </div>
      ) : (
        <span className="game-best">⭐ Best {best}</span>
      )}
    </button>
  )
}
