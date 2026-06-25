import { Link } from 'react-router-dom'

export function QuizResult(props: { score: number; total: number; onRestart: () => void }) {
  return (
    <div className="overlay">
      <div className="dialog">
        <h2>Great playing! 🎉</h2>
        <p className="dialog-score">You got {props.score} / {props.total}</p>
        <button className="big-btn" onClick={props.onRestart}>Play again</button>
        <Link to="/" className="big-btn home-link">🏠 Home</Link>
      </div>
    </div>
  )
}
