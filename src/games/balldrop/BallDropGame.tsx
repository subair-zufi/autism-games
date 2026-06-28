import { useRef, useState } from 'react'
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
import { BOX_COLORS, GOAL, boxesFor, pickTarget, type ColorId } from './logic'
import { BallDropScene } from './BallDropScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'balldrop')!
const MAX_LIVES = 3

function metaOf(id: ColorId) {
  return BOX_COLORS.find((c) => c.id === id)!
}

export function BallDropGame() {
  const difficulty = useSettings((s) => s.difficulty.balldrop)
  const best = useScores((s) => s.best.balldrop)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('balldrop')
  const goal = GOAL[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [boxes, setBoxes] = useState<ColorId[]>(() => boxesFor(difficulty))
  const [target, setTarget] = useState<ColorId>(() => pickTarget(boxesFor(difficulty), null))
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [locked, setLocked] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [confetti, setConfetti] = useState<{ color: ColorId; trigger: number }>({
    color: 'red',
    trigger: 0,
  })

  const mode = difficulty === 'easy' ? 'tap' : 'drag'

  function start() {
    resetSession()
    const b = boxesFor(difficulty)
    setBoxes(b)
    setTarget(pickTarget(b, null))
    setScore(0)
    setLives(MAX_LIVES)
    setLocked(false)
    setResetKey((k) => k + 1)
    setConfetti({ color: 'red', trigger: 0 })
    setPhase('playing')
  }

  // StrictMode mounts the scene twice in dev, so a single drop can report
  // twice; accept only the first landing per round
  const landedRound = useRef(-1)

  function handleLand(box: ColorId) {
    if (landedRound.current === resetKey) return
    landedRound.current = resetKey
    if (box === target) {
      setLocked(true)
      playSuccess()
      const nextScore = score + 1
      setScore(nextScore)
      recordStep('answer', { correct: true, target, box, score: nextScore }, { score: nextScore })
      setConfetti((c) => ({ color: box, trigger: c.trigger + 1 }))
      if (nextScore >= goal) {
        speak('You did it! All the balls are home!')
        reportScore('balldrop', nextScore)
        finishGame(nextScore)
        setTimeout(() => setPhase('over'), 1400)
        return
      }
      speak(`Wonderful! That's the ${metaOf(box).label} box!`)
      setTimeout(() => {
        setTarget((t) => pickTarget(boxes, t))
        setResetKey((k) => k + 1)
        setLocked(false)
      }, 1500)
    } else {
      playGentle()
      speak(`That's the ${metaOf(box).label} box. Let's find the ${metaOf(target).label} box.`)
      const next = lives - 1
      setLives(next)
      recordStep('answer', { correct: false, target, box })
      if (next <= 0) {
        reportScore('balldrop', score)
        finishGame(score)
        setPhase('over')
      } else {
        setLocked(true)
        setTimeout(() => {
          setResetKey((k) => k + 1)
          setLocked(false)
        }, 1300)
      }
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  const targetMeta = metaOf(target)
  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={goal} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <BallDropScene
            boxes={boxes}
            mode={mode}
            disabled={locked || phase !== 'playing'}
            resetKey={resetKey}
            confetti={confetti}
            onLand={handleLand}
          />
        </div>
        <div className="game-bottom">
          <PromptBanner
            text={`Drop the ball in the ${targetMeta.label} box.`}
            swatch={targetMeta.hex}
          />
          {mode === 'drag' && <p className="hint-text">Drag the ball over a box, then let go!</p>}
          {mode === 'tap' && <p className="hint-text">Tap the right box!</p>}
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
