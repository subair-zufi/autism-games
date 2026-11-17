/**
 * Emotion Clips — name the emotion in a short video, frozen on its expressive
 * frame. Levels share the unlock ladder (`../progression`) with Emotion
 * Recognition: pass ≥70% unlocks the next level, ≥80% masters it. Scoring is
 * first-try only; after a wrong pick the clip automatically replays (the
 * "let's look again" scaffold) and the learner keeps trying — those retries
 * are recorded but don't score.
 *
 * Analytics per answer: response latency from the freeze frame appearing
 * (`cue_ready`-style anchor), the attempt number, and which freeze
 * manipulation was active (peak vs. early/low-intensity on Hard).
 *
 * Clips with an authored `cause` get a follow-up "Why does she feel …?"
 * question after the emotion is named — emotion *understanding*, not just
 * labeling. Author causes in `logic.ts` by watching the footage.
 */
import { useEffect, useRef, useState } from 'react'
import { clampVolume, useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { praise, speak } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { emotionMeta, type EmotionId } from '../emotionVocab'
import {
  displayLangs,
  emotionLabel,
  t,
  videoFreezeQuestion,
  whyQuestion,
} from '../../i18n/strings'
import type { Difficulty } from '../../types'
import { buildQuiz, CHOICE_COUNT, type VideoQuestion } from './logic'
import {
  LEVELS,
  scoreLevel,
  useLevelProgress,
  type LevelSummary,
} from '../progression'
import { LevelResult, LevelSelect } from '../../components/LevelScreens'
import { useGameAnalytics } from '../useGameAnalytics'
import { BilingualPromptBanner } from '../../components/BilingualPromptBanner'

export const GAME_KEY = 'identifyemotions'

/** How long the ⭐ celebration shows before moving on. */
const CELEBRATE_MS = 1300
/** Pause before the automatic "let's look again" replay after a wrong pick,
 *  once the spoken line has finished (it is chained off `speak`, not raced). */
const REPLAY_DELAY_MS = 250
/** How long a praise clip needs before the clip's own audio may come back. */
const CHEER_MS = 700

export function IdentifyEmotionsGame() {
  const lang = useSettings((s) => s.language)
  const reportScore = useScores((s) => s.reportScore)
  const { stateFor, highestUnlocked, submit } = useLevelProgress(GAME_KEY)
  const { recordStep, finishGame, resetSession } = useGameAnalytics(GAME_KEY)

  const [phase, setPhase] = useState<'select' | 'playing' | 'result'>('select')
  const [selectedLevel, setSelectedLevel] = useState<Difficulty>('easy')
  const [level, setLevel] = useState<Difficulty>('easy')
  const [quiz, setQuiz] = useState<VideoQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [summary, setSummary] = useState<LevelSummary | null>(null)
  const [locked, setLocked] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [wrong, setWrong] = useState<EmotionId[]>([])
  // The current question's sub-stage: naming the emotion, or (for clips with
  // an authored cause) the "why" follow-up.
  const [stage, setStage] = useState<'emotion' | 'cause'>('emotion')
  const [causePicked, setCausePicked] = useState<number | null>(null)
  // The clip pauses on its freeze frame and the question + answers only
  // become active once it is frozen. Guard so we pause exactly once per play.
  const [frozen, setFrozen] = useState(false)
  const pausedRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  // Same hole as the 360 twin had (review C2): the clip's audio was outside
  // `soundOn` entirely, so muting the app left the loudest thing in it
  // playing. `key={q.clip.slug}` remounts the element per clip, so this has to
  // re-apply on every render pass, not once.
  const volume = useSettings((s) => s.volume)
  const soundOn = useSettings((s) => s.soundOn)
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = !soundOn || volume <= 0
    v.volume = clampVolume(volume)
  })
  // Latency anchors: when the freeze frame / cause question appeared.
  const frozenAtRef = useRef<number | null>(null)
  const causeAtRef = useRef<number | null>(null)
  const attemptRef = useRef(0)
  const firstTryRef = useRef(true)
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** guards the "let's look again" onEnd against a round that has moved on */
  const replayTok = useRef(0)

  // None of this screen's timers were tracked, so leaving during the
  // celebration left one running that speaks the "why?" question — on the Home
  // screen, or over the next game. Same class as the 360 twin's (review C3).
  useEffect(
    () => () => {
      for (const t of [replayTimer, resumeTimer, celebrateTimer]) {
        if (t.current) clearTimeout(t.current)
        t.current = null
      }
      replayTok.current += 1
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    },
    [],
  )

  const q: VideoQuestion | undefined = quiz[idx]

  // While choosing, keep the selection on the highest unlocked level.
  const highest = highestUnlocked()
  useEffect(() => {
    if (phase === 'select') setSelectedLevel(highest)
  }, [highest, phase])

  // Hold the clip when the page goes out of sight. A <video> is NOT throttled
  // while hidden — it plays on with nothing drawing it — so a child who looks
  // away mid-clip used to return to a picture already frozen on an expressive
  // frame they never saw, with the latency clock started. Fixed here as well as
  // in Emotion Cinema 360 on purpose: the flat and immersive builds are the two
  // arms of the 2D↔VR comparison, and repairing only one would bias it.
  useEffect(() => {
    const onChange = () => {
      const v = videoRef.current
      if (!v) return
      if (document.visibilityState === 'hidden') {
        if (!v.paused) v.pause()
        return
      }
      // pausedRef marks the FREEZE pause, which must never be resumed here
      if (!pausedRef.current && phase === 'playing' && v.src) void v.play().catch(() => {})
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [phase])

  function start(lvl: Difficulty) {
    resetSession()
    setLevel(lvl)
    setQuiz(buildQuiz(lvl))
    setIdx(0)
    setScore(0)
    setSummary(null)
    resetQuestion()
    setPhase('playing')
  }

  function resetQuestion() {
    setLocked(false)
    setCelebrating(false)
    setWrong([])
    setStage('emotion')
    setCausePicked(null)
    setFrozen(false)
    pausedRef.current = false
    frozenAtRef.current = null
    causeAtRef.current = null
    attemptRef.current = 0
    firstTryRef.current = true
  }

  /** Pause on the freeze frame once the clip reaches its timestamp. */
  function freezeAtTarget() {
    const v = videoRef.current
    if (!v || pausedRef.current || !q) return
    // Clamp the metadata timestamp to the clip so an over-estimate still pauses.
    const target = Math.min(q.freezeTime, (v.duration || q.freezeTime) - 0.1)
    if (v.currentTime >= target) {
      v.pause()
      pausedRef.current = true
      setFrozen(true)
      frozenAtRef.current = performance.now()
    }
  }

  /** Fallback: if the clip ends before the freeze timestamp, freeze on the last frame. */
  function onEnded() {
    if (pausedRef.current) return
    pausedRef.current = true
    setFrozen(true)
    frozenAtRef.current = performance.now()
  }

  /** "Watch again" — rewind and replay up to the freeze. */
  function replay() {
    if (locked) return
    const v = videoRef.current
    if (!v) return
    pausedRef.current = false
    setFrozen(false)
    v.currentTime = 0
    void v.play()
  }

  function advance(nextScore: number) {
    if (idx + 1 >= quiz.length) {
      const chance = 1 / CHOICE_COUNT[level]
      const result = scoreLevel(nextScore, quiz.length, chance)
      setSummary(result)
      reportScore(GAME_KEY, result.correct)
      recordStep('level_result', {
        level,
        accuracy: result.accuracy,
        chance: result.chance,
        adjustedAccuracy: result.adjustedAccuracy,
        passed: result.passed,
        mastered: result.mastered,
      })
      finishGame(result.correct)
      void submit(level, result.correct, result.total)
      setPhase('result')
    } else {
      setIdx(idx + 1)
      resetQuestion()
    }
  }

  function pick(id: EmotionId) {
    // Only answerable once frozen on the freeze frame; ignore repeats/locked.
    if (!frozen || locked || stage !== 'emotion' || wrong.includes(id) || !q) return
    attemptRef.current += 1
    const latencyMs =
      frozenAtRef.current !== null ? Math.round(performance.now() - frozenAtRef.current) : null
    const base = {
      clip: q.clip.slug,
      level,
      answer: q.answer,
      picked: id,
      attempt: attemptRef.current,
      latencyMs,
      freezeKind: q.freezeKind,
    }
    if (id === q.answer) {
      setLocked(true)
      setCelebrating(true)
      playSuccess()
      praise()
      // Positive reinforcement, THEN the clip — not both at once. The clip is
      // unmuted by design, so resuming it here put the chime, the spoken cheer
      // and the clip's own audio on top of each other (review C3).
      resumeTimer.current = setTimeout(() => void videoRef.current?.play(), CHEER_MS)
      const nextScore = score + (firstTryRef.current ? 1 : 0)
      recordStep('answer', { ...base, correct: true, score: nextScore }, { score: nextScore })
      celebrateTimer.current = setTimeout(() => {
        setScore(nextScore)
        setCelebrating(false)
        if (q.cause) {
          // Emotion named — now probe the cause ("why" question).
          setStage('cause')
          causeAtRef.current = performance.now()
          speak(whyQuestion(q.clip.gender, q.answer, lang), lang)
        } else {
          advance(nextScore)
        }
      }, CELEBRATE_MS)
    } else {
      recordStep('answer', { ...base, correct: false })
      playGentle()
      firstTryRef.current = false
      setWrong((w) => [...w, id])
      // Make "let's look again" literal: automatically replay the clip up to
      // the freeze frame so the learner re-inspects the expression — after the
      // spoken line, not over the top of it.
      const tok = ++replayTok.current
      speak(t('sayLookAgain', lang), lang, () => {
        if (replayTok.current !== tok) return
        replayTimer.current = setTimeout(replay, REPLAY_DELAY_MS)
      })
    }
  }

  function pickCause(i: number) {
    if (stage !== 'cause' || causePicked !== null || !q?.cause) return
    const correct = i === q.cause.answerIndex
    const latencyMs =
      causeAtRef.current !== null ? Math.round(performance.now() - causeAtRef.current) : null
    setCausePicked(i)
    recordStep('cause_answer', {
      clip: q.clip.slug,
      level,
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
    // tap Next (review: the previous fixed 1.5s timer didn't give a child
    // extra time to read/process the "why" sentence before moving on).
  }

  // Read the freeze prompt aloud (in the chosen language) once frozen.
  const freezeSpeak = q ? videoFreezeQuestion(q.clip.gender, lang) : ''
  useEffect(() => {
    if (frozen && !celebrating && stage === 'emotion') speak(freezeSpeak, lang)
  }, [frozen, celebrating, stage, freezeSpeak, lang])

  if (phase === 'select' || !q) {
    return (
      <LevelSelect
        title={t('clipsTitle', lang)}
        icon="🎬"
        levels={LEVELS}
        selected={selectedLevel}
        stateFor={stateFor}
        lang={lang}
        onSelect={setSelectedLevel}
        onStart={() => start(selectedLevel)}
      />
    )
  }

  const isLast = idx + 1 >= quiz.length
  const langs = displayLangs(lang)
  const promptLines =
    stage === 'cause'
      ? langs.map((l) => ({ lang: l, text: whyQuestion(q.clip.gender, q.answer, l) }))
      : frozen
        ? langs.map((l) => ({ lang: l, text: videoFreezeQuestion(q.clip.gender, l) }))
        : langs.map((l) => ({ lang: l, text: t('watchPrompt', l) }))
  const promptSpeak =
    stage === 'cause' ? whyQuestion(q.clip.gender, q.answer, lang) : freezeSpeak

  return (
    <div className="game-page">
      <div className="game-canvas">
        <div className="quiz-progress">{t('videoCounter', lang, { n: idx + 1, total: quiz.length })}</div>
        <div className="video-stage">
          <video
            key={q.clip.slug}
            ref={videoRef}
            className="quiz-video"
            src={q.clip.src}
            autoPlay
            playsInline
            onTimeUpdate={freezeAtTarget}
            onEnded={onEnded}
          />
          {stage === 'emotion' && (
            <button className="replay-btn" onClick={replay} disabled={locked}>{t('watchAgain', lang)}</button>
          )}
        </div>
        {celebrating && <div className="celebrate">⭐</div>}
      </div>
      <div className="game-bottom">
        <BilingualPromptBanner
          lines={promptLines}
          lang={lang}
          onSpeak={
            frozen || stage === 'cause' ? () => speak(promptSpeak, lang) : undefined
          }
        />
        {stage === 'cause' && q.cause ? (
          <>
            <div className="choice-row">
              {q.cause.options.map((opt, i) => {
                let cls = 'choice-btn'
                if (causePicked !== null && i === q.cause!.answerIndex) cls += ' correct'
                else if (causePicked === i) cls += ' wrong'
                return (
                  <button key={i} className={cls} disabled={causePicked !== null} onClick={() => pickCause(i)}>
                    {displayLangs(lang).map((l) => (
                      <span key={l} className={`choice-label choice-label-${l}`}>{opt[l]}</span>
                    ))}
                  </button>
                )
              })}
            </div>
            {causePicked !== null && (
              <div className="er-feedback-row">
                <button className="big-btn er-next" onClick={() => advance(score)}>
                  {t(isLast ? 'finish' : 'next', lang)}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="choice-row">
            {q.choices.map((id) => {
              const m = emotionMeta(id)
              return (
                <button
                  key={id}
                  className="choice-btn"
                  disabled={!frozen || locked || wrong.includes(id)}
                  onClick={() => pick(id)}
                >
                  <span className="choice-emoji">{m.emoji}</span>
                  {displayLangs(lang).map((l) => (
                    <span key={l} className={`choice-label choice-label-${l}`}>{emotionLabel(id, l)}</span>
                  ))}
                </button>
              )
            })}
          </div>
        )}
      </div>
      {phase === 'result' && summary && (
        <LevelResult
          summary={summary}
          lang={lang}
          onReplay={() => start(level)}
          onChooseLevel={() => setPhase('select')}
        />
      )}
    </div>
  )
}
