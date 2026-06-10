import { useSettings } from '../state/settings'
import type { Difficulty, GameMeta } from '../types'

const LEVELS: { id: Difficulty; label: string }[] = [
  { id: 'easy', label: 'Easy' },
  { id: 'medium', label: 'Medium' },
  { id: 'hard', label: 'Hard' },
]

export function StartScreen({ game, onStart }: { game: GameMeta; onStart: () => void }) {
  const difficulty = useSettings((s) => s.difficulty[game.id])
  const setDifficulty = useSettings((s) => s.setDifficulty)
  return (
    <div className="start-screen">
      <div className="start-icon">{game.icon}</div>
      <h1>{game.title}</h1>
      <div className="level-row">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            className={difficulty === l.id ? 'level-btn selected' : 'level-btn'}
            onClick={() => setDifficulty(game.id, l.id)}
          >
            {l.label}
          </button>
        ))}
      </div>
      <button className="big-btn" onClick={onStart}>▶ Play</button>
    </div>
  )
}
