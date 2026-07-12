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
import { CUE, GOAL, errorType, makeRound, pointsFor, starsFor, type ExhibitId, type Round } from './logic'
import { museumLine, exhibitLabel } from './strings'
import { MuseumScene } from './MuseumScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'museum')!

export function MuseumGame() {
  const difficulty = useSettings((s) => s.difficulty.museum)
  const lang = useSettings((s) => s.language)
  const best = useScores((s) => s.best.museum)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('museum')
  const goal = GOAL[difficulty]
  const cue = CUE[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [round, setRound] = useState<Round>(() => makeRound(difficulty, null))
  const [score, setScore] = useState(0) // child-facing points
  const [found, setFound] = useState(0) // correct finds this session
  const [firstTries, setFirstTries] = useState(0) // finds made on the first attempt
  const [streak, setStreak] = useState(0) // consecutive first-attempt finds
  const [locked, setLocked] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<ExhibitId[]>([])
  const [celebrate, setCelebrate] = useState(0)
  const [stars, setStars] = useState(0)
  /** timestamp of the moment the pointing cue settled on the target (latency zero-point) */
  const cueReadyAt = useRef<number | null>(null)

  // Malayalam-aware speech + level captions (surface the cue-fading ladder).
  const say = (key: Parameters<typeof museumLine>[0], params?: Record<string, string>) =>
    speak(museumLine(key, lang, params), lang)
  const levelNotes = {
    easy: museumLine('noteEasy', lang),
    medium: museumLine('noteMedium', lang),
    hard: museumLine('noteHard', lang),
  }

  function start() {
    resetSession()
    setScore(0)
    setFound(0)
    setFirstTries(0)
    setStreak(0)
    setWrongPicks([])
    setLocked(false)
    setCelebrate(0)
    setStars(0)
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
        reportScore('museum', nextScore)
        finishGame(nextScore)
        setTimeout(() => setPhase('over'), 1200)
        return
      }
      say('sayCorrect', { label: exhibitLabel(id, lang) })
      setTimeout(() => {
        cueReadyAt.current = null
        setWrongPicks([])
        setLocked(false)
        setCelebrate(0)
        setRound((r) => makeRound(difficulty, r.target))
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
        errorType: errorType(round.visible, round.target, id),
      })
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} levelNotes={levelNotes} />

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} progress={`${found} / ${goal}`} />
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
          <PromptBanner text={museumLine('prompt', lang)} lang={lang} />
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
