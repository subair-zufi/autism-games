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
import { playGentle, playSuccess } from '../../services/sounds'
import { CONFIG, queueColors } from './logic'
import { SliderScene } from './SliderScene'

const META = GAME_LIST.find((g) => g.id === 'slider')!
const MAX_LIVES = 3
/** how long the child's own slide animation plays before the next round */
const YOUR_SLIDE_MS = 1500

export function SliderGame() {
  const difficulty = useSettings((s) => s.difficulty.slider)
  const best = useScores((s) => s.best.slider)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [ahead, setAhead] = useState(config.queue) // kids still in front of you
  const [yourTurn, setYourTurn] = useState(false)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(MAX_LIVES)
  const [colors, setColors] = useState<string[]>(() => queueColors(config.queue))
  // bump to send a character down the slide; `you` decides whose turn it is
  const [slide, setSlide] = useState<{ trigger: number; you: boolean }>({ trigger: 0, you: false })
  const [youSliding, setYouSliding] = useState(false) // your own slide animation is playing
  const sliding = useRef(false) // same flag for the turn-timer effect (synchronous)

  function start() {
    setAhead(config.queue)
    setYourTurn(false)
    setScore(0)
    setLives(MAX_LIVES)
    setColors(queueColors(config.queue))
    setSlide({ trigger: 0, you: false })
    setYouSliding(false)
    sliding.current = false
    setPhase('playing')
  }

  // The kids ahead take their turns on a timer; the child waits.
  useEffect(() => {
    if (phase !== 'playing' || sliding.current) return
    if (ahead > 0) {
      const t = setTimeout(() => {
        // the front kid slides down, then leaves the queue
        setSlide((s) => ({ trigger: s.trigger + 1, you: false }))
        setAhead((a) => a - 1)
      }, config.turnMs)
      return () => clearTimeout(t)
    }
    // no one left ahead — it's the child's turn
    if (!yourTurn) {
      setYourTurn(true)
      speak("It's your turn now! Tap Slide!")
    }
  }, [ahead, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function goSlide() {
    if (phase !== 'playing' || sliding.current) return
    if (!yourTurn) {
      // tapped while others are still going — gently coach patience
      playGentle()
      speak('Not yet — wait for your turn in the line.')
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        reportScore('slider', score)
        setPhase('over')
      }
      return
    }

    // your turn! slide down
    sliding.current = true
    setYouSliding(true)
    setYourTurn(false)
    setSlide((s) => ({ trigger: s.trigger + 1, you: true }))
    playSuccess()
    const nextScore = score + 1
    setScore(nextScore)

    if (nextScore >= config.goal) {
      speak('Wheee! You waited so well and had your turn! You win!')
      reportScore('slider', nextScore)
      setTimeout(() => setPhase('over'), YOUR_SLIDE_MS)
      return
    }

    speak('Wheee! Great waiting! Back in line for another turn.')
    setTimeout(() => {
      setColors(queueColors(config.queue))
      setAhead(config.queue)
      setYouSliding(false)
      sliding.current = false
    }, YOUR_SLIDE_MS)
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  const promptText = yourTurn
    ? "It's your turn — tap Slide!"
    : 'Wait in line. Everyone takes a turn on the slide.'

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={config.goal} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <SliderScene
            ahead={ahead}
            queueColors={colors}
            showYou={!youSliding}
            slideTrigger={slide.trigger}
            sliderIsYou={slide.you}
          />
          {youSliding && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={promptText} />
          <button
            className={yourTurn ? 'walk-btn ready' : 'walk-btn wait'}
            onClick={goSlide}
          >
            {yourTurn ? '🛝 Slide!' : '⏳ Wait…'}
          </button>
          <p className="hint-text">
            {yourTurn
              ? 'Everyone has gone — now slide!'
              : `${ahead} ${ahead === 1 ? 'kid is' : 'kids are'} ahead of you.`}
          </p>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
