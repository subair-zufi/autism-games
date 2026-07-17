/**
 * Calm Crew — emotion regulation. A situation stirs up a big feeling and the
 * Feelings Meter climbs; the child names the feeling, picks a calming tool from
 * the toolkit, and *performs* it (paced balloon breathing, counting to ten, or
 * a guided coping action) until the meter comes back down to calm.
 *
 * This component owns the play flow (start → playing → over) and the per-round
 * beats (name → choose → regulate → settle); pure content and pacing live in
 * `logic.ts`, localization in `strings.ts`, presentation in `ui.tsx`.
 *
 * Analytics per round: the naming choice + latency (appraisal), which strategy
 * was chosen and whether it fit the situation, and the time taken to bring the
 * meter down (the regulation measure). Nothing here is scored as "wrong" — the
 * server-side `correct` flags mark the *clean* path (feeling named + fitting
 * tool), never punish a child for how they chose to self-soothe.
 */
import { useEffect, useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { speak } from '../../services/speech'
import { t } from '../../i18n/strings'
import { playGentle, playSuccess, playTap } from '../../services/sounds'
import type { EmotionId } from '../emotionVocab'
import {
  CONFIG,
  makeRound,
  meterStep,
  pointsFor,
  starsFor,
  strategyFit,
  strategyMeta,
  strategySteps,
  type Fit,
  type Round,
  type StrategyId,
} from './logic'
import { calmLine, strategyAction, triggerLine } from './strings'
import {
  BalloonBreather,
  CalmFace,
  CountPad,
  FeelingChoices,
  FeelingsMeter,
  QuickPanel,
  StrategyGrid,
} from './ui'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'calmcrew')!

/** Visual inhale/exhale length for the balloon, and the minimum hold that
 *  counts as a real breath (forgiving, so a slip isn't a failure). */
const INHALE_MS = 3000
const MIN_HOLD_MS = 900
/** How long the "you did it" beat lingers before the next situation. */
const SETTLE_MS = 2200

type RoundPhase = 'name' | 'choose' | 'regulate' | 'settle'

