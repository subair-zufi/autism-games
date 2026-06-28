import { useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { PromptBanner } from '../../components/PromptBanner'
import { QuizResult } from '../../components/QuizResult'
import { speak } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { emotionMeta, type EmotionId } from '../emotionVocab'
import { buildQuiz, type Question } from './logic'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'knowemotion')!
const POS_LABEL = ['left', 'middle', 'right']

// Position word for panel `i` in a photo of `count` people: 2-person photos read
// left/right, 3-person photos read left/middle/right.
function posLabel(i: number, count: number): string {
  return count === 2 ? (i === 0 ? 'left' : 'right') : POS_LABEL[i]
}

function promptText(q: Question): string {
  if (q.type === 'find') return `Who is feeling ${emotionMeta(q.targetEmotion).label.toLowerCase()}?`
  return `What is the ${posLabel(q.position, q.photo.emotions.length)} one feeling?`
}

export function KnowEmotionGame() {
  const difficulty = useSettings((s) => s.difficulty.knowemotion)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('knowemotion')

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [quiz, setQuiz] = useState<Question[]>(() => buildQuiz(difficulty))
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [firstTry, setFirstTry] = useState(true)
  const [locked, setLocked] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [wrongFind, setWrongFind] = useState<number[]>([])
  const [wrongName, setWrongName] = useState<EmotionId[]>([])
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)

  const q = quiz[idx]
  const imgLoaded = loadedSrc === q.photo.src
  const colWidth = 100 / q.photo.emotions.length

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
    setWrongFind([])
    setWrongName([])
    setLoadedSrc(null)
  }

  function advance(gained: number) {
    setLocked(true)
    setCelebrating(true)
    playSuccess()
    speak('Great job!')
    const nextScore = score + gained
    setTimeout(() => {
      setScore(nextScore)
      if (idx + 1 >= quiz.length) {
        reportScore('knowemotion', nextScore)
        finishGame(nextScore)
        setPhase('over')
      } else {
        setIdx(idx + 1)
        resetQuestion()
      }
    }, 1300)
  }

  function wrong() {
    playGentle()
    speak("Let's look again.")
    setFirstTry(false)
  }

  function pickRegion(i: number) {
    if (locked || q.type !== 'find' || wrongFind.includes(i)) return
    if (i === q.answerIndex) {
      recordStep('answer', { correct: true, type: q.type, targetEmotion: q.targetEmotion, picked: i, score: score + (firstTry ? 1 : 0) }, { score: score + (firstTry ? 1 : 0) })
      advance(firstTry ? 1 : 0)
    } else {
      recordStep('answer', { correct: false, type: q.type, targetEmotion: q.targetEmotion, picked: i })
      setWrongFind((w) => [...w, i])
      wrong()
    }
  }

  function pickEmotion(id: EmotionId) {
    if (locked || q.type !== 'name' || wrongName.includes(id)) return
    if (id === q.answer) {
      recordStep('answer', { correct: true, type: q.type, answer: q.answer, picked: id, score: score + (firstTry ? 1 : 0) }, { score: score + (firstTry ? 1 : 0) })
      advance(firstTry ? 1 : 0)
    } else {
      recordStep('answer', { correct: false, type: q.type, answer: q.answer, picked: id })
      setWrongName((w) => [...w, id])
      wrong()
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  return (
    <div className="game-page">
      <div className="game-canvas">
        <div className="quiz-progress">Question {idx + 1} / {quiz.length}</div>
        <div className="video-stage">
          <div className="group-photo-wrap">
            {!imgLoaded && <div className="emotion-img-loader"><div className="emotion-spinner" /></div>}
            <img
              className="group-photo"
              style={{ opacity: imgLoaded ? 1 : 0 }}
              src={q.photo.src}
              alt="Children showing different feelings"
              onLoad={() => setLoadedSrc(q.photo.src)}
              onError={() => setLoadedSrc(q.photo.src)}
            />
            {q.photo.emotions.map((_, i) => (
              <button
                key={i}
                className={
                  'tap-region' + (q.type === 'name' && i === q.position ? ' highlight' : '')
                }
                style={{ left: `${i * colWidth}%`, width: `${colWidth}%` }}
                disabled={q.type !== 'find' || locked || wrongFind.includes(i)}
                aria-label={`${posLabel(i, q.photo.emotions.length)} person`}
                onClick={() => pickRegion(i)}
              />
            ))}
          </div>
        </div>
        {celebrating && <div className="celebrate">⭐</div>}
      </div>
      <div className="game-bottom">
        <PromptBanner text={promptText(q)} />
        {q.type === 'name' && (
          <div className="choice-row">
            {q.choices.map((id) => {
              const m = emotionMeta(id)
              return (
                <button
                  key={id}
                  className="choice-btn"
                  disabled={locked || wrongName.includes(id)}
                  onClick={() => pickEmotion(id)}
                >
                  <span className="choice-emoji">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      {phase === 'over' && (
        <QuizResult score={score} total={quiz.length} onRestart={start} />
      )}
    </div>
  )
}
