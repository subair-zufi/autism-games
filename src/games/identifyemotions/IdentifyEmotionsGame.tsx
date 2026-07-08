import { useEffect, useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { QuizResult } from '../../components/QuizResult'
import { speak, speechAvailable } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { emotionMeta, type EmotionId } from '../emotionVocab'
import {
  DISPLAY_LANGS,
  emotionLabel,
  t,
  videoFreezeQuestion,
} from '../../i18n/strings'
import { buildQuiz, type VideoQuestion } from './logic'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'identifyemotions')!

export function IdentifyEmotionsGame() {
  const difficulty = useSettings((s) => s.difficulty.identifyemotions)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('identifyemotions')

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [quiz, setQuiz] = useState<VideoQuestion[]>(() => buildQuiz(difficulty))
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [firstTry, setFirstTry] = useState(true)
  const [locked, setLocked] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [wrong, setWrong] = useState<EmotionId[]>([])
  // The clip pauses on its "peak emotion" frame and the question + answers only
  // become active once it is frozen. Guard so we pause exactly once per clip.
  const [frozen, setFrozen] = useState(false)
  const pausedRef = useRef(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const q = quiz[idx]

  function start() {
    resetSession()
    setQuiz(buildQuiz(difficulty))
    setIdx(0)
    setScore(0)
    resetQuestion()
    setPhase('playing')
  }

  function resetQuestion() {
    setFirstTry(true)
    setLocked(false)
    setCelebrating(false)
    setWrong([])
    setFrozen(false)
    pausedRef.current = false
  }

  /** Pause on the peak-emotion frame once the clip reaches its timestamp. */
  function freezeAtPeak() {
    const v = videoRef.current
    if (!v || pausedRef.current) return
    // Clamp the metadata timestamp to the clip so an over-estimate still pauses.
    const peak = Math.min(q.clip.peakTime, (v.duration || q.clip.peakTime) - 0.1)
    if (v.currentTime >= peak) {
      v.pause()
      pausedRef.current = true
      setFrozen(true)
    }
  }

  /** Fallback: if the clip ends before the peak timestamp, freeze on the last frame. */
  function onEnded() {
    if (pausedRef.current) return
    pausedRef.current = true
    setFrozen(true)
  }

  /** "Watch again" — rewind and replay up to the peak freeze. */
  function replay() {
    if (locked) return
    const v = videoRef.current
    if (!v) return
    pausedRef.current = false
    setFrozen(false)
    v.currentTime = 0
    void v.play()
  }

  function pick(id: EmotionId) {
    // Only answerable once frozen on the peak frame; ignore repeats/locked.
    if (!frozen || locked || wrong.includes(id)) return
    if (id === q.answer) {
      setLocked(true)
      setCelebrating(true)
      playSuccess()
      speak('Great job!')
      // Positive reinforcement, then resume the clip before moving on.
      void videoRef.current?.play()
      const nextScore = score + (firstTry ? 1 : 0)
      recordStep('answer', { correct: true, answer: q.answer, picked: id, score: nextScore }, { score: nextScore })
      setTimeout(() => {
        setScore(nextScore)
        if (idx + 1 >= quiz.length) {
          reportScore('identifyemotions', nextScore)
          finishGame(nextScore)
          setPhase('over')
        } else {
          setIdx(idx + 1)
          resetQuestion()
        }
      }, 1300)
    } else {
      recordStep('answer', { correct: false, answer: q.answer, picked: id })
      playGentle()
      speak("Let's look again.")
      setFirstTry(false)
      setWrong((w) => [...w, id])
    }
  }

  // Read the freeze prompt aloud (in the primary language) once frozen.
  const freezeSpeak = videoFreezeQuestion(q.clip.gender, DISPLAY_LANGS[0])
  useEffect(() => {
    if (frozen && !celebrating) speak(freezeSpeak)
  }, [frozen, celebrating, freezeSpeak])

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <div className="game-page">
      <div className="game-canvas">
        <div className="quiz-progress">Video {idx + 1} / {quiz.length}</div>
        <div className="video-stage">
          <video
            key={q.clip.slug}
            ref={videoRef}
            className="quiz-video"
            src={q.clip.src}
            autoPlay
            playsInline
            onTimeUpdate={freezeAtPeak}
            onEnded={onEnded}
          />
          <button className="replay-btn" onClick={replay} disabled={locked}>↻ Watch again</button>
        </div>
        {celebrating && <div className="celebrate">⭐</div>}
      </div>
      <div className="game-bottom">
        {frozen ? (
          <div className="prompt-banner er-prompt">
            <div className="er-prompt-lines">
              {DISPLAY_LANGS.map((lang) => (
                <span key={lang} className={`er-prompt-line er-prompt-${lang}`}>
                  {videoFreezeQuestion(q.clip.gender, lang)}
                </span>
              ))}
            </div>
            {speechAvailable() && (
              <button aria-label="Say it again" onClick={() => speak(freezeSpeak)}>🔊</button>
            )}
          </div>
        ) : (
          <div className="prompt-banner er-prompt">
            <div className="er-prompt-lines">
              {DISPLAY_LANGS.map((lang) => (
                <span key={lang} className={`er-prompt-line er-prompt-${lang}`}>
                  {t('watchPrompt', lang)}
                </span>
              ))}
            </div>
          </div>
        )}
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
                {DISPLAY_LANGS.map((lang) => (
                  <span key={lang} className={`choice-label choice-label-${lang}`}>{emotionLabel(id, lang)}</span>
                ))}
              </button>
            )
          })}
        </div>
      </div>
      {phase === 'over' && (
        <QuizResult score={score} total={quiz.length} onRestart={start} />
      )}
    </div>
  )
}
