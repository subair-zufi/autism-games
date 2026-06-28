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
import { exhibitMeta, makeRound, type ExhibitId, type Round } from './logic'
import { MuseumScene } from './MuseumScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'museum')!
const MAX_LIVES = 3

export function MuseumGame() {
  const difficulty = useSettings((s) => s.difficulty.museum)
  const best = useScores((s) => s.best.museum)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('museum')

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [round, setRound] = useState<Round>(() => makeRound(difficulty, null))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [locked, setLocked] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<ExhibitId[]>([])
  const [celebrate, setCelebrate] = useState(0)

  function start() {
    resetSession()
    setScore(0)
    setLives(MAX_LIVES)
    setWrongPicks([])
    setLocked(false)
    setCelebrate(0)
    setRound(makeRound(difficulty, null))
    setPhase('playing')
  }

  function pick(id: ExhibitId) {
    if (locked || wrongPicks.includes(id)) return
    const meta = exhibitMeta(id)
    if (id === round.target) {
      setLocked(true)
      setCelebrate((c) => c + 1)
      playSuccess()
      speak(`Yes! The hand points at the ${meta.label}!`)
      setScore((s) => s + 1)
      recordStep('answer', { correct: true, target: round.target, score: score + 1 }, { score: score + 1 })
      setTimeout(() => {
        setWrongPicks([])
        setLocked(false)
        setCelebrate(0)
        setRound((r) => makeRound(difficulty, r.target))
      }, 1400)
    } else {
      playGentle()
      speak('Look again. Follow where the hand is pointing.')
      setWrongPicks((w) => [...w, id])
      const next = lives - 1
      setLives(next)
      recordStep('answer', { correct: false, target: round.target, picked: id })
      if (next <= 0) {
        reportScore('museum', score)
        finishGame(score)
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
          <MuseumScene
            round={round}
            locked={locked}
            disabledIds={wrongPicks}
            celebrate={celebrate}
            onPick={pick}
          />
          {celebrate > 0 && locked && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text="Tap the exhibit the hand is pointing at." />
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
