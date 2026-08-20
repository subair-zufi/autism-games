import { useEffect, useMemo, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { praise, speakAll, speechAvailable } from '../../services/speech'
import { t } from '../../i18n/strings'
import { playGentle, playSuccess } from '../../services/sounds'
import { CONFIG, buildPlayers, makeSequence, peerBearingDeg, starsFor, type Player, type TurnSpec } from './logic'
import { useLevelProgress } from '../progression'
import { prLine, prLines, prSpeak, type Playroom360MessageKey } from './strings'
import { Playroom360Scene } from './Playroom360Scene'
import { xrStore, vrSupported } from './xrStore'
import { useVrSessionActive } from '../vrSession'
import { VRWaitingRoom } from '../VRWaitingRoom'
import { useVrGameOverPanel } from '../gameOverPanel'
import { useGameAnalytics } from '../useGameAnalytics'
import { beginHeadWindow, headMetrics } from '../headTracking'
import { VRPracticeScene } from '../vrPractice/VRPracticeScene'

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
  const inputMethod = useSettings((s) => s.inputMethod)
  const vrPracticeDone = useSettings((s) => s.vrPracticeDone)
  const setVrPracticeDone = useSettings((s) => s.setVrPracticeDone)
  const best = useScores((s) => s.best.playroom360)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]
  const { recordStep, finishGame, resetSession } = useGameAnalytics('playroom360', xrStore)
  /**
   * Per-level progression: blocks placed is NOT a measure here — the child
   * always gets exactly one turn per round, so it is `config.rounds` every
   * session and would read as 100% mastered every time. What varies, and what
   * the game actually trains, is *waiting*: the reported accuracy is
   * placements / (placements + out-of-turn taps), matching how the server's
   * `_blocks_trials` already scores Block Buddies (a placement is a success,
   * an impatient tap a failure).
   */
  const { submit } = useLevelProgress('playroom360')
  const [impatientTaps, setImpatientTaps] = useState(0)
  /** 1–3 stars for the finished session; the other five 360 games all show
   *  them, and Playroom was the only one ending on a bare score. */
  const [stars, setStars] = useState(0)

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
  // Brief ⭐ pop over the scene on each block placed (matches the praise voice).
  const [celebrating, setCelebrating] = useState(false)
  /** the one-time "drag to look around" hint, dismissed on the first look */
  const [hintSeen, setHintSeen] = useState(false)
  /** whether this browser can enter immersive VR (Quest etc.) — shows the button */
  const [canVR, setCanVR] = useState(false)
  /** whether the headset is actually presenting right now, vs. the flat pre-VR screen */
  const vrActive = useVrSessionActive(xrStore)
  /**
   * The child selects by gaze right now — inside a headset with the default
   * dwell method. Then the instruction verb is "look", not "tap": with gaze
   * there is no tap, so "look at your block / friend" describes what the child
   * actually does. On a flat screen (mouse) or the VR controller ray, it stays
   * "tap". Drives both the spoken line and the on-screen/in-world banners.
   */
  const gazeSelect = vrActive && inputMethod === 'dwell'
  /** Play was pressed on a VR-capable browser, but the session hasn't started
   *  yet — held here instead of calling `start()` so the turn sequence never
   *  begins on the flat screen before the child is actually in the headset. */
  const [awaitingVr, setAwaitingVr] = useState(false)

  const turn = index < sequence.length ? sequence[index] : null
  const activeIndex = turn ? turn.playerIndex : -1
  const isChildTurn = turn?.kind === 'child' && !handoffTo
  // A peer is building and the child is up next — cue anticipatory waiting.
  const anticipating =
    turn?.kind === 'peer' && !handoffTo && sequence[index + 1]?.kind === 'child'

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

  // The moment the child actually enters VR after Play was pressed on a
  // capable browser — this is the one true start signal on that path.
  useEffect(() => {
    if (awaitingVr && vrActive) {
      setAwaitingVr(false)
      start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingVr, vrActive])

  // Results stay inside VR. Ending the session here (as this used to) is
  // what dropped the child into the Quest home environment with no window
  // to come back to — every completed game, not just Quit.
  useVrGameOverPanel({
    over: phase === 'over',
    headline: t('greatPlaying', lang),
    score,
    best: Math.max(best, score),
    stars,
    lang,
    gameId: 'playroom360',
    level: difficulty,
    onRestart: handlePlayPress,
  })

  function start() {
    resetSession()
    const ps = buildPlayers(config.players)
    setPlayers(ps)
    setSequence(makeSequence(config, ps))
    setIndex(0)
    setReaching(false)
    setHandoffTo(null)
    setHintSeen(false)
    setImpatientTaps(0)
    setStars(0)
    setPhase('playing')
  }

  /** Play button handler: on a VR-capable browser, wait for the child to
   *  actually enter VR before `start()` runs (see the effect above). */
  function handlePlayPress() {
    if (canVR && !vrActive) {
      setAwaitingVr(true)
      return
    }
    start()
  }

  // Peer turns drive themselves on a timer; the child's turn waits for them.
  useEffect(() => {
    if (phase !== 'playing') return
    if (turn === null) {
      const finalScore = sequence.filter((t) => t.kind === 'child').length
      reportScore('playroom360', finalScore)
      // same placements/actions pair the stars are computed from, so the
      // child's reward and the recorded accuracy can never disagree
      void submit(difficulty, finalScore, finalScore + impatientTaps)
      setStars(starsFor(finalScore, finalScore + impatientTaps))
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
    // child's turn: it used to open silently, so a child who can't read the
    // banner had no signal it was their turn. Give a clear, language-free cue —
    // a chime plus the spoken "your turn" — alongside the block's ring/arrow.
    if (!handoffTo) {
      playGentle()
      say(gazeSelect ? 'promptPlaceGaze' : 'promptPlace')
    }
    // open a head-telemetry window (measures where they look during their own
    // turn and the hand-off) and wait for the tap
    beginHeadWindow()
  }, [index, phase, handoffTo]) // eslint-disable-line react-hooks/exhaustive-deps

  // current round number (0-based) for analytics payloads
  const round = Math.floor(index / config.players)

  // The child placed a block by tapping their glowing block on the table.
  function succeedPlace() {
    if (phase !== 'playing' || turn === null || turn.kind !== 'child' || handoffTo) return
    playSuccess()
    say('sayNiceBlock')
    praise()
    setCelebrating(true)
    setTimeout(() => setCelebrating(false), 1300)
    recordStep('place_block', { round, slot: index % config.players, method: 'tap', ...headMetrics() }, { score: score + 1 })
    // Drop the block now (it appears), then require an explicit hand-off to
    // the next player before their turn begins — unless this was the last turn.
    const nextTurn = sequence[index + 1] ?? null
    setIndex((i) => i + 1)
    if (nextTurn) setHandoffTo(players[nextTurn.playerIndex])
  }

  // Tapped the block out of turn — gently coach patience. No-fail: an impatient
  // tap is only redirected, it never ends the session.
  function impatient() {
    if (phase !== 'playing') return
    playGentle()
    setImpatientTaps((n) => n + 1)
    if (handoffTo) {
      // tapped the block mid hand-off: remind them to pass first
      say('sayPassFirst', { name: handoffTo.name })
      recordStep('impatient_tap', { round, during: 'handoff', source: 'tap' })
      return
    }
    say('sayWaitTurn')
    recordStep('impatient_tap', {
      round,
      activePlayer: turn ? players[turn.playerIndex]?.id : undefined,
      source: 'tap',
    })
  }

  // The child passes the turn by tapping the next player, completing the
  // exchange — in 360 this is also an attention shift toward that friend.
  function passHandoff() {
    if (phase !== 'playing' || !handoffTo) return
    playGentle()
    say('sayHandoff', { name: handoffTo.name })
    const toIndex = players.findIndex((p) => p.id === handoffTo.id)
    const targetBearingDeg = handoffTo.kind === 'peer' ? peerBearingDeg(toIndex, config.players) : 0
    recordStep('hand_off', {
      round,
      to: handoffTo.id,
      // how far the child had to turn to face the next player — the 360
      // attention-shift size, recorded like Football 360's targetBearingDeg
      targetBearingDeg,
      ...headMetrics(targetBearingDeg),
    })
    setHandoffTo(null)
  }

  // one-time, unscored warm-up before this child's very first real session
  // (review U2): teaches the headset look-around + tap gesture. Shown only
  // when the browser can actually enter immersive VR — on a flat desktop
  // there's no headset novelty and it's just friction, so it's skipped.
  if (canVR && !vrPracticeDone) return <VRPracticeScene onComplete={() => setVrPracticeDone(true)} />

  if (phase === 'start' && !awaitingVr) {
    return (
      <StartScreen
        game={META}
        onStart={handlePlayPress}
        levelNotes={{
          easy: prLine('noteEasy', lang),
          medium: prLine('noteMedium', lang),
          hard: prLine('noteHard', lang),
        }}
      />
    )
  }

  // Which bilingual line the banner shows for the current state (and its 🔊).
  let promptKey: Playroom360MessageKey
  let promptParams: Record<string, string> | undefined
  if (handoffTo) {
    promptKey = gazeSelect ? 'promptHandoffGaze' : 'promptHandoff'
    promptParams = { name: handoffTo.name }
  } else if (isChildTurn) {
    promptKey = gazeSelect ? 'promptPlaceGaze' : 'promptPlace'
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
            nextChildSpec={nextChildSpec}
            handoffIndex={handoffIndex}
            onPlace={succeedPlace}
            onIllegal={impatient}
            onHandoff={passHandoff}
            hudScore={`🧱 ${score} / ${config.rounds}`}
            hudPrompt={prLine(promptKey, lang, promptParams)}
            hudQuit={t('vrQuit', lang)}
            bubbleTap={prLine(gazeSelect ? 'bubbleMyTurnGaze' : 'bubbleMyTurn', lang)}
          />
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
          {celebrating && <div className="celebrate">⭐</div>}
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
              <button aria-label={t('sayAgain', lang)} onClick={() => say(promptKey, promptParams)}>
                🔊
              </button>
            )}
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={score}
            best={Math.max(best, score)}
            stars={stars}
            message={t('greatPlaying', lang)}
            lang={lang}
            onRestart={handlePlayPress}
            onChooseLevel={() => setPhase('start')}
          />
        )}
        {awaitingVr && (
          <VRWaitingRoom
            store={xrStore}
            accent="rgba(234, 88, 12, 0.92)"
            label={prLine('enterVR', lang)}
            lang={lang}
          />
        )}
      </div>
    </WebGLGate>
  )
}
