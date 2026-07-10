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
import { CUE, GOAL, errorType, exhibitMeta, makeRound, pointsFor, starsFor, type ExhibitId, type Round } from './logic'
import { MuseumScene } from './MuseumScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'museum')!
const MAX_LIVES = 3

export function MuseumGame() {
  const difficulty = useSettings((s) => s.difficulty.museum)
  const best = useScores((s) => s.best.museum)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('museum')
  const goal = GOAL[difficulty]
  const cue = CUE[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [round, setRound] = useState<Round>(() => makeRound(difficulty, null))
  const [score, setScore] = useState(0) // child-facing points
  const [found, setFound] = useState(0) // correct finds this session
  const [streak, setStreak] = useState(0) // consecutive first-attempt finds
  const [lives, setLives] = useState(MAX_LIVES)
  const [locked, setLocked] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<ExhibitId[]>([])
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
    setRound(makeRound(difficulty, null))
    setPhase('playing')
  }

  function handleCueReady() {
    if (cueReadyAt.current !== null) return
    cueReadyAt.current = performance.now()
    recordStep('cue_ready', { target: round.target, cue })
  }

  function pick(id: ExhibitId) {
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
        speak('You followed every point! Wonderful looking!')
        reportScore('museum', nextScore)
        finishGame(nextScore)
        setTimeout(() => setPhase('over'), 1200)
        return
      }
      speak(`Yes! The hand points at the ${exhibitMeta(id).label}!`)
      setTimeout(() => {
        cueReadyAt.current = null
        setWrongPicks([])
        setLocked(false)
        setCelebrate(0)
        setRound((r) => makeRound(difficulty, r.target))
      }, 1400)
    } else {
      playGentle()
      speak('Look again. Follow where the hand is pointing.')
      setWrongPicks((w) => [...w, id])
      setStreak(0)
      recordStep('answer', {
        correct: false,
        target: round.target,
        picked: id,
        cue,
        latencyMs,
        errorType: errorType(round.visible, round.target, id),
      })
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        setCompleted(false)
        setStars(starsFor(false, 0))
        speak('Great trying! You looked so well.')
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
        <ScoreBar score={score} lives={lives} maxLives={MAX_LIVES} progress={`${found} / ${goal}`} />
        <div className="game-canvas">
          <MuseumScene
            round={round}
            locked={locked}
            disabledIds={wrongPicks}
            celebrate={celebrate}
            cue={cue}
            onPick={pick}
            onCueReady={handleCueReady}
          />
          {celebrate > 0 && locked && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text="Tap the exhibit the hand is pointing at." />
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
