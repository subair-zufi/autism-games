import { useEffect, useMemo, useRef, useState } from 'react'
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
  FADE_STREAK,
  GOAL,
  START_TIER,
  cueSchedule,
  errorType,
  fadedTier,
  makeRound,
  pointsFor,
  slotHeadingDeg,
  starsFor,
  supportedTier,
  trialCue,
  type ExhibitId,
  type Round,
} from './logic'
import { useLevelProgress } from '../progression'
import { museum360Line, exhibitLabel } from './strings'
import { Museum360Scene } from './Museum360Scene'
import { xrStore, vrSupported } from './xrStore'
import { useVrSessionActive } from '../vrSession'
import { VRWaitingRoom } from '../VRWaitingRoom'
import { useVrGameOverPanel } from '../gameOverPanel'
import { useGameAnalytics } from '../useGameAnalytics'
import { beginHeadWindow, headMetrics } from '../headTracking'
import { VRPracticeScene } from '../vrPractice/VRPracticeScene'

const META = GAME_LIST.find((g) => g.id === 'museum360')!

/** the child's head-turn to reach the target, in degrees left(−)/right(+) of
 * straight-ahead — recorded per trial so analysis can relate performance to
 * how far the child had to shift attention (an edge target is a bigger turn
 * than a central one) */
function targetBearingDeg(round: Round): number {
  const idx = round.visible.indexOf(round.target)
  return slotHeadingDeg(idx, round.visible.length)
}

