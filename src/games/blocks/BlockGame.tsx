import { useEffect, useMemo, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { PromptBanner } from '../../components/PromptBanner'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { praise, speak } from '../../services/speech'
import { t } from '../../i18n/strings'
import { playGentle, playSuccess } from '../../services/sounds'
import { CONFIG, buildPlayers, makeSequence, type Player, type TurnSpec } from './logic'
import { blockLine } from './strings'
import { BlockScene } from './BlockScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'blocks')!

export function BlockGame() {
  const difficulty = useSettings((s) => s.difficulty.blocks)
  const lang = useSettings((s) => s.language)
  const best = useScores((s) => s.best.blocks)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]
  const { recordStep, finishGame, resetSession } = useGameAnalytics('blocks')

  // Speak a line in the chosen language.
  const say = (key: Parameters<typeof blockLine>[0], params?: Record<string, string>) =>
    speak(blockLine(key, lang, params), lang)

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [players, setPlayers] = useState<Player[]>([])
  const [sequence, setSequence] = useState<TurnSpec[]>([])
  const [index, setIndex] = useState(0) // turns completed
  const [reaching, setReaching] = useState(false)
  // After the child places, they must actively pass the turn to the next
  // player ("Your turn, Leo!") — training the reciprocal hand-off.
  const [handoffTo, setHandoffTo] = useState<Player | null>(null)

  const turn = index < sequence.length ? sequence[index] : null
  const activeIndex = turn ? turn.playerIndex : -1
  const isChildTurn = turn?.kind === 'child' && !handoffTo
  // A peer is building and the child is up next — cue anticipatory waiting.
  const anticipating =
    turn?.kind === 'peer' && !handoffTo && sequence[index + 1]?.kind === 'child'

  // Hard mode: the child places by grabbing the 3D block, not a button.
  const grabMode = config.grab
  const nextChildSpec = useMemo(
    () => sequence.slice(index).find((t) => t.kind === 'child') ?? null,
    [sequence, index],
  )
  const canGrab = grabMode && isChildTurn
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
    setReaching(false)
    setHandoffTo(null)
    setPhase('playing')
  }

  // Peer turns drive themselves on a timer; the child waits for their button.
  useEffect(() => {
    if (phase !== 'playing') return
    if (turn === null) {
      const finalScore = sequence.filter((t) => t.kind === 'child').length
      reportScore('blocks', finalScore)
      finishGame(finalScore)
      say('sayWin')
      playSuccess()
      setPhase('over')
      return
    }
    if (turn.kind === 'peer') {
      // Hold the peer's turn until the child has passed it to them.
      if (handoffTo) return
      const peer = players[turn.playerIndex]
      const childIsNext = sequence[index + 1]?.kind === 'child'
      say(childIsNext ? 'sayPeerNext' : 'sayPeerWait', { name: peer.name })
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
  }, [index, phase, handoffTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // current round number (0-based) for analytics payloads
  const round = Math.floor(index / config.players)

  // Shared success path: the child placed a block via button (easy/medium)
  // or by physically grabbing it (hard).
  function succeedPlace(method: 'button' | 'grab') {
    if (phase !== 'playing' || turn === null || turn.kind !== 'child' || handoffTo) return
    playSuccess()
    say('sayNiceBlock')
    praise()
    recordStep('place_block', { round, slot: index % config.players, method }, { score: score + 1 })
    // Drop the block now (it appears), then require an explicit hand-off to
    // the next player before their turn begins — unless this was the last turn.
    const nextTurn = sequence[index + 1] ?? null
    setIndex((i) => i + 1)
    if (nextTurn) setHandoffTo(players[nextTurn.playerIndex])
  }

  // Acted out of turn — gently coach patience. No-fail: an impatient tap is
  // only redirected, it never ends the session.
  function impatient(source: 'button' | 'grab') {
    playGentle()
    if (handoffTo) {
      // grabbed mid hand-off: remind them to pass first
      say('sayPassFirst', { name: handoffTo.name })
      recordStep('impatient_tap', { round, during: 'handoff', source })
      return
    }
    say('sayWaitTurn')
    recordStep('impatient_tap', {
      round,
      activePlayer: turn ? players[turn.playerIndex]?.id : undefined,
      source,
    })
  }

  function place() {
    if (phase !== 'playing' || turn === null) return
    if (turn.kind === 'child' && !handoffTo) {
      if (grabMode) {
        // hard mode: the button is only a hint — the real action is the grab
        say('sayGrabHint')
        return
      }
      succeedPlace('button')
    } else {
      impatient('button')
    }
  }

  // The child passes the turn to the next player, completing the exchange.
  function passHandoff() {
    if (phase !== 'playing' || !handoffTo) return
    playGentle()
    say('sayHandoff', { name: handoffTo.name })
    recordStep('hand_off', { round, to: handoffTo.id })
    setHandoffTo(null)
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  const promptText = handoffTo
    ? blockLine('promptHandoff', lang, { name: handoffTo.name })
    : isChildTurn
      ? grabMode
        ? blockLine('promptGrab', lang)
        : blockLine('promptPlace', lang)
      : anticipating
        ? blockLine('promptGetReady', lang)
        : blockLine('promptWaitPeer', lang, { name: players[activeIndex]?.name ?? blockLine('friend', lang) })

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={config.rounds} />
        <div className="game-canvas">
          <BlockScene
            placed={sequence.slice(0, index)}
            players={players}
            activeIndex={activeIndex}
            reaching={reaching}
            childNext={anticipating}
            grab={
              grabMode
                ? {
                    spec: nextChildSpec,
                    canGrab,
                    onPlace: () => succeedPlace('grab'),
                    onIllegal: () => impatient('grab'),
                  }
                : null
            }
          />
        </div>
        <div className="game-bottom">
          <PromptBanner text={promptText} lang={lang} />
          <div className="player-btn-row">
            {players.map((p, i) => {
              const active = i === activeIndex
              if (p.kind === 'child') {
                if (handoffTo) {
                  return (
                    <button key={p.id} className="player-btn child handoff" onClick={passHandoff}>
                      <span className="player-emoji">➡️</span>
                      <span>{blockLine('btnHandoff', lang, { name: handoffTo.name })}</span>
                    </button>
                  )
                }
                const cls = isChildTurn
                  ? 'player-btn child ready'
                  : anticipating
                    ? 'player-btn child next'
                    : 'player-btn child wait'
                const label = isChildTurn
                  ? grabMode
                    ? blockLine('btnGrab', lang)
                    : blockLine('btnPlace', lang)
                  : anticipating
                    ? blockLine('btnNext', lang)
                    : blockLine('btnWait', lang)
                return (
                  <button key={p.id} className={cls} onClick={place}>
                    <span className="player-emoji">{p.emoji}</span>
                    <span>{label}</span>
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
          <GameOverDialog score={score} best={Math.max(best, score)} message={t('greatPlaying', lang)} lang={lang} onRestart={start} onChooseLevel={() => setPhase('start')} />
        )}
      </div>
    </WebGLGate>
  )
}
