import { useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { speak } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { nextSituation, rounds, zoneMeta, type Situation, type WeatherId } from './logic'
import { WeatherScene } from './WeatherScene'

const META = GAME_LIST.find((g) => g.id === 'weather')!
const MAX_LIVES = 3

export function WeatherGame() {
  const difficulty = useSettings((s) => s.difficulty.weather)
  const best = useScores((s) => s.best.weather)
  const reportScore = useScores((s) => s.reportScore)
  const total = rounds(difficulty)

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [situation, setSituation] = useState<Situation>(() => nextSituation(difficulty, null))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [done, setDone] = useState(0)
  const [thrownAt, setThrownAt] = useState<WeatherId | null>(null)
  const [celebrate, setCelebrate] = useState(0)

  function start() {
    setSituation(nextSituation(difficulty, null))
    setScore(0)
    setLives(MAX_LIVES)
    setDone(0)
    setThrownAt(null)
    setCelebrate(0)
    setPhase('playing')
  }

  function pick(id: WeatherId) {
    if (thrownAt || phase !== 'playing') return
    setThrownAt(id)
    const correct = id === situation.weather
    const target = zoneMeta(situation.weather)

    const nextScore = correct ? score + 1 : score
    const nextLives = correct ? lives : lives - 1
    const nextDone = done + 1
    setScore(nextScore)
    setLives(nextLives)
    setDone(nextDone)

    if (correct) {
      setCelebrate((c) => c + 1)
      playSuccess()
      speak(`Yes! That feels ${target.feeling}, like ${target.label} weather!`)
    } else {
      playGentle()
      speak(`Almost. That feels ${target.feeling}, so it goes to the ${target.label} zone.`)
    }

    setTimeout(() => {
      if (nextLives <= 0 || nextDone >= total) {
        reportScore('weather', nextScore)
        setPhase('over')
        return
      }
      setThrownAt(null)
      setCelebrate(0)
      setSituation((s) => nextSituation(difficulty, s.id))
    }, 2200)
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <WeatherScene
            thrownAt={thrownAt}
            celebrate={celebrate}
            locked={thrownAt !== null}
            onPick={pick}
          />
          <div className="action-bubble">{situation.emoji}</div>
          {celebrate > 0 && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={`${situation.text} Throw the orb at the matching weather!`} />
          <p className="hint-text">☀️ Happy · 🌧️ Sad · ⛈️ Angry · 🌨️ Scared</p>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
