import { Link } from 'react-router-dom'

export function ScoreBar(props: {
  score: number
  lives?: number
  maxLives?: number
  /** seconds remaining; shown as a countdown for timed games */
  timeLeft?: number
}) {
  return (
    <div className="score-bar">
      <Link to="/" className="home-btn" aria-label="Home">🏠</Link>
      <span className="score">⭐ {props.score}</span>
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
