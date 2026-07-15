import { useEffect, useMemo, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { speakAll, speechAvailable } from '../../services/speech'
import { t } from '../../i18n/strings'
import { playGentle, playSuccess } from '../../services/sounds'
import { CONFIG, buildPlayers, makeSequence, peerBearingDeg, type Player, type TurnSpec } from './logic'
import { prLine, prLines, prSpeak, type Playroom360MessageKey } from './strings'
import { Playroom360Scene } from './Playroom360Scene'
import { xrStore, vrSupported } from './xrStore'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'playroom360')!

/**
 * Playroom 360 — the immersive first-person copy of Block Buddies. The turn
 * rotation, no-fail coaching, scoring and difficulty ladder are identical
 * (see blocks/BlockGame.tsx); what changes is the point of view: the child
 * sits AT the play table, the friends stand across the front half-circle, and
 * placing/hand-off happen by tapping things in the world (or grabbing, on
 * hard) — so the whole exchange works the same on a screen and in VR.
 */
export function Playroom360Game() {
  const difficulty = useSettings((s) => s.difficulty.playroom360)
  const lang = useSettings((s) => s.language)
  const best = useScores((s) => s.best.playroom360)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]
  const { recordStep, finishGame, resetSession } = useGameAnalytics('playroom360')

  // Speak a line in the chosen language.
  const say = (key: Playroom360MessageKey, params?: Record<string, string>) =>
    speakAll(prSpeak(key, lang, params))

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [players, setPlayers] = useState<Player[]>([])
  const [sequence, setSequence] = useState<TurnSpec[]>([])
  const [index, setIndex] = useState(0) // turns completed
  const [reaching, setReaching] = useState(false)
  // After the child places, they must actively pass the turn to the next
  // player (tap the friend) — training the reciprocal hand-off.
  const [handoffTo, setHandoffTo] = useState<Player | null>(null)
  /** the one-time "drag to look around" hint, dismissed on the first look */
  const [hintSeen, setHintSeen] = useState(false)
  /** whether this browser can enter immersive VR (Quest etc.) — shows the button */
  const [canVR, setCanVR] = useState(false)

  const turn = index < sequence.length ? sequence[index] : null
  const activeIndex = turn ? turn.playerIndex : -1
  const isChildTurn = turn?.kind === 'child' && !handoffTo
  // A peer is building and the child is up next — cue anticipatory waiting.
  const anticipating =
    turn?.kind === 'peer' && !handoffTo && sequence[index + 1]?.kind === 'child'

  // Hard mode: the child places by grabbing the 3D block, not a tap.
  const grabMode = config.grab
  const nextChildSpec = useMemo(
    () => sequence.slice(index).find((t) => t.kind === 'child') ?? null,
    [sequence, index],
  )
  const score = useMemo(
    () => sequence.slice(0, index).filter((t) => t.kind === 'child').length,
    [sequence, index],
  )

  useEffect(() => {
    void vrSupported().then(setCanVR)
  }, [])

  // When the session ends, leave immersive VR so the (DOM) results dialog and
  // level picker are visible again on the headset's browser.
  useEffect(() => {
    if (phase === 'over') void xrStore.getState().session?.end()
  }, [phase])

  function start() {
    resetSession()
    const ps = buildPlayers(config.players)
    setPlayers(ps)
    setSequence(makeSequence(config, ps))
    setIndex(0)
    setReaching(false)
    setHandoffTo(null)
    setHintSeen(false)
    setPhase('playing')
  }

  // Peer turns drive themselves on a timer; the child's turn waits for them.
  useEffect(() => {
    if (phase !== 'playing') return
    if (turn === null) {
      const finalScore = sequence.filter((t) => t.kind === 'child').length
      reportScore('playroom360', finalScore)
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
    // child's turn: wait for the tap/grab in the scene
  }, [index, phase, handoffTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // current round number (0-based) for analytics payloads
  const round = Math.floor(index / config.players)

  // Shared success path: the child placed a block by tapping it (easy/medium)
  // or by physically grabbing it onto the tower (hard).
  function succeedPlace(method: 'tap' | 'grab') {
    if (phase !== 'playing' || turn === null || turn.kind !== 'child' || handoffTo) return
    playSuccess()
    say('sayNiceBlock')
    recordStep('place_block', { round, slot: index % config.players, method }, { score: score + 1 })
    // Drop the block now (it appears), then require an explicit hand-off to
    // the next player before their turn begins — unless this was the last turn.
    const nextTurn = sequence[index + 1] ?? null
    setIndex((i) => i + 1)
    if (nextTurn) setHandoffTo(players[nextTurn.playerIndex])
  }

  // Acted out of turn — gently coach patience. No-fail: an impatient tap is
  // only redirected, it never ends the session.
  function impatient(source: 'tap' | 'grab') {
    if (phase !== 'playing') return
    playGentle()
    if (handoffTo) {
      // touched the block mid hand-off: remind them to pass first
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

  // The child passes the turn by tapping the next player, completing the
  // exchange — in 360 this is also an attention shift toward that friend.
  function passHandoff() {
    if (phase !== 'playing' || !handoffTo) return
    playGentle()
    say('sayHandoff', { name: handoffTo.name })
    const toIndex = players.findIndex((p) => p.id === handoffTo.id)
    recordStep('hand_off', {
      round,
      to: handoffTo.id,
      // how far the child had to turn to face the next player — the 360
      // attention-shift size, recorded like Football 360's targetBearingDeg
      targetBearingDeg: handoffTo.kind === 'peer' ? peerBearingDeg(toIndex, config.players) : 0,
    })
    setHandoffTo(null)
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  // Which bilingual line the banner shows for the current state (and its 🔊).
  let promptKey: Playroom360MessageKey
  let promptParams: Record<string, string> | undefined
  if (handoffTo) {
    promptKey = 'promptHandoff'
    promptParams = { name: handoffTo.name }
  } else if (isChildTurn) {
    promptKey = grabMode ? 'promptGrab' : 'promptPlace'
  } else if (anticipating) {
    promptKey = 'promptGetReady'
  } else {
    promptKey = 'promptWaitPeer'
    promptParams = { name: players[activeIndex]?.name ?? prLine('friend', lang) }
  }

  const handoffIndex = handoffTo && handoffTo.kind === 'peer' ? players.findIndex((p) => p.id === handoffTo.id) : null

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} goal={config.rounds} />
        <div className="game-canvas" onPointerDown={() => setHintSeen(true)}>
          <Playroom360Scene
            players={players}
            placed={sequence.slice(0, index)}
            activeIndex={activeIndex}
            reaching={reaching}
            childNext={anticipating}
            childTurn={!!isChildTurn}
            grabMode={grabMode}
            nextChildSpec={nextChildSpec}
            handoffIndex={handoffIndex}
            onPlace={succeedPlace}
            onIllegal={impatient}
            onGrabHint={() => say('sayGrabHint')}
            onHandoff={passHandoff}
            hudScore={`🧱 ${score} / ${config.rounds}`}
            hudPrompt={prLine(promptKey, lang, promptParams)}
            bubbleTap={prLine('bubbleMyTurn', lang)}
          />
          {canVR && (
            <button
              onClick={() => xrStore.enterVR()}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                padding: '10px 16px',
                borderRadius: 22,
                border: 'none',
                background: 'rgba(234, 88, 12, 0.92)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: 'pointer',
              }}
            >
              🥽 {prLine('enterVR', lang)}
            </button>
          )}
          {!hintSeen && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '14%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: 24,
                fontSize: '1.05rem',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              👈 {prLine('hintLook', lang)} 👉
            </div>
          )}
        </div>
        <div className="game-bottom">
          <div className="prompt-banner er-prompt">
            <div className="er-prompt-lines">
              {prLines(promptKey, lang, promptParams).map(({ lang: l, text }) => (
                <span key={l} className={`er-prompt-line er-prompt-${l}`}>
                  {text}
                </span>
              ))}
            </div>
            {speechAvailable() && (
              <button aria-label="Say it again" onClick={() => say(promptKey, promptParams)}>
                🔊
              </button>
            )}
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={score}
            best={Math.max(best, score)}
            message={t('greatPlaying', lang)}
            lang={lang}
            onRestart={start}
            onChooseLevel={() => setPhase('start')}
          />
        )}
      </div>
    </WebGLGate>
  )
}
