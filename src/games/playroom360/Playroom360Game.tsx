import { useEffect, useMemo, useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { praise, speakAll } from '../../services/speech'
import { t } from '../../i18n/strings'
import { playGentle, playSuccess } from '../../services/sounds'
import {
  CONFIG,
  JITTER_LADDER,
  buildPlayers,
  inTurnRatio,
  jitterFloor,
  makeSequence,
  peerBearingDeg,
  peerWaitMs,
  sessionAccuracy,
  starsForAccuracy,
  type Player,
  type TurnSpec,
} from './logic'
import { initMastery, stepMastery, type MasteryConfig } from '../mastery'
import { useLevelProgress } from '../progression'
import { prLine, prLines, prSpeak, type Playroom360MessageKey } from './strings'
import { Playroom360Scene } from './Playroom360Scene'
import { xrStore, vrSupported } from './xrStore'
import { useVrSessionActive } from '../vrSession'
import { VRWaitingRoom } from '../VRWaitingRoom'
import { useVrGameOverPanel } from '../gameOverPanel'
import { useGameAnalytics } from '../useGameAnalytics'
import { beginHeadWindow, headMetrics, headWatchProportion } from '../headTracking'
import { VRPracticeScene } from '../vrPractice/VRPracticeScene'
import { BilingualPromptBanner } from '../../components/BilingualPromptBanner'

const META = GAME_LIST.find((g) => g.id === 'playroom360')!

/** how close (deg) the child's facing must be to the active peer to count as
 *  "watching" them — looser than the answer-landing tolerance, since watching a
 *  peer is a gaze in their direction, not a precise fixation (review R9) */
const PEER_WATCH_TOL_DEG = 20

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
  // How long the most recent peer turn actually made the child wait (base ±
  // jitter) — logged on the child's events so impatience can be modelled
  // against the real wait rather than the nominal level constant (review R3).
  const lastPeerWaitMs = useRef<number | null>(null)
  // R9 composite sub-scores, accumulated across the session:
  //  - peer-watch: mean fraction of each peer turn spent looking at the peer
  //  - own-turn latency: how long the child took to place on their own turn
  //    (reported only, never scored — a calm slow placement is not a failure)
  const peerWatchSum = useRef(0)
  const peerTurnCount = useRef(0)
  const ownTurnLatencySum = useRef(0)
  const ownTurnCount = useRef(0)
  const ownTurnStart = useRef<number | null>(null)
  // within-session adaptive waiting difficulty (review R14): the rung steps the
  // peer-wait jitter band up after clean turns and down after impatient ones,
  // never below the mentor-set floor. Peer count stays the level's value.
  const mastery: MasteryConfig = { rungCount: JITTER_LADDER.length, floor: jitterFloor(difficulty) }
  const [rung, setRung] = useState(() => initMastery(mastery))
  const activeJitter = JITTER_LADDER[rung.rung]
  // whether the child tapped out of turn since their last placement — the error
  // signal the engine steps on (a clean turn is a "first-try" waiting success)
  const erredSincePlacement = useRef(false)
  // the peer currently giving a contingent "almost your turn!" reply to an
  // out-of-turn tap, so the exchange is social rather than silent (review R13)
  const [replyIndex, setReplyIndex] = useState<number | null>(null)
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  // clear any lingering "almost your turn!" peer reply when the turn advances,
  // and the reply timer on unmount
  useEffect(() => {
    setReplyIndex(null)
  }, [index])
  useEffect(() => () => void (replyTimer.current && clearTimeout(replyTimer.current)), [])

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
    lastPeerWaitMs.current = null
    peerWatchSum.current = 0
    peerTurnCount.current = 0
    ownTurnLatencySum.current = 0
    ownTurnCount.current = 0
    ownTurnStart.current = null
    if (replyTimer.current) clearTimeout(replyTimer.current)
    setReplyIndex(null)
    setRung(initMastery(mastery))
    erredSincePlacement.current = false
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
      const placements = sequence.filter((t) => t.kind === 'child').length
      const peerWatch = peerTurnCount.current > 0 ? peerWatchSum.current / peerTurnCount.current : 0
      const meanOwnLatencyMs =
        ownTurnCount.current > 0 ? Math.round(ownTurnLatencySum.current / ownTurnCount.current) : null
      // the composite both the stars and the recorded accuracy derive from, so
      // a passive child (waits, never watches) no longer reads as a perfect
      // turn-taker (review R9); latency is reported, not scored
      const acc = sessionAccuracy({ placements, impatientTaps, peerWatch })
      const round2 = (n: number) => Math.round(n * 100) / 100
      reportScore('playroom360', placements)
      recordStep('session_scores', {
        inTurnRatio: round2(inTurnRatio(placements, impatientTaps)),
        peerWatchProportion: round2(peerWatch),
        meanOwnTurnLatencyMs: meanOwnLatencyMs,
        composite: round2(acc),
        placements,
        impatientTaps,
        peerTurns: peerTurnCount.current,
      })
      // submit the composite as the accuracy (num/100), so the server-recorded
      // accuracy and the child-facing stars can never disagree
      void submit(difficulty, Math.round(acc * 100), 100)
      setStars(starsForAccuracy(acc))
      finishGame(placements)
      say('sayWin')
      playSuccess()
      setPhase('over')
      return
    }
    if (turn.kind === 'peer') {
      // Hold the peer's turn until the child has passed it to them.
      if (handoffTo) return
      const peer = players[turn.playerIndex]
      const peerBearing = peerBearingDeg(turn.playerIndex, config.players)
      const childIsNext = sequence[index + 1]?.kind === 'child'
      say(childIsNext ? 'sayPeerNext' : 'sayPeerWait', { name: peer.name })
      // open a head-telemetry window at the START of the peer's turn, so we can
      // measure whether the child watched the active peer rather than tuning out
      // (review R9) — not just at hand-off as before
      beginHeadWindow()
      // a fresh jittered wait for this turn, at the adaptive rung's jitter band
      // (R14): the flat base at the floor, more variable as the child proves they
      // can tolerate uncertainty
      const wait = peerWaitMs(config.peerTurnMs, activeJitter)
      lastPeerWaitMs.current = wait
      const t1 = setTimeout(() => setReaching(true), wait * 0.55)
      const t2 = setTimeout(() => {
        // how much of this peer turn the child spent looking at the active peer
        const watch = headWatchProportion(peerBearing, PEER_WATCH_TOL_DEG)
        peerWatchSum.current += watch
        peerTurnCount.current += 1
        recordStep('peer_turn', {
          round,
          activePlayer: peer.id,
          peerBearingDeg: peerBearing,
          watchProportion: Math.round(watch * 100) / 100,
          peerWaitMs: wait,
          rung: rung.rung,
          ...headMetrics(peerBearing),
        })
        setReaching(false)
        setIndex((i) => i + 1)
      }, wait)
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
    // turn and the hand-off) and wait for the tap; stamp the own-turn start so
    // the placement latency can be reported (R9, descriptive only)
    beginHeadWindow()
    if (!handoffTo) ownTurnStart.current = performance.now()
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
    const ownTurnLatencyMs =
      ownTurnStart.current === null ? null : Math.round(performance.now() - ownTurnStart.current)
    if (ownTurnLatencyMs !== null) {
      ownTurnLatencySum.current += ownTurnLatencyMs
      ownTurnCount.current += 1
    }
    recordStep(
      'place_block',
      {
        round,
        slot: index % config.players,
        method: 'tap',
        peerWaitMs: lastPeerWaitMs.current,
        ownTurnLatencyMs,
        rung: rung.rung,
        ...headMetrics(),
      },
      { score: score + 1 },
    )
    // fold this turn into the shared adaptive engine (R14): a turn reached with
    // no out-of-turn tap is a clean waiting success (step toward more jitter);
    // a turn with an impatient tap is an error (step back toward a steadier wait)
    setRung((r) => stepMastery(r, mastery, { firstTryCorrect: !erredSincePlacement.current }))
    erredSincePlacement.current = false
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
    // mark this turn cycle as erred, so the adaptive engine eases the wait jitter
    // after two such turns (review R14)
    erredSincePlacement.current = true
    if (handoffTo) {
      // tapped the block mid hand-off: remind them to pass first
      say('sayPassFirst', { name: handoffTo.name })
      recordStep('impatient_tap', { round, during: 'handoff', source: 'tap', peerWaitMs: lastPeerWaitMs.current })
      return
    }
    // the active peer replies instead of staying silent — a gentle, visible,
    // non-punishing response that makes the out-of-turn tap a social exchange
    // (review R13)
    if (turn && turn.kind === 'peer') {
      setReplyIndex(turn.playerIndex)
      if (replyTimer.current) clearTimeout(replyTimer.current)
      replyTimer.current = setTimeout(() => setReplyIndex(null), 1600)
    }
    say('sayWaitTurn')
    recordStep('impatient_tap', {
      round,
      activePlayer: turn ? players[turn.playerIndex]?.id : undefined,
      source: 'tap',
      peerWaitMs: lastPeerWaitMs.current,
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
            replyIndex={replyIndex}
            replyText={prLine('bubbleAlmost', lang)}
            celebrate={celebrating}
            hudScore={`🧱 ${score} / ${config.rounds}`}
            hudPrompt={prLine(promptKey, lang, promptParams)}
            hudDone={score}
            hudGoal={config.rounds}
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
        </div>
        <div className="game-bottom">
          <BilingualPromptBanner
            lines={prLines(promptKey, lang, promptParams)}
            lang={lang}
            onSpeak={() => say(promptKey, promptParams)}
          />
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
