import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { gameById } from '../types'
import { analytics, type LevelProgress } from '../services/analytics'
import { useAuth } from '../state/auth'
import { ProgressBar } from '../components/ProgressBar'
import { BackIcon, HomeIcon, PlayIcon } from '../components/icons'
import { playTap } from '../services/sounds'

export function GameDetail() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const game = gameId ? gameById(gameId) : undefined
  const students = useAuth((s) => s.students)
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const active = students.find((s) => s.id === activeStudentId) ?? null

  // With no participant selected, sessions/steps are recorded without a
  // student_id and the data is effectively lost for the study. Block play until
  // the facilitator either selects a participant or explicitly opts to play
  // unrecorded — otherwise a whole session can be lost invisibly.
  //
  // Declared up here with the other hooks: it used to sit below the "unknown
  // game" early return, so navigating from a real game to a bad :gameId changed
  // the hook count between renders.
  const [dismissedGuard, setDismissedGuard] = useState(false)

  const [rows, setRows] = useState<LevelProgress[]>([])
  useEffect(() => {
    if (!game?.hasLevels) return
    let cancelled = false
    void analytics.getProgress(game.id).then((r) => !cancelled && setRows(r))
    return () => {
      cancelled = true
    }
  }, [game?.id, game?.hasLevels, activeStudentId])

  if (!game) {
    return (
      <div className="page detail">
        <p>Unknown game.</p>
        <Link to="/" className="link-accent">Back home</Link>
      </div>
    )
  }

  const overall = rows.length
    ? Math.round((rows.reduce((a, r) => a + r.best_accuracy, 0) / rows.length) * 100)
    : 0

  // Level choice lives on the game's own start screen (LevelSelect/StartScreen),
  // not here — this page only decides whether the session is recordable.
  const play = () => {
    if (!active && !dismissedGuard) {
      setDismissedGuard(true) // reveal the explicit "play unrecorded" escape
      return
    }
    playTap()
    navigate(game.path)
  }

  return (
    <div className="detail">
      <header className="detail-topbar">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back"><BackIcon /></button>
        <h1>{game.title}</h1>
        <div className="detail-topbar-right">
          {active && <span className="participant-chip">{active.full_name.split(' ')[0]}</span>}
          <Link to="/" className="icon-btn" aria-label="Home"><HomeIcon /></Link>
        </div>
      </header>

      {!active && (
        <div className="detail-guard" role="alert">
          <span className="detail-guard-icon" aria-hidden>⚠️</span>
          <div className="detail-guard-body">
            <strong>No participant selected</strong>
            <p>This session will not be recorded — no progress or research data will be saved.</p>
            <div className="detail-guard-actions">
              <Link to="/participants" className="detail-guard-select">Select participant</Link>
              {dismissedGuard && (
                <button className="detail-guard-anyway" onClick={() => play()}>Play without recording</button>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="detail-hero" style={{ '--card-accent': game.color } as React.CSSProperties}>
        <span className="detail-hero-icon" aria-hidden>{game.icon}</span>
        <h2>{game.title}</h2>
        <p>{game.description}</p>
      </section>

      <div className="detail-cards">
        <div className="info-card">
          <span className="info-card-label">◎ Objective</span>
          <p>{game.objective}</p>
        </div>
        <div className="info-card">
          <span className="info-card-label">◷ Duration</span>
          <p className="info-card-strong">{game.duration}</p>
          {game.hasLevels && (
            <>
              <ProgressBar value={overall} />
              <span className="info-card-sub">{overall}% complete</span>
            </>
          )}
        </div>
      </div>

      <section className="detail-play">
        <button className="btn-primary" onClick={() => play()}>
          <PlayIcon /> Play
        </button>
      </section>
    </div>
  )
}
