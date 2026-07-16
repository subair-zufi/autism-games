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
import { t, whoFeelsQuestion } from '../../i18n/strings'
import { playGentle, playSuccess } from '../../services/sounds'
import {
  CONFIG,
  answerBearingDeg,
  buildAnswerSlots,
  buildTargets,
  makeRound,
  pointsFor,
  roundChance,
  starsFor,
  type Round,
} from './logic'
import { roomLine } from './strings'
import { EmotionRecognition360Scene } from './EmotionRecognition360Scene'
import { xrStore, vrSupported } from './xrStore'
import { useGameAnalytics } from '../useGameAnalytics'
import { beginHeadWindow, headMetrics } from '../headTracking'
import { VRPracticeScene } from '../vrPractice/VRPracticeScene'

const META = GAME_LIST.find((g) => g.id === 'emotionrecognition360')!

/** how long the correct/try-again feedback shows before the next round */
const FEEDBACK_MS = 1600
/** calm beat before the boards for the next round appear */
const ROUND_GAP_MS = 700

/**
 * Emotion Recognition 360 — the immersive copy of the flat "Who feels ___?"
 * question. Session flow and measurement mirror the other 360 games: the child
 * stands in a calm gallery, turns the view (a head turn in VR) to scan the
 * face-boards, and taps the person who feels the target emotion. Every answer
 * records the picked vs. correct emotion (feeding the same per-emotion
 * confusion matrix as the flat game) plus the correct board's signed bearing —
 * how far the child had to turn to reach the right face.
 */
