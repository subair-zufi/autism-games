import { useEffect, useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { praise, speak } from '../../services/speech'
import { WinStar } from '../../components/WinStar'
import { playGentle, playSuccess } from '../../services/sounds'
import { t, videoFreezeQuestion, whyQuestion } from '../../i18n/strings'
import type { EmotionId } from '../emotionVocab'
import {
  buildQuiz,
  pointsFor,
  sessionLength,
  starsFor,
  type VideoQuestion,
} from './logic'
import { useLevelProgress } from '../progression'
import { clipLine } from './strings'
import { IdentifyEmotions360Scene } from './IdentifyEmotions360Scene'
import { xrStore, vrSupported } from './xrStore'
import { useVrSessionActive } from '../vrSession'
import { VRWaitingRoom } from '../VRWaitingRoom'
import { useVrGameOverPanel } from '../gameOverPanel'
import { useGameAnalytics } from '../useGameAnalytics'
import { beginHeadWindow, headMetrics } from '../headTracking'
import { VRPracticeScene } from '../vrPractice/VRPracticeScene'

const META = GAME_LIST.find((g) => g.id === 'identifyemotions360')!

/** how long the ⭐ celebration shows before moving on */
const CELEBRATE_MS = 1300
/** pause before the automatic "let's look again" replay after a wrong pick */
const REPLAY_DELAY_MS = 900

/**
 * Emotion Clips 360 — the immersive copy of Emotion Clips. Same quiz (clips,
 * freeze frame, tiered choices, "why?" follow-up, first-try scoring, "let's
 * look again" replay scaffold) as the flat game, but the clip plays on one big
 * screen in a calm media room and the child answers by tapping in-world cards.
 * A single screen sits straight ahead, so there is no head-turn metric here —
 * the 360 value is the shared "watch on the big screen" framing and comfort.
 */
export function IdentifyEmotions360Game() {
  const difficulty = useSettings((s) => s.difficulty.identifyemotions360)
  const lang = useSettings((s) => s.language)
  const vrPracticeDone = useSettings((s) => s.vrPracticeDone)
  const setVrPracticeDone = useSettings((s) => s.setVrPracticeDone)
  const best = useScores((s) => s.best.identifyemotions360)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('identifyemotions360', xrStore)
  // Per-level progression: FIRST-TRY correct namings out of the quiz length —
  // the same pair the `level_result` step records, and what the server's
  // `_clips_trials` counts (it keeps `attempt: 1` answers only).
  const { submit } = useLevelProgress('identifyemotions360')

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  // Lazily populated with a real (if throwaway) quiz rather than `[]`, so the
  // scene below has a `q` to render — and therefore a mounted `<XR>` to bind
  // `enterVR()` to — from the very first render, before Play is even pressed.
  // `start()` immediately overwrites this with a fresh quiz; the clip itself
  // never plays until `startQuestion` explicitly sets `videoEl.src`, so
  // nothing here plays out before that.
  const [quiz, setQuiz] = useState<VideoQuestion[]>(() => buildQuiz(difficulty))
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [firstTryCount, setFirstTryCount] = useState(0)
  const [stars, setStars] = useState(0)
  const [stage, setStage] = useState<'emotion' | 'cause'>('emotion')
  const [frozen, setFrozen] = useState(false)
  const [locked, setLocked] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [wrong, setWrong] = useState<EmotionId[]>([])
  const [causePicked, setCausePicked] = useState<number | null>(null)
  /** whether this browser can enter immersive VR (Quest etc.) — shows the button */
  const [canVR, setCanVR] = useState(false)
  /** whether the headset is actually presenting right now, vs. the flat pre-VR screen */
  const vrActive = useVrSessionActive(xrStore)
  /** Play was pressed on a VR-capable browser, but the session hasn't started
   *  yet — held here instead of calling `start()` so the clip never begins
   *  playing on the flat screen before the child is actually in the headset. */
  const [awaitingVr, setAwaitingVr] = useState(false)

  // one <video> element drives the on-screen texture for the whole session
  const [videoEl] = useState<HTMLVideoElement>(() => {
    const v = document.createElement('video')
    // unmuted, like the flat Emotion Clips game — the clips' audio (reactions,
    // exclamations) is part of the cue. Every play() call chains off a user
    // gesture (Start / answer tap), so unmuted autoplay is allowed.
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.preload = 'auto'
    return v
  })

  const pausedRef = useRef(false)
  const frozenAtRef = useRef<number | null>(null)
  /** when the spoken freeze question finished — a TTS-unconfounded latency runs
   *  from here (item 4), guarded by a token against a re-asked question */
  const promptEndAt = useRef<number | null>(null)
  const promptTok = useRef(0)
  const causeAtRef = useRef<number | null>(null)
  const attemptRef = useRef(0)
  const firstTryRef = useRef(true)
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // the current question, in a ref so the video listeners never read stale state
  const qRef = useRef<VideoQuestion | null>(null)

  const q: VideoQuestion | undefined = quiz[idx]
  qRef.current = q ?? null

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

  // Freeze the clip on its expressive frame, once, when it reaches the target.
  useEffect(() => {
    const freezeAtTarget = () => {
      const cur = qRef.current
      if (pausedRef.current || !cur) return
      const target = Math.min(cur.freezeTime, (videoEl.duration || cur.freezeTime) - 0.1)
      if (videoEl.currentTime >= target) {
        videoEl.pause()
        pausedRef.current = true
        frozenAtRef.current = performance.now()
        // open the head-telemetry window at the freeze (captures gaze stability
        // on the expressive frame — there is no scan target on the flat screen)
        beginHeadWindow()
        setFrozen(true)
      }
    }
    const onEnded = () => {
      if (pausedRef.current) return
      pausedRef.current = true
      frozenAtRef.current = performance.now()
      beginHeadWindow()
      setFrozen(true)
    }
    videoEl.addEventListener('timeupdate', freezeAtTarget)
    videoEl.addEventListener('ended', onEnded)
    return () => {
      videoEl.removeEventListener('timeupdate', freezeAtTarget)
      videoEl.removeEventListener('ended', onEnded)
    }
  }, [videoEl])

  useEffect(
    () => () => {
      clearTimers()
      videoEl.pause()
    },
    [videoEl],
  )

  // Hold the clip when the page goes out of sight. A <video> is NOT throttled
  // while hidden — it plays on with no renderer drawing it — so a child who
  // takes the headset off mid-clip used to come back to a picture already
  // frozen on an expressive frame they never saw, with the latency clock
  // started. Resume only if the clip had not reached its freeze yet.
  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === 'hidden') {
        if (!videoEl.paused) videoEl.pause()
        return
      }
      // pausedRef marks the FREEZE pause, which must never be resumed here
      if (!pausedRef.current && phase === 'playing' && videoEl.src) {
        void videoEl.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [videoEl, phase])

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
    gameId: 'identifyemotions360',
    level: difficulty,
    onRestart: handlePlayPress,
  })

  // Read the freeze prompt aloud once frozen (naming stage), stamping when it
  // finishes so latency can also be measured from prompt end (item 4).
  useEffect(() => {
    if (frozen && !celebrating && stage === 'emotion' && q) {
      const tok = ++promptTok.current
      promptEndAt.current = null
      speak(videoFreezeQuestion(q.clip.gender, lang), lang, () => {
        if (promptTok.current === tok) promptEndAt.current = performance.now()
      })
    }
  }, [frozen, celebrating, stage, q, lang])

  function clearTimers() {
    if (replayTimer.current) clearTimeout(replayTimer.current)
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    replayTimer.current = null
    advanceTimer.current = null
  }

  function playFrom(src: string) {
    pausedRef.current = false
    setFrozen(false)
    if (videoEl.src !== new URL(src, document.baseURI).href) {
      videoEl.src = src
      videoEl.load()
    }
    videoEl.currentTime = 0
    void videoEl.play().catch(() => {})
  }

  function startQuestion(quizArr: VideoQuestion[], i: number) {
    clearTimers()
    setStage('emotion')
    setLocked(false)
    setCelebrating(false)
    setWrong([])
    setCausePicked(null)
    frozenAtRef.current = null
    causeAtRef.current = null
    attemptRef.current = 0
    firstTryRef.current = true
    playFrom(quizArr[i].clip.src)
  }

  function start() {
    resetSession()
    clearTimers()
    setScore(0)
    setFirstTryCount(0)
    setStars(0)
    const built = buildQuiz(difficulty)
    setQuiz(built)
    setIdx(0)
    qRef.current = built[0]
    setPhase('playing')
    startQuestion(built, 0)
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

  /** "Watch again" — rewind and replay up to the freeze. */
  function replay() {
    if (locked) return
    playFrom(qRef.current!.clip.src)
  }

  function pick(id: EmotionId) {
    if (!frozen || locked || stage !== 'emotion' || wrong.includes(id) || !q) return
    attemptRef.current += 1
    const now = performance.now()
    const latencyMs = frozenAtRef.current !== null ? Math.round(now - frozenAtRef.current) : null
    const latencyFromPromptEndMs = promptEndAt.current === null ? null : Math.round(now - promptEndAt.current)
    const base = {
      clip: q.clip.slug,
      difficulty,
      answer: q.answer,
      picked: id,
      attempt: attemptRef.current,
      latencyMs,
      latencyFromPromptEndMs,
      ...headMetrics(),
      freezeKind: q.freezeKind,
    }
    if (id === q.answer) {
      setLocked(true)
      setCelebrating(true)
      playSuccess()
      praise()
      // reward, then resume the clip to its peak before moving on
      void videoEl.play().catch(() => {})
      const firstTry = firstTryRef.current
      const nextScore = score + pointsFor(firstTry)
      const nextFirstTry = firstTryCount + (firstTry ? 1 : 0)
      recordStep('answer', { ...base, correct: true, score: nextScore }, { score: nextScore })
      advanceTimer.current = setTimeout(() => {
        setScore(nextScore)
        setFirstTryCount(nextFirstTry)
        setCelebrating(false)
        if (q.cause) {
          setStage('cause')
          causeAtRef.current = performance.now()
          speak(whyQuestion(q.clip.gender, q.answer, lang), lang)
        } else {
          advance(nextScore, nextFirstTry)
        }
      }, CELEBRATE_MS)
    } else {
      recordStep('answer', { ...base, correct: false })
      playGentle()
      speak(clipLine('sayLookAgain', lang), lang)
      firstTryRef.current = false
      setWrong((w) => [...w, id])
      // make "let's look again" literal: replay the clip up to the freeze
      replayTimer.current = setTimeout(replay, REPLAY_DELAY_MS)
    }
  }

  function pickCause(i: number) {
    if (stage !== 'cause' || causePicked !== null || !q?.cause) return
    const correct = i === q.cause.answerIndex
    const latencyMs = causeAtRef.current !== null ? Math.round(performance.now() - causeAtRef.current) : null
    setCausePicked(i)
    recordStep('cause_answer', {
      clip: q.clip.slug,
      difficulty,
      correct,
      picked: q.cause.options[i].en,
      answer: q.cause.options[q.cause.answerIndex].en,
      latencyMs,
    })
    if (correct) {
      playSuccess()
      praise()
    } else playGentle()
    // One attempt only — show the correct cause, then wait for the child to
    // tap Next (review: a fixed timer didn't give a child extra time to
    // read/process the "why" sentence before the game moved on; the DOM Next
    // button is invisible in headset, so the scene also gets an in-world one).
  }

  function nextFromCause() {
    if (stage !== 'cause' || causePicked === null) return
    advance(score, firstTryCount)
  }

  function advance(nextScore: number, nextFirstTry: number) {
    const next = idx + 1
    if (next >= quiz.length) {
      const total = quiz.length
      const earned = starsFor(nextFirstTry, total)
      setStars(earned)
      speak(clipLine('sayWin', lang), lang)
      reportScore('identifyemotions360', nextScore)
      void submit(difficulty, nextFirstTry, total)
      recordStep('level_result', {
        difficulty,
        firstTryCorrect: nextFirstTry,
        total,
        accuracy: total > 0 ? nextFirstTry / total : 0,
        score: nextScore,
      })
      finishGame(nextScore)
      setTimeout(() => setPhase('over'), 1200)
      return
    }
    setIdx(next)
    qRef.current = quiz[next]
    startQuestion(quiz, next)
  }

  // one-time, unscored warm-up before this child's very first real session
  // (review U2): teaches the headset look-around + tap gesture. Shown only
  // when the browser can actually enter immersive VR — on a flat desktop
  // there's no headset novelty and it's just friction, so it's skipped.
  if (canVR && !vrPracticeDone) return <VRPracticeScene onComplete={() => setVrPracticeDone(true)} />

  if (phase === 'start' && !awaitingVr) {
    return (
      <StartScreen
        game={META}
        onStart={handlePlayPress}
        levelNotes={{
          easy: clipLine('noteEasy', lang),
          medium: clipLine('noteMedium', lang),
          hard: clipLine('noteHard', lang),
        }}
      />
    )
  }

  const promptText =
    stage === 'cause' && q
      ? whyQuestion(q.clip.gender, q.answer, lang)
      : frozen && q
        ? videoFreezeQuestion(q.clip.gender, lang)
        : clipLine('watch', lang)

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} progress={`${idx + (locked ? 1 : 0)} / ${sessionLength(difficulty)}`} />
        <div className="game-canvas">
          {q && (
            <IdentifyEmotions360Scene
              videoEl={videoEl}
              clipSlug={q.clip.slug}
              frozen={frozen}
              stage={stage}
              choices={q.choices}
              answer={q.answer}
              wrong={wrong}
              locked={locked}
              onPickEmotion={pick}
              causeOptions={stage === 'cause' && q.cause ? q.cause.options : null}
              causeAnswerIndex={q.cause?.answerIndex ?? -1}
              causePicked={causePicked}
              onPickCause={pickCause}
              onNextFromCause={nextFromCause}
              nextLabel={t(idx + 1 >= quiz.length ? 'finish' : 'next', lang)}
              onReplay={replay}
              replayLabel={t('watchAgain', lang)}
              celebrating={celebrating}
              lang={lang}
              hudScore={`⭐ ${score}`}
              hudPrompt={promptText}
              hudQuit={t('vrQuit', lang)}
            />
          )}
          <WinStar show={celebrating} />
        </div>
        <div className="game-bottom">
          {/* flat-screen twin of the in-world "Watch again" card (same button
              the flat game has); inside a headset the DOM is invisible and the
              scene card is the one that does the work */}
          {stage === 'emotion' && frozen && (
            <button className="replay-btn" onClick={replay} disabled={locked}>
              {t('watchAgain', lang)}
            </button>
          )}
          <PromptBanner text={promptText} lang={lang} />
          {stage === 'cause' && causePicked !== null && (
            <button className="big-btn er-next" onClick={nextFromCause}>
              {t(idx + 1 >= quiz.length ? 'finish' : 'next', lang)}
            </button>
          )}
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
            accent="rgba(139, 92, 246, 0.94)"
            label={clipLine('enterVR', lang)}
            lang={lang}
          />
        )}
      </div>
    </WebGLGate>
  )
}
