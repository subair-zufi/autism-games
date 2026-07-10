import { Link } from 'react-router-dom'

export function GameOverDialog(props: {
  score: number
  best: number
  onRestart: () => void
  /** 1-3 stars for the session; omitted for games without a star rating */
  stars?: number
  /** headline override, e.g. an encouraging message when lives ran out */
  message?: string
}) {
  return (
    <div className="overlay">
      <div className="dialog">
        <h2>{props.message ?? 'Great playing! 🎉'}</h2>
        {props.stars !== undefined && (
          <p className="dialog-stars" aria-label={`${props.stars} stars`}>
            {'⭐'.repeat(Math.max(1, props.stars))}
          </p>
        )}
        <p className="dialog-score">You earned ⭐ {props.score}</p>
        <p className="dialog-best">Your best: {props.best}</p>
        <button className="big-btn" onClick={props.onRestart}>Play again</button>
        <Link to="/" className="big-btn home-link">🏠 Home</Link>
      </div>
    </div>
  )
}
