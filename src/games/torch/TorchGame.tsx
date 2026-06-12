import { useEffect, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { speak } from '../../services/speech'
import { playGentle, playSuccess, playTap } from '../../services/sounds'
import { CONFIG, nextQuestion, type Answer, type Question } from './logic'
import { TorchScene } from './TorchScene'

const META = GAME_LIST.find((g) => g.id === 'torch')!
const MAX_LIVES = 3

type Turn = 'robot-ask' | 'child' | 'robot-reply'

export function TorchGame() {
  const difficulty = useSettings((s) => s.difficulty.torch)
  const best = useScores((s) => s.best.torch)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [question, setQuestion] = useState<Question>(() => nextQuestion(null))
  const [turn, setTurn] = useState<Turn>('robot-ask')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [exchange, setExchange] = useState(0)

  function start() {
    setQuestion(nextQuestion(null))
    setTurn('robot-ask')
    setScore(0)
    setLives(MAX_LIVES)
    setExchange(0)
    setPhase('playing')
  }

  // Robot phases drive themselves on timers; the child waits for the blue torch.
  useEffect(() => {
    if (phase !== 'playing') return
    if (turn === 'robot-ask') {
      speak(`Robi has the torch. ${question.ask}`)
      const t = setTimeout(() => {
        speak('Your turn! The torch is blue now.')
        setTurn('child')
      }, config.robotMs)
      return () => clearTimeout(t)
    }
    if (turn === 'robot-reply') {
      const t = setTimeout(() => {
        if (exchange >= config.exchanges) {
          reportScore('torch', score)
          setPhase('over')
          return
        }
        setQuestion((q) => nextQuestion(q.id))
        setTurn('robot-ask')
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [turn, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function answer(a: Answer) {
    if (phase !== 'playing') return
    if (turn === 'child') {
      playTap()
      playSuccess()
      speak(`${a.label}! ${question.reply}`)
      setScore((s) => s + 1)
      setExchange((e) => e + 1)
      setTurn('robot-reply')
    } else {
      // spoke while the robot held the torch — coach waiting
      playGentle()
      speak('Almost! Wait for the torch to turn blue.')
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        reportScore('torch', score)
        setPhase('over')
      }
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  const yourTurn = turn === 'child'
  const promptText = yourTurn
    ? `${question.ask} Pick your answer!`
    : turn === 'robot-ask'
      ? 'Robi has the torch. Wait for your turn…'
      : 'Robi is replying. Wait for the torch…'

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <TorchScene
            holder={yourTurn ? 'child' : 'robot'}
            robotTalking={turn !== 'child'}
          />
          <div className="action-bubble">{yourTurn ? '🔵' : '🟠'}</div>
        </div>
        <div className="game-bottom">
          <PromptBanner text={promptText} />
          <div className="choice-row">
            {question.answers.map((a) => (
              <button
                key={a.id}
                className="choice-btn"
                style={yourTurn ? undefined : { opacity: 0.55 }}
                onClick={() => answer(a)}
              >
                <span className="choice-emoji">{a.emoji}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