export function Museum360Game() {
  const difficulty = useSettings((s) => s.difficulty.museum360)
  const lang = useSettings((s) => s.language)
  const inputMethod = useSettings((s) => s.inputMethod)
  const vrPracticeDone = useSettings((s) => s.vrPracticeDone)
  const setVrPracticeDone = useSettings((s) => s.setVrPracticeDone)
  const best = useScores((s) => s.best.museum360)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('museum360', xrStore)
  // Per-level progression: a finished session reports first-attempt finds out
  // of the level's goal, the same numerator `starsFor` and the server's
  // `_pointing_trials` already treat as success.
  const { submit } = useLevelProgress('museum360')
  const goal = GOAL[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  /** rung on the hand's prompt-fading ladder — starts at the difficulty's entry
   * rung, thins with success streaks, regains one rung of support after an error */
  const [tier, setTier] = useState(() => START_TIER[difficulty])
  const [round, setRound] = useState<Round>(() => makeRound(difficulty, null))
  const [score, setScore] = useState(0) // child-facing points
  const [found, setFound] = useState(0) // correct finds this session
  const [firstTries, setFirstTries] = useState(0) // finds made on the first attempt
  const [streak, setStreak] = useState(0) // consecutive first-attempt finds
  const [locked, setLocked] = useState(false)
  const [wrongPicks, setWrongPicks] = useState<ExhibitId[]>([])
  const [celebrate, setCelebrate] = useState(0)
  const [stars, setStars] = useState(0)
  /** the one-time "drag to look around" hint, dismissed on the first look */
  const [hintSeen, setHintSeen] = useState(false)
  /** whether this browser can enter immersive VR (Quest etc.) — shows the button */
  const [canVR, setCanVR] = useState(false)
  /** whether the headset is actually presenting right now, vs. the flat pre-VR screen */
  const vrActive = useVrSessionActive(xrStore)
  /** The child selects by gaze right now — inside a headset with the default
   *  dwell method — so the prompt verb is "look", not "tap". Flat screen (mouse)
   *  and the VR controller ray both keep "tap". */
  const gazeSelect = vrActive && inputMethod === 'dwell'
  /** Play was pressed on a VR-capable browser, but the session hasn't started
   *  yet — held here instead of calling `start()` so the round never begins
   *  on the flat screen before the child is actually in the headset. */
  const [awaitingVr, setAwaitingVr] = useState(false)
  /** timestamp of the moment the pointing cue settled on the target (latency zero-point) */
  const cueReadyAt = useRef<number | null>(null)
  /** last pick, to swallow duplicate click events — the XR layer forwards
   * HTML events alongside r3f's own, so one tap can reach pick() twice */
  const lastPick = useRef<{ id: ExhibitId; at: number } | null>(null)

  useEffect(() => {
    void vrSupported().then(setCanVR)
  }, [])

  // The moment the child actually enters VR after Play was pressed on a
  // capable browser — this is the one true start signal on that path.
  useEffect(() => {
    if (awaitingVr && vrActive) {
      setAwaitingVr(false)
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingVr, vrActive])

  // Results stay inside VR. Ending the session here (as this used to) is
  // what dropped the child into the Quest home environment with no window
  // to come back to — every completed game, not just Quit.
  useVrGameOverPanel({
    over: phase === 'over',
    headline: t('greatPlaying', lang),
    score,
    best: Math.max(best, score),
    stars,
    lang,
    gameId: 'museum360',
    level: difficulty,
    onRestart: handlePlayPress,
  })

  // Which trials show the gaze doll vs the pointing hand — a fixed, evenly-spread
  // share of gaze trials per session, same schedule as Museum Look.
  const schedule = useMemo(() => cueSchedule(difficulty), [difficulty])
  const cueKind = schedule[Math.min(found, schedule.length - 1)]
  const cue = trialCue(cueKind, tier, wrongPicks.length > 0)
  // The prompt names the cue the child should follow this trial, so a pointing
  // trial and a look-only trial ask for different things instead of one vague
  // line. A missed gaze trial that falls back to the hand reads as pointing.
  // The gaze-select variant swaps the closing "tap" for "look" (see gazeSelect).
  const promptKey = gazeSelect
    ? cue === 'gaze'
      ? 'promptLookGaze'
      : 'promptPointGaze'
    : cue === 'gaze'
      ? 'promptLook'
      : 'promptPoint'

  // Malayalam-aware speech + level captions (surface the cue-fading ladder).
  const say = (key: Parameters<typeof museum360Line>[0], params?: Record<string, string>) =>
    speak(museum360Line(key, lang, params), lang)
  const levelNotes = {
    easy: museum360Line('noteEasy', lang),
    medium: museum360Line('noteMedium', lang),
    hard: museum360Line('noteHard', lang),
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
    setHintSeen(false)
    cueReadyAt.current = null
    setRound(makeRound(difficulty, null))
    setPhase('playing')
  }

  /** Play button handler: on a VR-capable browser, wait for the child to
   *  actually enter VR before `start()` runs (see the effect above). */
  function handlePlayPress() {
    if (canVR && !vrActive) {
      setAwaitingVr(true)
      return
    }
    start()
  }

  function handleCueReady() {
    if (cueReadyAt.current !== null) return
    cueReadyAt.current = performance.now()
    // open the head-telemetry window at cue onset — the child's scan to the
    // target is measured from here (same zero-point as the latency)
    beginHeadWindow()
    recordStep('cue_ready', { target: round.target, cue, cueKind, targetBearingDeg: targetBearingDeg(round) })
  }

  function pick(id: ExhibitId) {
    const now = performance.now()
    if (lastPick.current && lastPick.current.id === id && now - lastPick.current.at < 250) return
    lastPick.current = { id, at: now }
    if (locked || wrongPicks.includes(id)) return
    // latency from cue arrival, not round start, so the hand's travel time never
    // inflates it — in 360 the latency *includes* the time spent turning to look,
    // which is exactly the attention-shift the game measures
    const latencyMs = cueReadyAt.current === null ? null : Math.round(performance.now() - cueReadyAt.current)
    // what the child's head actually did between cue onset and this tap
    const head = headMetrics(targetBearingDeg(round))
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
        // visibleCount drives the guessing baseline server-side (1/n), same as Museum Look
        { correct: true, target: round.target, picked: id, cue, cueKind, visibleCount: round.visible.length, targetBearingDeg: targetBearingDeg(round), firstAttempt, latencyMs, ...head, points, score: nextScore, found: nextFound },
        { score: nextScore },
      )
      if (nextFound >= goal) {
        setStars(starsFor(nextFirstTries, goal))
        say('sayWin')
        reportScore('museum360', nextScore)
        void submit(difficulty, nextFirstTries, goal)
        finishGame(nextScore)
        setTimeout(() => setPhase('over'), 1200)
        return
      }
      say('sayCorrect', { label: exhibitLabel(id, lang) })
      // short pause: long enough for the star + wobble to land, short enough
      // that the next trial doesn't feel laggy (Quest pilot feedback)
      setTimeout(() => {
        cueReadyAt.current = null
        setWrongPicks([])
        setLocked(false)
        setCelebrate(0)
        // prompt fading: every FADE_STREAK-th consecutive independent find
        // thins the cue one rung (pulse -> hover -> distal -> gaze)
        if (nextStreak > 0 && nextStreak % FADE_STREAK === 0) setTier((t) => fadedTier(t))
        setRound((r) => makeRound(difficulty, r.target))
      }, 1000)
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
        cueKind,
        visibleCount: round.visible.length,
        targetBearingDeg: targetBearingDeg(round),
        latencyMs,
        ...head,
        errorType: errorType(round.visible, round.target, id),
      })
      // least-to-most: an error immediately brings one rung of support back
      // (the retry happens under the easier cue, recorded as such)
      setTier((t) => supportedTier(t, difficulty))
    }
  }

  // one-time, unscored warm-up before this child's very first real session
  // (review U2): teaches the headset look-around + tap gesture. Shown only
  // when the browser can actually enter immersive VR — on a flat desktop
  // there's no headset novelty and it's just friction, so it's skipped.
  if (canVR && !vrPracticeDone) return <VRPracticeScene onComplete={() => setVrPracticeDone(true)} />

  if (phase === 'start' && !awaitingVr) {
    return <StartScreen game={META} onStart={handlePlayPress} levelNotes={levelNotes} />
  }

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} progress={`${found} / ${goal}`} />
        <div className="game-canvas" onPointerDown={() => setHintSeen(true)}>
          <Museum360Scene
            round={round}
            active={!awaitingVr}
            locked={locked}
            disabledIds={wrongPicks}
            celebrate={celebrate}
            cue={cue}
            onPick={pick}
            onCueReady={handleCueReady}
            hudScore={`⭐ ${score} · 🔍 ${found} / ${goal}`}
            hudPrompt={museum360Line(promptKey, lang)}
            hudQuit={t('vrQuit', lang)}
          />
          {!hintSeen && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '14%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: 24,
                fontSize: '1.05rem',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              👈 {lang === 'ml' ? 'ഇടത്തോട്ടും വലത്തോട്ടും വലിച്ചു നോക്കൂ' : 'Drag to look left and right'} 👉
            </div>
          )}
          {celebrate > 0 && locked && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={museum360Line(promptKey, lang)} lang={lang} />
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={score}
            best={Math.max(best, score)}
            stars={stars}
            message={t('greatPlaying', lang)}
            lang={lang}
            onRestart={handlePlayPress}
            onChooseLevel={() => setPhase('start')}
          />
        )}
        {awaitingVr && (
          <VRWaitingRoom
            store={xrStore}
            accent="rgba(14, 165, 233, 0.92)"
            label={lang === 'ml' ? 'VR-ൽ കളിക്കൂ' : 'Enter VR'}
            lang={lang}
          />
        )}
      </div>
    </WebGLGate>
  )
}
