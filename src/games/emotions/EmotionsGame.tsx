import { useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { speak } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { EMOTIONS, makeRound, type EmotionId, type Round } from './logic'

const META = GAME_LIST.find((g) => g.id === 'emotions')!
const MAX_LIVES = 3

export function EmotionsGame() {
  const difficulty = useSettings((s) => s.difficulty.emotions)
  const best = useScores((s) => s.best.emotions)
  const reportScore = useScores((s) => s.reportScore)

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [round, setRound] = useState<Round>(() => makeRound(difficulty, null))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [locked, setLocked] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<EmotionId[]>([])
  const [celebrating, setCelebrating] = useState(false)

  function start() {
    setScore(0)
    setLives(MAX_LIVES)
    setWrongPicks([])
    setLocked(false)
    setCelebrating(false)
    setRound(makeRound(difficulty, null))
    setPhase('playing')
  }

  function pick(id: EmotionId) {
    if (locked || wrongPicks.includes(id)) return
    const meta = EMOTIONS.find((e) => e.id === id)!
    if (id === round.target) {
      setLocked(true)
      setCelebrating(true)
      playSuccess()
      speak(`Great! That's ${meta.label}!`)
      setScore((s) => s + 1)
      setTimeout(() => {
        setCelebrating(false)
        setWrongPicks([])
        setLocked(false)
        setRound((r) => makeRound(difficulty, r.target))
      }, 1400)
    } else {
      playGentle()
      speak("Let's look again.")
      setWrongPicks((w) => [...w, id])
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        reportScore('emotions', score)
        setPhase('over')
      }
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <div className="game-page">
      <ScoreBar score={score} lives={lives} maxLives={MAX_LIVES} />
      <div className="game-canvas">
        <img
          className="emotion-display-img"
          src={round.imageMap[round.target]}
          alt="How does this face feel?"
        />
        {celebrating && <div className="celebrate">⭐</div>}
      </div>
      <div className="game-bottom">
        <PromptBanner text="How does this face feel?" />
        <div className="choice-row">
          {round.choices.map((id) => {
            const m = EMOTIONS.find((e) => e.id === id)!
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
  )
}
