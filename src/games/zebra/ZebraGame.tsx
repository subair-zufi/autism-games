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
import {
  LEVELS,
  advanceTraffic,
  canWalk,
  initialTraffic,
  type LightPhase,
  type TrafficState,
} from './logic'
import { ZebraScene } from './ZebraScene'

const META = GAME_LIST.find((g) => g.id === 'zebra')!

export function ZebraGame() {
  const difficulty = useSettings((s) => s.difficulty.zebra)
  const best = useScores((s) => s.best.zebra)
  const reportScore = useScores((s) => s.reportScore)
  const level = LEVELS[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [light, setLight] = useState<LightPhase>('cars-go')
  const [score, setScore] = useState(0)
  const [walking, setWalking] = useState(false)
  const [walkTrigger, setWalkTrigger] = useState(0)
  const [shakeTrigger, setShakeTrigger] = useState(0)

  const traffic = useRef<TrafficState>(initialTraffic())
  const scoreRef = useRef(0)

  // run the traffic-light clock while playing; only re-render React on a phase
  // change so the WALK button stays in sync without a render every frame
  useEffect(() => {
    if (phase !== 'playing') return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const prev = traffic.current.phase
      const next = advanceTraffic(traffic.current, dt, level.durations)
      traffic.current = next
      if (next.phase !== prev) setLight(next.phase)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, level])

  function start() {
    traffic.current = initialTraffic()
    scoreRef.current = 0
    setScore(0)
    setLight('cars-go')
    setWalking(false)
    setWalkTrigger(0)
    setShakeTrigger(0)
    setPhase('playing')
  }

  function pressWalk() {
    if (phase !== 'playing' || walking) return
    if (canWalk(light)) {
      setWalking(true)
      setWalkTrigger((t) => t + 1)
    } else {
      // safe teaching moment — never a failure
      playGentle()
      speak("Wait — the cars haven't stopped.")
      setShakeTrigger((t) => t + 1)
    }
  }

  function handleCrossed() {
    setWalking(false)
    playSuccess()
    const n = scoreRef.current + 1
    scoreRef.current = n
    setScore(n)
    if (n >= level.goal) {
      speak('You crossed safely! Wonderful walking!')
      reportScore('zebra', n)
      setPhase('over')
    } else {
      speak('You crossed safely! Well done!')
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  const safe = canWalk(light)
  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} />
        <div className="game-canvas">
          <ZebraScene
            phase={light}
            level={level}
            walkTrigger={walkTrigger}
            shakeTrigger={shakeTrigger}
            onCrossed={handleCrossed}
          />
        </div>
        <div className="game-bottom">
          <PromptBanner text={`Cross when the walk light is green. ${score} of ${level.goal}.`} />
          <button
            className={safe ? 'walk-btn ready' : 'walk-btn wait'}
            onClick={pressWalk}
            disabled={walking}
          >
            {safe ? '🚶 WALK' : '✋ WAIT'}
          </button>
          <p className="hint-text">
            {safe ? 'The cars have stopped — tap WALK!' : 'Watch the light. Wait for the cars to stop.'}
          </p>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
