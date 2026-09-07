import { Link } from 'react-router-dom'
import { useRemoteReport } from '../remote/status'

export function ScoreBar(props: {
  score: number
  /** when set, score is shown as progress toward a winning goal (e.g. 2/5) */
  goal?: number
  lives?: number
  maxLives?: number
  /** seconds remaining; shown as a countdown for timed games */
  timeLeft?: number
  /** extra progress readout (e.g. "3 / 7" finds) when score itself is points */
  progress?: string
}) {
  // Every game shows this bar exactly while a round is running, which makes it
  // the one place that can tell the trainer's phone the score without any game
  // knowing that the remote control exists (remote/status.ts).
  useRemoteReport({
    phase: 'playing',
    score: props.score,
    progress:
      props.progress ?? (props.goal !== undefined ? `${props.score} / ${props.goal}` : null),
  })
  return (
    <div className="score-bar">
      <Link to="/" className="home-btn" aria-label="Home">🏠</Link>
      <span className="score">⭐ {props.score}{props.goal !== undefined ? ` / ${props.goal}` : ''}</span>
      {props.progress !== undefined && <span className="score">🔍 {props.progress}</span>}
      {props.timeLeft !== undefined && <span className="score">⏱️ {props.timeLeft}s</span>}
      {props.lives !== undefined && (
        <span className="lives">
          {Array.from({ length: props.maxLives ?? 3 }, (_, i) => (
            <span key={i} style={{ opacity: i < props.lives! ? 1 : 0.25 }}>❤️</span>
          ))}
        </span>
      )}
    </div>
  )
}
