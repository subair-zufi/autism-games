import { useEffect, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { speak } from '../../services/speech'
import { playSuccess } from '../../services/sounds'
import { CONFIG, findMeta, type FindId } from './logic'
import { ShareScene } from './ShareScene'

const META = GAME_LIST.find((g) => g.id === 'share')!

export function ShareGame() {
  const difficulty = useSettings((s) => s.difficulty.share)
  const best = useScores((s) => s.best.share)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [shared, setShared] = useState<FindId[]>([])
  const [lastShared, setLastShared] = useState<FindId | null>(null)
  const [timeLeft, setTimeLeft] = useState(config.seconds)

  function start() {
    setShared([])
    setLastShared(null)
    setTimeLeft(config.seconds)
    setPhase('playing')
  }

  // session countdown
  useEffect(() => {
    if (phase !== 'playing') return
    if (timeLeft <= 0) {
      reportScore('share', shared.length)
      speak(`Time's up! You shared ${shared.length} amazing things.`)
      setPhase('over')
      return
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timeLeft, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function share(id: FindId) {
    if (phase !== 'playing' || shared.includes(id)) return
    const meta = findMeta(id)
    const next = [...shared, id]
    setShared(next)
    setLastShared(id)
    playSuccess()
    speak(meta.react)
    if (next.length >= config.goal) {
      reportScore('share', next.length)
      setTimeout(() => {
        speak('You found and shared everything! Wonderful sharing!')
        setPhase('over')
      }, 1600)
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={shared.length} timeLeft={timeLeft} />
        <div className="game-canvas">
          <ShareScene shared={shared} lastShared={lastShared} onShare={share} />
          {lastShared && <div className="celebrate" key={lastShared}>⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner
            text={`Find something amazing and tap it to show your robot friend! Share ${config.goal} things.`}
          />
          <p className="hint-text">
            Shared {shared.length} of {config.goal}
          </p>
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={shared.length}
            best={Math.max(best, shared.length)}
            onRestart={start}
          />
        )}
      </div>
    </WebGLGate>
  )
}
