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
import { nextScenario, rounds, type Scenario } from './logic'
import { RightWayScene } from './RightWayScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'rightway')!
const MAX_LIVES = 3

export function RightWayGame() {
  const difficulty = useSettings((s) => s.difficulty.rightway)
  const best = useScores((s) => s.best.rightway)
  const reportScore = useScores((s) => s.reportScore)
  const total = rounds(difficulty)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('rightway')

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [scenario, setScenario] = useState<Scenario>(() => nextScenario(null))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [done, setDone] = useState(0)
  const [locked, setLocked] = useState(false)
  const [celebrate, setCelebrate] = useState(0)

  function start() {
    resetSession()
    setScenario(nextScenario(null))
    setScore(0)
    setLives(MAX_LIVES)
    setDone(0)
    setLocked(false)
    setCelebrate(0)
    setPhase('playing')
  }

  function answer(saidFine: boolean) {
    if (locked || phase !== 'playing') return
    const correct = saidFine === scenario.isFine
    setLocked(true)

    const nextScore = correct ? score + 1 : score
    const nextLives = correct ? lives : lives - 1
    const nextDone = done + 1
    setScore(nextScore)
    setLives(nextLives)
    setDone(nextDone)

    if (correct) {
      setCelebrate((c) => c + 1)
      playSuccess()
      speak(`That's right! ${scenario.explain}`)
    } else {
      playGentle()
      speak(`Let's fix it. ${scenario.explain}`)
    }
    recordStep('answer', { correct, scenarioId: scenario.id, saidFine, isFine: scenario.isFine, score: nextScore }, { score: nextScore })

    setTimeout(() => {
      if (nextLives <= 0 || nextDone >= total) {
        reportScore('rightway', nextScore)
        finishGame(nextScore)
        setPhase('over')
        return
      }
      setCelebrate(0)
      setLocked(false)
      setScenario((s) => nextScenario(s.id))
    }, 2000)
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={total} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <RightWayScene scenario={scenario} celebrate={celebrate} />
          {/* action bubble shows what is happening */}
          <div className="action-bubble">{scenario.bubble}</div>
          {celebrate > 0 && locked && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={scenario.text} />
          <div className="choice-row">
            <button className="choice-btn" disabled={locked} onClick={() => answer(true)}>
              <span className="choice-emoji">✅</span>
              <span>That's fine!</span>
            </button>
            <button className="choice-btn" disabled={locked} onClick={() => answer(false)}>
              <span className="choice-emoji">🔧</span>
              <span>Needs fixing</span>
            </button>
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
