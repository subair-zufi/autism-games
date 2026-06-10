import { Link } from 'react-router-dom'

export function GameOverDialog(props: { score: number; best: number; onRestart: () => void }) {
  return (
    <div className="overlay">
      <div className="dialog">
        <h2>Great playing! 🎉</h2>
        <p className="dialog-score">You earned ⭐ {props.score}</p>
        <p className="dialog-best">Your best: {props.best}</p>
        <button className="big-btn" onClick={props.onRestart}>Play again</button>
        <Link to="/" className="big-btn home-link">🏠 Home</Link>
      </div>
    </div>
  )
}