export function CalmCrewGame() {
  const difficulty = useSettings((s) => s.difficulty.calmcrew)
  const lang = useSettings((s) => s.language)
  const best = useScores((s) => s.best.calmcrew)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('calmcrew')
  const cfg = CONFIG[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [roundPhase, setRoundPhase] = useState<RoundPhase>('name')
  const [round, setRound] = useState<Round>(() => makeRound(null, cfg))
  const [meter, setMeter] = useState(0)
  const [score, setScore] = useState(0)
  const [roundsDone, setRoundsDone] = useState(0)
  const [cleanRounds, setCleanRounds] = useState(0)
  const [stars, setStars] = useState(0)

  // "name it" state
  const [pickedFeeling, setPickedFeeling] = useState<EmotionId | null>(null)
  const [namedCorrect, setNamedCorrect] = useState(false)
  // chosen tool + how well it fit
  const [strategy, setStrategy] = useState<StrategyId | null>(null)
  const [fit, setFit] = useState<Fit>('ok')
  // activity progress
  const [held, setHeld] = useState(false)
  const [cyclesDone, setCyclesDone] = useState(0)
  const [countDone, setCountDone] = useState(0)
  const [quickStep, setQuickStep] = useState(0)
  const [feedback, setFeedback] = useState('')

  // Refs so the drift timer and pointer handlers never read stale state.
  const meterRef = useRef(0)
  const heldRef = useRef(false)
  const holdStartAt = useRef(0)
  const feelReadyAt = useRef(0)
  const regulateStartAt = useRef(0)
  const doneRef = useRef(false) // guards double-completion of a round
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => clearTimers(), [])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  function later(fn: () => void, ms: number) {
    timers.current.push(setTimeout(fn, ms))
  }

  // The meter creeps back up while the child pauses mid-activity (medium/hard),
  // so calming has to be carried through rather than dawdled.
  useEffect(() => {
    if (roundPhase !== 'regulate' || cfg.driftPerSec <= 0) return
    const ceiling = Math.min(100, round.trigger.intensity + 8)
    const id = setInterval(() => {
      if (heldRef.current || doneRef.current) return
      setMeterTo(Math.min(ceiling, meterRef.current + cfg.driftPerSec * 0.5))
    }, 500)
    return () => clearInterval(id)
  }, [roundPhase, cfg.driftPerSec, round.trigger.intensity])

  function setMeterTo(v: number) {
    const clamped = Math.max(0, Math.min(100, v))
    meterRef.current = clamped
    setMeter(clamped)
  }

  function start() {
    resetSession()
    clearTimers()
    setScore(0)
    setRoundsDone(0)
    setCleanRounds(0)
    setStars(0)
    setPhase('playing')
    beginRound(null)
  }

  function beginRound(prev: Round | null) {
    doneRef.current = false
    const r = makeRound(prev ? prev.trigger.id : null, cfg)
    setRound(r)
    setMeterTo(r.trigger.intensity)
    setPickedFeeling(null)
    setNamedCorrect(false)
    setStrategy(null)
    setFit('ok')
    setHeld(false)
    heldRef.current = false
    setCyclesDone(0)
    setCountDone(0)
    setQuickStep(0)
    setFeedback('')
    setRoundPhase('name')
    feelReadyAt.current = performance.now()
    recordStep('trigger_shown', {
      trigger: r.trigger.id,
      feeling: r.trigger.feeling,
      intensity: r.trigger.intensity,
    })
  }

  // ---- name it -------------------------------------------------------------
  function nameFeeling(e: EmotionId) {
    if (roundPhase !== 'name' || pickedFeeling) return
    const correct = e === round.trigger.feeling
    setPickedFeeling(e)
    setNamedCorrect(correct)
    if (correct) playGentle()
    recordStep('feeling_named', {
      correct,
      choice: e,
      answer: round.trigger.feeling,
      latencyMs: Math.round(performance.now() - feelReadyAt.current),
      choices: round.feelingOptions.length,
    })
    later(() => setRoundPhase('choose'), 950)
  }

  // ---- choose it -----------------------------------------------------------
  function chooseStrategy(id: StrategyId) {
    if (roundPhase !== 'choose') return
    const f = strategyFit(round.trigger, id)
    setStrategy(id)
    setFit(f)
    setQuickStep(0)
    playTap()
    regulateStartAt.current = performance.now()
    recordStep('strategy_chosen', {
      strategy: id,
      fit: f,
      correct: f === 'good', // clean-path flag: a fitting tool was chosen
      suggested: cfg.suggest ? suggestedStrategy() : null,
    })
    setRoundPhase('regulate')
  }

  /** On easy we spotlight one tool: a fitting coping action if the situation has
   *  one, otherwise breathing — so the child always sees a good example. */
  function suggestedStrategy(): StrategyId {
    return round.trigger.bestFit[0] ?? 'breathe'
  }

  // ---- do it: breathing ----------------------------------------------------
  function holdStart() {
    if (roundPhase !== 'regulate' || doneRef.current) return
    heldRef.current = true
    holdStartAt.current = performance.now()
    setHeld(true)
  }
  function holdEnd() {
    if (!heldRef.current) return
    heldRef.current = false
    setHeld(false)
    const heldMs = performance.now() - holdStartAt.current
    if (heldMs < MIN_HOLD_MS) return // too short to be a breath — no penalty
    const next = cyclesDone + 1
    setCyclesDone(next)
    dropStep('breath')
    playGentle()
    if (next >= cfg.breathCycles) completeRegulation()
  }

  // ---- do it: counting -----------------------------------------------------
  function tapCount(n: number) {
    if (roundPhase !== 'regulate' || n !== countDone + 1) return
    const next = n
    setCountDone(next)
    dropStep('count')
    playTap()
    if (next >= cfg.countTarget) completeRegulation()
  }

  // ---- do it: guided coping action ----------------------------------------
  function stepQuick() {
    if (roundPhase !== 'regulate') return
    const next = quickStep + 1
    setQuickStep(next)
    dropStep('quick')
    if (next === 1) {
      playTap()
      speak(calmLine('quickNotice', lang), lang)
    }
    if (next >= 2) completeRegulation()
  }

  /** Lower the meter by one step of the current activity (never below calm). */
  function dropStep(kind: 'breath' | 'count' | 'quick') {
    const steps = strategySteps(kind, cfg)
    const step = meterStep(round.trigger.intensity, steps, cfg)
    setMeterTo(Math.max(cfg.calmThreshold - 1, meterRef.current - step))
  }

  // ---- settle / scoring ----------------------------------------------------
  function completeRegulation() {
    if (doneRef.current) return
    doneRef.current = true
    setMeterTo(0)
    setRoundPhase('settle')
    playSuccess()
    const clean = namedCorrect && fit === 'good'
    const points = pointsFor(namedCorrect, fit)
    const nextScore = score + points
    const nextRounds = roundsDone + 1
    const nextClean = cleanRounds + (clean ? 1 : 0)
    setScore(nextScore)
    setRoundsDone(nextRounds)
    setCleanRounds(nextClean)
    const line = fit === 'good' ? 'feedbackGood' : 'feedbackOk'
    setFeedback(calmLine(line, lang))
    speak(calmLine(line, lang), lang)
    recordStep(
      'regulated',
      {
        correct: true, // the meter reached calm — the round's goal was met
        trigger: round.trigger.id,
        strategy,
        fit,
        namedCorrect,
        clean,
        timeToCalmMs: Math.round(performance.now() - regulateStartAt.current),
        points,
        score: nextScore,
      },
      { score: nextScore },
    )
    if (nextRounds >= cfg.goal) {
      const st = starsFor(nextClean, cfg.goal)
      setStars(st)
      speak(calmLine('win', lang), lang)
      reportScore('calmcrew', nextScore)
      finishGame(nextScore)
      later(() => setPhase('over'), SETTLE_MS + 400)
      return
    }
    later(() => beginRound(round), SETTLE_MS)
  }

  // ---- render --------------------------------------------------------------
  if (phase === 'start') {
    return (
      <StartScreen
        game={META}
        onStart={start}
        levelNotes={{
          easy: calmLine('noteEasy', lang),
          medium: calmLine('noteMedium', lang),
          hard: calmLine('noteHard', lang),
        }}
      />
    )
  }

  const banner =
    roundPhase === 'name'
      ? calmLine('feelPrompt', lang)
      : roundPhase === 'choose'
        ? calmLine('choosePrompt', lang)
        : roundPhase === 'regulate' && strategy
          ? strategyAction(strategy, lang)
          : feedback || calmLine('choosePrompt', lang)

  const kind = strategy ? strategyMeta(strategy).kind : null

  return (
    <div className="game-page">
      <ScoreBar score={score} progress={`${roundsDone} / ${cfg.goal}`} />
      <div className="game-canvas calm-stage">
        <FeelingsMeter value={meter} big={calmLine('meterBig', lang)} calm={calmLine('meterCalm', lang)} />
        <CalmFace triggerEmoji={round.trigger.emoji} meter={meter} />

        {roundPhase === 'name' && (
          <p className="calm-situation">{triggerLine(round.trigger.id, lang)}</p>
        )}

        {roundPhase === 'settle' && <div className="celebrate">😌</div>}

        {roundPhase === 'regulate' && kind === 'breath' && (
          <BalloonBreather
            held={held}
            inhaleMs={INHALE_MS}
            cyclesDone={cyclesDone}
            cyclesTotal={cfg.breathCycles}
            onHoldStart={holdStart}
            onHoldEnd={holdEnd}
            label={held ? calmLine('breatheIn', lang) : cyclesDone > 0 ? calmLine('breatheOut', lang) : calmLine('breatheHold', lang)}
          />
        )}
        {roundPhase === 'regulate' && kind === 'count' && (
          <CountPad target={cfg.countTarget} count={countDone} onTap={tapCount} />
        )}
        {roundPhase === 'regulate' && kind === 'quick' && strategy && (
          <QuickPanel
            emoji={strategyMeta(strategy).emoji}
            text={quickStep === 0 ? strategyAction(strategy, lang) : calmLine('quickNotice', lang)}
            onStep={stepQuick}
          />
        )}
      </div>

      <div className="game-bottom">
        {roundPhase === 'name' && (
          <FeelingChoices
            options={round.feelingOptions}
            answer={round.trigger.feeling}
            answered={pickedFeeling !== null}
            picked={pickedFeeling}
            onPick={nameFeeling}
            lang={lang}
          />
        )}
        {roundPhase === 'choose' && (
          <StrategyGrid
            suggested={cfg.suggest ? suggestedStrategy() : null}
            onPick={chooseStrategy}
            lang={lang}
          />
        )}
        <PromptBanner text={banner} lang={lang} />
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
  )
}
