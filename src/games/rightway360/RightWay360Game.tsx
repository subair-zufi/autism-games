import { useEffect, useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { speak } from '../../services/speech'
import { t, type Lang } from '../../i18n/strings'
import { playGentle, playSuccess } from '../../services/sounds'
import {
  buildLevel,
  CHANCE,
  pointsFor,
  scoreLevel,
  stageBearings,
  stagingFor,
  starsFor,
  tallyByConstruct,
  tallyByValence,
  type Behavior,
  type Construct,
} from './logic'
import { IS_IT_OKAY, yardLine } from './strings'
import { RightWay360Scene } from './RightWay360Scene'
import { xrStore, vrSupported } from './xrStore'
import { EnterVRButton } from '../EnterVRButton'
import { useVrGameOverPanel } from '../gameOverPanel'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'rightway360')!

/** how long the reveal + spoken explanation hold before the next scene —
 *  the explanations are full sentences, so this is longer than the other
 *  360 games' feedback beat */
const FEEDBACK_MS = 4200
/** calm beat before the next scene appears */
const ROUND_GAP_MS = 800

interface Answer {
  construct: Construct
  isFine: boolean
  correct: boolean
}

/**
 * Schoolyard 360 — the immersive copy of Right or Wrong. Same item bank, level
 * recipe (clear/subtle stimulus tiers), two-thumb response set (chance 1/2)
 * and per-construct/per-valence measurement as the flat game — but instead of
 * a frozen picture, the two kids ACT OUT the behaviour at a sampled bearing
 * across the front arc, and the child turns the view — a head turn in VR — to
 * find and watch the scene, then taps an in-world 👍/👎 card. Every answer
 * additionally records the stage's signed bearing (the 360 attention-shift
 * measure shared with the other 360 games).
 */
