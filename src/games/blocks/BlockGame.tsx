import { useEffect, useMemo, useState } from 'react'
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
import { CONFIG, buildPlayers, makeSequence, type Player, type TurnSpec } from './logic'
import { BlockScene } from './BlockScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'blocks')!
const MAX_LIVES = 3

export function BlockGame() {
  const difficulty = useSettings((s) => s.difficulty.blocks)
  const best = useScores((s) => s.best.blocks)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]
  const { recordStep, finishGame, resetSession } = useGameAnalytics('blocks')

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [players, setPlayers] = useState<Player[]>([])
  const [sequence, setSequence] = useState<TurnSpec[]>([])
  const [index, setIndex] = useState(0) // turns completed
  const [lives, setLives] = useState(MAX_LIVES)
  const [reaching, setReaching] = useState(false)

  const turn = index < sequence.length ? sequence[index] : null
  const activeIndex = turn ? turn.playerIndex : -1
  const isChildTurn = turn?.kind === 'child'
  const score = useMemo(
    () => sequence.slice(0, index).filter((t) => t.kind === 'child').length,
    [sequence, index],
  )

  function start() {
    resetSession()
    const ps = buildPlayers(config.players)
    setPlayers(ps)
    setSequence(makeSequence(config, ps))
    setIndex(0)
    setLives(MAX_LIVES)
    setReaching(false)
    setPhase('playing')
  }

  // Peer turns drive themselves on a timer; the child waits for their button.
  useEffect(() => {
    if (phase !== 'playing') return
    if (turn === null) {
      const finalScore = sequence.filter((t) => t.kind === 'child').length
      reportScore('blocks', finalScore)
      finishGame(finalScore)
      speak('You built the whole tower together! Great team work!')
      playSuccess()
      setPhase('over')
      return
    }
    if (turn.kind === 'peer') {
      const peer = players[turn.playerIndex]
      speak(`${peer.name} is building. Wait for your turn.`)
      const t1 = setTimeout(() => setReaching(true), config.peerTurnMs * 0.55)
      const t2 = setTimeout(() => {
        setReaching(false)
        setIndex((i) => i + 1)
      }, config.peerTurnMs)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    // child's turn: wait for the button
  }, [index, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // current round number (0-based) for analytics payloads
  const round = Math.floor(index / config.players)

  function place() {
    if (phase !== 'playing' || turn === null) return
    if (turn.kind === 'child') {
      playSuccess()
      speak('Nice block!')
      recordStep('place_block', { round, slot: index % config.players }, { score: score + 1 })
      setIndex((i) => i + 1)
    } else {
      // grabbed during a peer's turn — gently coach patience
      playGentle()
      speak('Almost! Wait a moment for your turn.')
      recordStep('impatient_tap', { round, activePlayer: players[turn.playerIndex]?.id })
      const next = lives - 1
      setLives(next)
      if (next <= 0) {
        reportScore('blocks', score)
        finishGame(score)
        setPhase('over')
      }
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  const promptText = isChildTurn
    ? 'Your turn — place a block!'
    : `${players[activeIndex]?.name ?? 'A friend'} is building. Wait for your turn.`

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={config.rounds} lives={lives} maxLives={MAX_LIVES} />
        <div className="game-canvas">
          <BlockScene placed={sequence.slice(0, index)} players={players} activeIndex={activeIndex} reaching={reaching} />
        </div>
        <div className="game-bottom">
          <PromptBanner text={promptText} />
          <div className="player-btn-row">
            {players.map((p, i) => {
              const active = i === activeIndex
              if (p.kind === 'child') {
                return (
                  <button
                    key={p.id}
                    className={isChildTurn ? 'player-btn child ready' : 'player-btn child wait'}
                    onClick={place}
                  >
                    <span className="player-emoji">{p.emoji}</span>
                    <span>{isChildTurn ? '🧱 Place' : '⏳ Wait'}</span>
                  </button>
                )
              }
              return (
                <div key={p.id} className={active ? 'player-btn peer active' : 'player-btn peer'}>
                  <span className="player-emoji">{p.emoji}</span>
                  <span>{p.name}</span>
                </div>
              )
            })}
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog score={score} best={Math.max(best, score)} onRestart={start} />
        )}
      </div>
    </WebGLGate>
  )
}
