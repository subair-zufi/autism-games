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
import { CUE, GOAL, errorType, makeRound, objectMeta, pointsFor, starsFor, type ObjectId, type Round } from './logic'
import { GardenScene } from './GardenScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'garden')!
const MAX_LIVES = 3

export function GardenGame() {
  const difficulty = useSettings((s) => s.difficulty.garden)
  const best = useScores((s) => s.best.garden)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('garden')
  const goal = GOAL[difficulty]
  const cue = CUE[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [round, setRound] = useState<Round>(() => makeRound(null))
  const [score, setScore] = useState(0) // child-facing points
  const [found, setFound] = useState(0) // correct finds this session
  const [streak, setStreak] = useState(0) // consecutive first-attempt finds
  const [lives, setLives] = useState(MAX_LIVES)
  const [locked, setLocked] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<ObjectId[]>([])
  const [celebrate, setCelebrate] = useState(0)
  const [stars, setStars] = useState(0)
  const [completed, setCompleted] = useState(false)
  /** timestamp of the moment the pointing cue settled on the target (latency zero-point) */
  const cueReadyAt = useRef<number | null>(null)

  function start() {
    resetSession()
    setScore(0)
    setFound(0)
    setStreak(0)
    setLives(MAX_LIVES)
    setWrongPicks([])
    setLocked(false)
    setCelebrate(0)
    setStars(0)
    setCompleted(false)
    cueReadyAt.current = null
    setRound(makeRound(null))
    setPhase('playing')
  }

  function handleCueReady() {
    if (cueReadyAt.current !== null) return
    cueReadyAt.current = performance.now()
    recordStep('cue_ready', { target: round.target, cue })
  }

  function pick(id: ObjectId) {
    if (locked || wrongPicks.includes(id)) return
    // latency from cue arrival, not round start, so the hand's travel time never inflates it
    const latencyMs = cueReadyAt.current === null ? null : Math.round(performance.now() - cueReadyAt.current)
    if (id === round.target) {
      const firstAttempt = wrongPicks.length === 0
      const nextStreak = firstAttempt ? streak + 1 : 0
      const points = pointsFor(firstAttempt, nextStreak)
      const nextScore = score + points
      const nextFound = found + 1
      setLocked(true)
      setCelebrate((c) => c + 1)
      playSuccess()
      setScore(nextScore)
      setFound(nextFound)
      setStreak(nextStreak)
      recordStep(
        'answer',
        { correct: true, target: round.target, picked: id, cue, firstAttempt, latencyMs, points, score: nextScore, found: nextFound },
        { score: nextScore },
      )
      if (nextFound >= goal) {
        setCompleted(true)
        setStars(starsFor(true, lives))
        speak('You found them all! Wonderful looking!')
        reportScore('garden', nextScore)
        finishGame(nextScore)
        setTimeout(() => setPhase('over'), 1200)
        return
      }
      speak(`Yes! The ${objectMeta(id).label}!`)
      setTimeout(() => {
        cueReadyAt.current = null
        setWrongPicks([])
        setLocked(false)
        setRound((r) => makeRound(r.target))
      }, 1400)
    } else {
      playGentle()
      speak("Let's look again. Where is the hand pointing?")
      setWrongPicks((w) => [...w, id])
      setStreak(0)
      recordStep('answer', {
        correct: false,
        target: round.target,
        picked: id,
        cue,
        latencyMs,
        errorType: errorType(round.target, id),
      })
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        setCompleted(false)
        setStars(starsFor(false, 0))
        speak('Great trying! You looked so well.')
        reportScore('garden', score)
        finishGame(score)
        setPhase('over')
      }
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} lives={lives} maxLives={MAX_LIVES} progress={`${found} / ${goal}`} />
        <div className="game-canvas">
          <GardenScene
            target={round.target}
            celebrate={celebrate}
            cue={cue}
            onPick={pick}
            onCueReady={handleCueReady}
          />
        </div>
        <div className="game-bottom">
          <PromptBanner text="Tap what the hand is pointing at!" />
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={score}
            best={Math.max(best, score)}
            stars={stars}
            message={completed ? 'Great playing! 🎉' : 'Great trying! 🌟'}
            onRestart={start}
          />
        )}
      </div>
    </WebGLGate>
  )
}
