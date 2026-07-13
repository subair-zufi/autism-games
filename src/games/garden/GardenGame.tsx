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
import { t } from '../../i18n/strings'
import { playGentle, playSuccess } from '../../services/sounds'
import {
  CUE_LADDER,
  FADE_STREAK,
  GOAL,
  START_TIER,
  errorType,
  fadedTier,
  makeRound,
  pointsFor,
  starsFor,
  supportedTier,
  type ObjectId,
  type Round,
} from './logic'
import { gardenLine, gardenObjectLabel } from './strings'
import { GardenScene } from './GardenScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'garden')!

export function GardenGame() {
  const difficulty = useSettings((s) => s.difficulty.garden)
  const lang = useSettings((s) => s.language)
  const best = useScores((s) => s.best.garden)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('garden')
  const goal = GOAL[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  /** rung on the prompt-fading ladder — starts at the difficulty's entry rung,
   * thins with success streaks, regains one rung of support after an error */
  const [tier, setTier] = useState(() => START_TIER[difficulty])
  const cue = CUE_LADDER[tier]
  const [round, setRound] = useState<Round>(() => makeRound(null))
  const [score, setScore] = useState(0) // child-facing points
  const [found, setFound] = useState(0) // correct finds this session
  const [firstTries, setFirstTries] = useState(0) // finds made on the first attempt
  const [streak, setStreak] = useState(0) // consecutive first-attempt finds
  const [locked, setLocked] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<ObjectId[]>([])
  const [celebrate, setCelebrate] = useState(0)
  const [stars, setStars] = useState(0)
  /** timestamp of the moment the pointing cue settled on the target (latency zero-point) */
  const cueReadyAt = useRef<number | null>(null)

  // Malayalam-aware speech + level captions (surface the cue-fading ladder).
  const say = (key: Parameters<typeof gardenLine>[0], params?: Record<string, string>) =>
    speak(gardenLine(key, lang, params), lang)
  const levelNotes = {
    easy: gardenLine('noteEasy', lang),
    medium: gardenLine('noteMedium', lang),
    hard: gardenLine('noteHard', lang),
  }

  function start() {
    resetSession()
    setTier(START_TIER[difficulty])
    setScore(0)
    setFound(0)
    setFirstTries(0)
    setStreak(0)
    setWrongPicks([])
    setLocked(false)
    setCelebrate(0)
    setStars(0)
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
      const nextFirstTries = firstTries + (firstAttempt ? 1 : 0)
      setLocked(true)
      setCelebrate((c) => c + 1)
      playSuccess()
      setScore(nextScore)
      setFound(nextFound)
      setFirstTries(nextFirstTries)
      setStreak(nextStreak)
      recordStep(
        'answer',
        { correct: true, target: round.target, picked: id, cue, firstAttempt, latencyMs, points, score: nextScore, found: nextFound },
        { score: nextScore },
      )
      if (nextFound >= goal) {
        setStars(starsFor(nextFirstTries, goal))
        say('sayWin')
        reportScore('garden', nextScore)
        finishGame(nextScore)
        setTimeout(() => setPhase('over'), 1200)
        return
      }
      say('sayCorrect', { label: gardenObjectLabel(id, lang) })
      setTimeout(() => {
        cueReadyAt.current = null
        setWrongPicks([])
        setLocked(false)
        // prompt fading: every FADE_STREAK-th consecutive independent find
        // thins the cue one rung (pulse -> hover -> distal -> gaze)
        if (nextStreak > 0 && nextStreak % FADE_STREAK === 0) setTier((t) => fadedTier(t))
        setRound((r) => makeRound(r.target))
      }, 1400)
    } else {
      // No-fail: a wrong tap is gently corrected and the child keeps trying —
      // the session never ends on a mistake.
      playGentle()
      say('sayWrong')
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
      // least-to-most: an error immediately brings one rung of support back
      // (the retry happens under the easier cue, recorded as such)
      setTier((t) => supportedTier(t, difficulty))
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} levelNotes={levelNotes} />

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} progress={`${found} / ${goal}`} />
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
          <PromptBanner text={gardenLine('prompt', lang)} lang={lang} />
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={score}
            best={Math.max(best, score)}
            stars={stars}
            message={t('greatPlaying', lang)}
            lang={lang}
            onRestart={start}
          />
        )}
      </div>
    </WebGLGate>
  )
}
