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
import { makeRound, objectMeta, type ObjectId, type Round } from './logic'
import { GardenScene } from './GardenScene'

const META = GAME_LIST.find((g) => g.id === 'garden')!
const MAX_LIVES = 3

export function GardenGame() {
  const difficulty = useSettings((s) => s.difficulty.garden)
  const best = useScores((s) => s.best.garden)
  const reportScore = useScores((s) => s.reportScore)

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [round, setRound] = useState<Round>(() => makeRound(difficulty, null))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [locked, setLocked] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<ObjectId[]>([])
  const [celebrate, setCelebrate] = useState(0)

  function start() {
    setScore(0)
    setLives(MAX_LIVES)
    setWrongPicks([])
    setLocked(false)
    setCelebrate(0)
    setRound(makeRound(difficulty, null))
    setPhase('playing')
  }

  function pick(id: ObjectId) {
    if (locked || wrongPicks.includes(id)) return
    if (id === round.target) {
      setLocked(true)
      setCelebrate((c) => c + 1)
      playSuccess()
      speak(`Yes! The hand points at the ${objectMeta(id).label}!`)
      setScore((s) => s + 1)
      setTimeout(() => {
        setWrongPicks([])
        setLocked(false)
        setRound((r) => makeRound(difficulty, r.target))
      }, 1400)
    } else {
      playGentle()
      speak("Let's look again. Where is the hand pointing?")
      setWrongPicks((w) => [...w, id])
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        reportScore('garden', score)
        setPhase('over')
      }
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <GardenScene target={round.target} celebrate={celebrate} />
        </div>
        <div className="game-bottom">
          <PromptBanner text="What is the hand pointing at?" />
          <div className="choice-row">
            {round.choices.map((id) => {
              const m = objectMeta(id)
              return (
                <button
                  key={id}
                  className="choice-btn"
                  disabled={locked || wrongPicks.includes(id)}
                  onClick={() => pick(id)}
                >
                  <span className="choice-emoji">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