export function RightWay360Game() {
  const difficulty = useSettings((s) => s.difficulty.rightway360)
  const lang = useSettings((s) => s.language)
  const best = useScores((s) => s.best.rightway360)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('rightway360')

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [trials, setTrials] = useState<Behavior[]>([])
  const [bearings, setBearings] = useState<number[]>([])
  const [idx, setIdx] = useState(0)
  const [active, setActive] = useState(false)
  const [picked, setPicked] = useState<boolean | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [score, setScore] = useState(0)
  const [stars, setStars] = useState(0)
  /** the one-time "drag to look around" hint, dismissed on the first look */
  const [hintSeen, setHintSeen] = useState(false)
  /** whether this browser can enter immersive VR (Quest etc.) — shows the button */
  const [canVR, setCanVR] = useState(false)

  /** when the scene became answerable — decision latency runs from here */
  const readyAt = useRef<number | null>(null)
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    void vrSupported().then(setCanVR)
  }, [])

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
    gameId: 'rightway360',
    level: difficulty,
    onRestart: start,
  })

  function clearTimers() {
    for (const timer of [gapTimer, advanceTimer]) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }
  }

  function start() {
    resetSession()
    clearTimers()
    setScore(0)
    setStars(0)
    setAnswers([])
    const built = buildLevel(difficulty, Math.random)
    setTrials(built)
    setBearings(stageBearings(built.length))
    setIdx(0)
    setPhase('playing')
    beginTrial(built, 0)
  }

  function beginTrial(seq: Behavior[], i: number) {
    clearTimers()
    setPicked(null)
    setActive(false)
    readyAt.current = null
    // a calm beat, then the scene starts acting and the question is asked
    gapTimer.current = setTimeout(() => {
      setActive(true)
      readyAt.current = performance.now()
      const trial = seq[i]
      speak(promptFor(trial, lang), lang)
      recordStep('event_ready', {
        behaviorId: trial.id,
        construct: trial.construct,
        tier: trial.tier,
        isFine: trial.isFine,
        // how far the child must turn to face the acted-out scene — the 360
        // games' attention-shift measure (signed degrees left/right)
        stageBearingDeg: stageBearingsAt(i),
      })
    }, ROUND_GAP_MS)
  }

  function stageBearingsAt(i: number): number {
    return bearings[i] ?? 0
  }

  function pick(saidFine: boolean) {
    const trial = trials[idx]
    if (!active || picked !== null || !trial) return
    clearTimers()
    const correct = saidFine === trial.isFine
    const latencyMs = readyAt.current === null ? null : Math.round(performance.now() - readyAt.current)
    setPicked(saidFine)
    // threaded explicitly (not read back from state) so the session summary
    // never misses the final answer to a stale closure
    const nextAnswers: Answer[] = [...answers, { construct: trial.construct, isFine: trial.isFine, correct }]
    setAnswers(nextAnswers)
    const nextScore = score + pointsFor(correct)
    setScore(nextScore)

    // the spoken explanation is the feedback, same wording as the flat game
    if (correct) playSuccess()
    else playGentle()
    speak(trial.explain[lang], lang)

    // same answer payload as the flat game (feeds the same server scoring),
    // plus the 360-only stage bearing
    recordStep(
      'answer',
      {
        behaviorId: trial.id,
        construct: trial.construct,
        tier: trial.tier,
        isFine: trial.isFine,
        saidFine,
        correct,
        level: difficulty,
        mode: 'practice',
        latencyMs,
        chance: CHANCE,
        stageBearingDeg: stageBearingsAt(idx),
        voiceOn: useSettings.getState().voiceOn,
      },
      { score: nextScore },
    )

    advanceTimer.current = setTimeout(() => advance(nextScore, nextAnswers), FEEDBACK_MS)
  }

  function advance(nextScore: number, all: Answer[]) {
    const next = idx + 1
    if (next >= trials.length) {
      finishSession(nextScore, all)
      return
    }
    setIdx(next)
    beginTrial(trials, next)
  }

  function finishSession(finalScore: number, all: Answer[]) {
    const correct = all.filter((a) => a.correct).length
    const result = scoreLevel(correct, trials.length, CHANCE)
    const earned = starsFor(correct, trials.length)
    setStars(earned)
    speak(yardLine('sayWin', lang), lang)
    reportScore('rightway360', finalScore)
    // chance-corrected accuracy + the same bias readouts as the flat game
    recordStep('level_result', {
      level: difficulty,
      mode: 'practice',
      accuracy: result.accuracy,
      chance: result.chance,
      adjustedAccuracy: result.adjustedAccuracy,
      passed: result.passed,
      mastered: result.mastered,
      byConstruct: tallyByConstruct(all),
      byValence: tallyByValence(all),
      score: finalScore,
    })
    finishGame(finalScore)
    setTimeout(() => setPhase('over'), 1200)
  }

  if (phase === 'start') {
    return (
      <StartScreen
        game={META}
        onStart={start}
        levelNotes={{
          easy: yardLine('noteEasy', lang),
          medium: yardLine('noteMedium', lang),
          hard: yardLine('noteHard', lang),
        }}
      />
    )
  }

  const trial = trials[idx] as Behavior | undefined
  const answered = picked !== null
  const promptText = trial ? promptFor(trial, lang) : ''
  // After answering, the banner carries the explanation (as the flat game does)
  const bannerText = answered && trial ? trial.explain[lang] : promptText
  const progress = `${idx + (answered ? 1 : 0)} / ${trials.length}`

  return (
    <WebGLGate>
      <div className="game-page">
        {/* trial progress only — no running score on screen: seeing the tally
            move is itself corrective feedback beyond the spoken explanation
            (same rationale as the flat game) */}
        <ScoreBar score={score} progress={progress} />
        <div className="game-canvas" onPointerDown={() => setHintSeen(true)}>
          {trial && (
            <RightWay360Scene
              behavior={trial}
              staging={stagingFor(trial)}
              stageBearingDeg={stageBearingsAt(idx)}
              active={active}
              picked={picked}
              answered={answered}
              onPick={pick}
              lang={lang}
              hudPrompt={bannerText}
              hudProgress={progress}
            />
          )}
          {canVR && (
            <EnterVRButton store={xrStore} accent="rgba(22, 163, 74, 0.94)" label={yardLine('enterVR', lang)} />
          )}
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
              👈 {yardLine('dragHint', lang)} 👉
            </div>
          )}
          {answered && picked === trial?.isFine && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={bannerText} lang={lang} />
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={score}
            best={Math.max(best, score)}
            stars={stars}
            message={t('greatPlaying', lang)}
            lang={lang}
            onRestart={start}
            onChooseLevel={() => setPhase('start')}
          />
        )}
      </div>
    </WebGLGate>
  )
}

/** Behaviour text + "Is that okay?" in the chosen language (banner + voice) —
 *  word-for-word the flat game's prompt, so the two versions stay comparable. */
function promptFor(trial: Behavior, lang: Lang): string {
  return `${trial.text[lang]} ${IS_IT_OKAY[lang]}`
}
