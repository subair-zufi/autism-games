import { Link } from 'react-router-dom'
import { GAME_LIST } from '../types'
import { useScores } from '../state/scores'
import { useSettings } from '../state/settings'
import { playTap } from '../services/sounds'

export function Home() {
  const best = useScores((s) => s.best)
  const voiceOn = useSettings((s) => s.voiceOn)
  const soundOn = useSettings((s) => s.soundOn)
  const setVoiceOn = useSettings((s) => s.setVoiceOn)
  const setSoundOn = useSettings((s) => s.setSoundOn)

  return (
    <div className="home">
      <header className="home-header">
        <h1>Autism Games</h1>
        <p>Pick a game to play!</p>
      </header>
      <div className="card-grid">
        {GAME_LIST.map((g) => (
          <Link
            key={g.id}
            to={g.path}
            className="game-card"
            style={{ '--card-accent': g.color } as React.CSSProperties}
            onClick={() => playTap()}
          >
            <span className="card-icon">{g.icon}</span>
            <span className="card-title">{g.title}</span>
            <span className="card-best">⭐ Best: {best[g.id]}</span>
          </Link>
        ))}
      </div>
      <div className="settings-row">
        <button className={voiceOn ? 'toggle on' : 'toggle'} onClick={() => setVoiceOn(!voiceOn)}>
          🔊 Voice {voiceOn ? 'On' : 'Off'}
        </button>
        <button className={soundOn ? 'toggle on' : 'toggle'} onClick={() => setSoundOn(!soundOn)}>
          🎵 Sounds {soundOn ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  )
}