export function EmotionRecognition360Game() {
  const difficulty = useSettings((s) => s.difficulty.emotionrecognition360)
  const lang = useSettings((s) => s.language)
  const vrPracticeDone = useSettings((s) => s.vrPracticeDone)
  const setVrPracticeDone = useSettings((s) => s.setVrPracticeDone)
  const best = useScores((s) => s.best.emotionrecognition360)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('emotionrecognition360', xrStore)
  const cfg = CONFIG[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [targets, setTargets] = useState<ReturnType<typeof buildTargets>>([])
  const [roundIdx, setRoundIdx] = useState(0)
  const [round, setRound] = useState<Round | null>(null)
  const [active, setActive] = useState(false)
  const [pickedIndex, setPickedIndex] = useState<number | null>(null)
  const [answered, setAnswered] = useState(false)
  const [hint, setHint] = useState(false)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [stars, setStars] = useState(0)
  /** the one-time "drag to look around" hint, dismissed on the first look */
  const [hintSeen, setHintSeen] = useState(false)
  /** whether this browser can enter immersive VR (Quest etc.) — shows the button */
  const [canVR, setCanVR] = useState(false)

  /** when the boards became visible — response latency runs from here */
  const readyAt = useRef<number | null>(null)
  /** when the spoken question finished — a second, TTS-unconfounded latency
   *  runs from here (the question's length varies by emotion word and language) */
  const promptEndAt = useRef<number | null>(null)
  /** guards the speak() onEnd callback against a later round's utterance */
  const promptTok = useRef(0)
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** whether the "look around" hint fired this round — read at answer time so a
   *  hinted correct prices like a prompted find (review M5/P3), independent of
   *  the `hint` display state (which clears the instant the child answers) */
  const hintFiredRef = useRef(false)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** which board slot holds the correct face each round — dealt in shuffled
   *  cycles so the session sweeps every position evenly (review M4) */
  const answerSlots = useRef<number[]>([])

  useEffect(() => () => clearTimers(), [])

  useEffect(() => {
    void vrSupported().then(setCanVR)
  }, [])

  // When the session ends, leave immersive VR so the (DOM) results dialog and
  // start screen are visible again on the headset's browser.
  useEffect(() => {
    if (phase === 'over') void xrStore.getState().session?.end()
  }, [phase])

  function clearTimers() {
    for (const timer of [hintTimer, advanceTimer, gapTimer]) {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
    }
  }

  function start() {
    resetSession()
    clearTimers()
    setScore(0)
    setCorrectCount(0)
    setStars(0)
    const seq = buildTargets(difficulty)
    setTargets(seq)
    answerSlots.current = buildAnswerSlots(difficulty)
    setRoundIdx(0)
    setPhase('playing')
    beginRound(seq, 0)
  }

  function beginRound(seq: ReturnType<typeof buildTargets>, idx: number) {
    clearTimers()
    setAnswered(false)
    setPickedIndex(null)
    setHint(false)
    hintFiredRef.current = false
    setActive(false)
    readyAt.current = null
    const next = makeRound(seq[idx], difficulty, Math.random, answerSlots.current[idx])
    setRound(next)
    // a calm beat, then the boards appear and the question is asked
    gapTimer.current = setTimeout(() => {
      setActive(true)
      readyAt.current = performance.now()
      // open the head-telemetry window as the boards appear (the scan to the
      // right face is measured from here)
      beginHeadWindow()
      // stamp when the spoken question finishes, guarded so a later round's
      // utterance can't overwrite it (item 4: latency from prompt end)
      const tok = ++promptTok.current
      promptEndAt.current = null
      speak(whoFeelsQuestion(next.target, lang), lang, () => {
        if (promptTok.current === tok) promptEndAt.current = performance.now()
      })
      recordStep('event_ready', {
        target: next.target,
        boardCount: next.boards.length,
        // how far the child must turn to face the right person — the 360 games'
        // attention-shift measure (signed degrees left/right)
        targetBearingDeg: answerBearingDeg(next),
      })
      armHint()
    }, ROUND_GAP_MS)
  }

  /** arm the gentle "look around" hint — never on hard */
  function armHint() {
    if (cfg.hintAfterMs === null) return
    hintTimer.current = setTimeout(() => {
      setHint(true)
      hintFiredRef.current = true
      playGentle()
      speak(roomLine('hintLook', lang), lang)
      recordStep('hint', {})
    }, cfg.hintAfterMs)
  }

  function pick(i: number) {
    if (!active || answered || !round) return
    clearTimers()
    const correct = i === round.answerIndex
    const now = performance.now()
    const latencyMs = readyAt.current === null ? null : Math.round(now - readyAt.current)
    // second latency measured from the end of the spoken question, so it isn't
    // inflated by how long the question took to say; null if the child answered
    // before it finished (or speech was off)
    const latencyFromPromptEndMs = promptEndAt.current === null ? null : Math.round(now - promptEndAt.current)
    const head = headMetrics(answerBearingDeg(round))
    const hinted = hintFiredRef.current
    setPickedIndex(i)
    setAnswered(true)
    setHint(false)

    const points = pointsFor(correct, hinted)
    const nextScore = score + points
    const nextCorrect = correctCount + (correct ? 1 : 0)
    setScore(nextScore)
    setCorrectCount(nextCorrect)

    if (correct) {
      playSuccess()
      speak(roomLine('sayCorrect', lang), lang)
    } else {
      playGentle()
      speak(roomLine('sayTryAgain', lang), lang)
    }

    recordStep(
      'answer',
      {
        correct,
        target: round.target,
        answer: round.target, // the correct emotion
        picked: round.boards[i].emotion, // feeds the per-emotion confusion matrix
        pickedIndex: i,
        answerIndex: round.answerIndex,
        boardCount: round.boards.length,
        targetBearingDeg: answerBearingDeg(round),
        chance: roundChance(round),
        latencyMs,
        latencyFromPromptEndMs,
        ...head,
        hinted,
        mode: 'practice',
      },
      { score: nextScore },
    )

    // reveal the correct face for a beat, then move on
    advanceTimer.current = setTimeout(() => advance(nextScore, nextCorrect), FEEDBACK_MS)
  }

  function advance(nextScore: number, nextCorrect: number) {
    const next = roundIdx + 1
    if (next >= targets.length) {
      const earned = starsFor(nextCorrect, cfg.goal)
      setStars(earned)
      speak(roomLine('sayWin', lang), lang)
      reportScore('emotionrecognition360', nextScore)
      recordStep('level_result', {
        difficulty,
        correct: nextCorrect,
        total: targets.length,
        accuracy: targets.length > 0 ? nextCorrect / targets.length : 0,
        chance: 1 / cfg.boardCount,
        score: nextScore,
      })
      finishGame(nextScore)
      setTimeout(() => setPhase('over'), 1200)
      return
    }
    setRoundIdx(next)
    beginRound(targets, next)
  }

  // one-time, unscored warm-up before this child's very first real session
  // ever, across every 360 game (review U2) — separates headset novelty from
  // the skill this game measures
  if (!vrPracticeDone) return <VRPracticeScene onComplete={() => setVrPracticeDone(true)} />

  if (phase === 'start') {
    return (
      <StartScreen
        game={META}
        onStart={start}
        levelNotes={{
          easy: roomLine('noteEasy', lang),
          medium: roomLine('noteMedium', lang),
          hard: roomLine('noteHard', lang),
        }}
      />
    )
  }

  const promptText = round ? whoFeelsQuestion(round.target, lang) : ''

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} progress={`${roundIdx + (answered ? 1 : 0)} / ${targets.length}`} />
        <div className="game-canvas" onPointerDown={() => setHintSeen(true)}>
          {round && (
            <EmotionRecognition360Scene
              boards={round.boards}
              active={active}
              pickedIndex={pickedIndex}
              answerIndex={round.answerIndex}
              answered={answered}
              hint={hint}
              onPick={pick}
              hudScore={`⭐ ${score}`}
              hudPrompt={promptText}
              hudQuit={t('vrQuit', lang)}
            />
          )}
          {canVR && (
            <button
              onClick={() => xrStore.enterVR()}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                padding: '10px 16px',
                borderRadius: 22,
                border: 'none',
                background: 'rgba(245, 158, 11, 0.94)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              🥽 {roomLine('enterVR', lang)}
            </button>
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
              👈 {roomLine('dragHint', lang)} 👉
            </div>
          )}
          {answered && pickedIndex === round?.answerIndex && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={promptText} lang={lang} />
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
