import { Link } from 'react-router-dom'
import type { GameMeta } from '../types'

export function ComingSoon({ game }: { game: GameMeta }) {
  return (
    <div className="start-screen">
      <div className="start-icon">{game.icon}</div>
      <h1>{game.title}</h1>
      <p>This game is coming soon!</p>
      <Link to="/" className="big-btn home-link">🏠 Home</Link>
    </div>
  )
}
