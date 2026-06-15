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
import { makeRound, rounds, type Option, type Round } from './logic'
import { RuleFixerScene } from './RuleFixerScene'

const META = GAME_LIST.find((g) => g.id === 'rulefixer')!
const MAX_LIVES = 3

export function RuleFixerGame() {
  const difficulty = useSettings((s) => s.difficulty.rulefixer)
  const best = useScores((s) => s.best.rulefixer)
  const reportScore = useScores((s) => s.reportScore)
  const total = rounds(difficulty)

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [round, setRound] = useState<Round>(() => makeRound(null))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [done, setDone] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<'good' | 'bad' | null>(null)

  function start() {
    setRound(makeRound(null))
    setScore(0)
    setLives(MAX_LIVES)
    setDone(0)
    setPicked(null)
    setOutcome(null)
    setPhase('playing')
  }

  function choose(opt: Option) {
    if (picked || phase !== 'playing') return
    setPicked(opt.id)
    setOutcome(opt.isGood ? 'good' : 'bad')

    const nextScore = opt.isGood ? score + 1 : score
    const nextLives = opt.isGood ? lives : lives - 1
    const nextDone = done + 1
    setScore(nextScore)
    setLives(nextLives)
    setDone(nextDone)

    if (opt.isGood) {
      playSuccess()
      speak(opt.result)
    } else {
      playGentle()
      speak(opt.result)
    }

    setTimeout(() => {
      if (nextLives <= 0 || nextDone >= total) {
        reportScore('rulefixer', nextScore)
        setPhase('over')
        return
      }
      setPicked(null)
      setOutcome(null)
      setRound((r) => makeRound(r.situation.id))
    }, 2400)
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={total} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <RuleFixerScene situation={round.situation} outcome={outcome} />
          <div className="action-bubble">{round.situation.bubble}</div>
          {outcome === 'good' && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={`${round.situation.text} What should you do?`} />
          <div className="choice-row">
            {round.choices.map((opt) => (
              <button
                key={opt.id}
                className="choice-btn"
                disabled={picked !== null}
                onClick={() => choose(opt)}
              >
                <span className="choice-emoji">{opt.emoji}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
