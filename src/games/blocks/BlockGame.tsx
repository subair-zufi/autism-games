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
import { playGentle, playSuccess } from '../../services/sounds'
import { CONFIG, makeSequence, type BlockSpec } from './logic'
import { BlockScene } from './BlockScene'

const META = GAME_LIST.find((g) => g.id === 'blocks')!
const MAX_LIVES = 3

export function BlockGame() {
  const difficulty = useSettings((s) => s.difficulty.blocks)
  const best = useScores((s) => s.best.blocks)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [sequence, setSequence] = useState<BlockSpec[]>([])
  const [index, setIndex] = useState(0) // blocks placed so far
  const [lives, setLives] = useState(MAX_LIVES)
  const [robotReaching, setRobotReaching] = useState(false)

  const current = index < sequence.length ? sequence[index].owner : 'done'
  const score = Math.floor(index / 2) // child has placed this many blocks

  function start() {
    setSequence(makeSequence(config.rounds))
    setIndex(0)
    setLives(MAX_LIVES)
    setRobotReaching(false)
    setPhase('playing')
  }

  // Robot turns drive themselves on a timer; the child waits.
  useEffect(() => {
    if (phase !== 'playing') return
    if (current === 'done') {
      reportScore('blocks', score)
      speak('You built the whole tower together! Great team work!')
      playSuccess()
      setPhase('over')
      return
    }
    if (current === 'robot') {
      speak('Robi is building. Wait for your turn.')
      const t1 = setTimeout(() => setRobotReaching(true), config.robotTurnMs * 0.55)
      const t2 = setTimeout(() => {
        setRobotReaching(false)
        setIndex((i) => i + 1)
      }, config.robotTurnMs)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    // child's turn: just wait for the button
  }, [index, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function place() {
    if (phase !== 'playing') return
    if (current === 'child') {
      playSuccess()
      speak('Nice block!')
      setIndex((i) => i + 1)
    } else {
      // grabbed during the robot's turn — gently coach patience
      playGentle()
      speak('Almost! Wait a moment for your turn.')
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        reportScore('blocks', score)
        setPhase('over')
      }
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  const yourTurn = current === 'child'
  const promptText = yourTurn
    ? 'Your turn — place a block!'
    : 'Robi is building. Wait for your turn.'

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={config.rounds} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <BlockScene placed={sequence.slice(0, index)} turn={current} robotReaching={robotReaching} />
        </div>
        <div className="game-bottom">
          <PromptBanner text={promptText} />
          <button
            className={yourTurn ? 'walk-btn ready' : 'walk-btn wait'}
            onClick={place}
          >
            {yourTurn ? '🧱 Place block' : '⏳ Wait…'}
          </button>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
