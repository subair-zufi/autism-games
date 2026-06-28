import { useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { PromptBanner } from '../../components/PromptBanner'
import { QuizResult } from '../../components/QuizResult'
import { speak } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { emotionMeta, type EmotionId } from '../emotionVocab'
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
  }

  function replay() {
    const v = videoRef.current
    if (v) { v.currentTime = 0; void v.play() }
  }

  function pick(id: EmotionId) {
    if (locked || wrong.includes(id)) return
    if (id === q.answer) {
      setLocked(true)
      setCelebrating(true)
      playSuccess()
      speak('Great job!')
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
            muted
            loop
            playsInline
          />
          <button className="replay-btn" onClick={replay}>↻ Watch again</button>
        </div>
        {celebrating && <div className="celebrate">⭐</div>}
      </div>
      <div className="game-bottom">
        <PromptBanner text="What emotion is shown in this video?" />
        <div className="choice-row">
          {q.choices.map((id) => {
            const m = emotionMeta(id)
            return (
              <button
                key={id}
                className="choice-btn"
                disabled={locked || wrong.includes(id)}
                onClick={() => pick(id)}
              >
                <span className="choice-emoji">{m.emoji}</span>
                <span>{m.label}</span>
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
