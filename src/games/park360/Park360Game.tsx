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
import { t } from '../../i18n/strings'
import { playGentle, playSuccess, playTap } from '../../services/sounds'
import {
  CONFIG,
  NO_SHARE_TIMEOUT_MS,
  discoveryBearingDeg,
  makeRound,
  pickFriend,
  pointsFor,
  spawnDelayMs,
  starsFor,
  type Friend,
  type Round,
} from './logic'
import { useLevelProgress } from '../progression'
import { discoveryLabel, parkLine } from './strings'
import { Park360Scene } from './Park360Scene'
import { xrStore, vrSupported } from './xrStore'
import { useVrSessionActive } from '../vrSession'
import { VRWaitingRoom } from '../VRWaitingRoom'
import { useVrGameOverPanel } from '../gameOverPanel'
import { useGameAnalytics } from '../useGameAnalytics'
import { beginHeadWindow, headMetrics } from '../headTracking'
import { VRPracticeScene } from '../vrPractice/VRPracticeScene'

const META = GAME_LIST.find((g) => g.id === 'park360')!

/**
 * Park 360 — the immersive copy of Look What I Found!. The session flow,
 * scoring, nudging and analytics are IDENTICAL to the flat-screen game (see
 * discovery/DiscoveryGame.tsx); only the presentation changed: the child
 * stands inside the park, turns the view (a head turn in VR) to spot the
 * surprise, and the recorded events additionally carry the surprise's signed
 * bearing — how far the child had to turn — like the other 360 games.
 */
export function Park360Game() {
  const difficulty = useSettings((s) => s.difficulty.park360)
  const lang = useSettings((s) => s.language)
  const inputMethod = useSettings((s) => s.inputMethod)
  const vrPracticeDone = useSettings((s) => s.vrPracticeDone)
  const setVrPracticeDone = useSettings((s) => s.setVrPracticeDone)
  const best = useScores((s) => s.best.park360)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('park360', xrStore)
  // Per-level progression: a finished session reports SPONTANEOUS (un-nudged)
  // shares out of the level's goal — the same numerator `starsFor` and the
  // server's `_discovery_trials` treat as success, not shares completed.
  const { submit } = useLevelProgress('park360')
  const cfg = CONFIG[difficulty]

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  /** waiting = calm empty park; active = surprise up, child may act; celebrating = shared-affect payoff */
  const [roundPhase, setRoundPhase] = useState<'waiting' | 'active' | 'celebrating'>('waiting')
  const [round, setRound] = useState<Round>(() => makeRound(null))
  const [friend, setFriend] = useState<Friend>(() => pickFriend())
  const [score, setScore] = useState(0) // child-facing points
  const [shared, setShared] = useState(0) // completed share loops this session
  const [spontCount, setSpontCount] = useState(0) // shares completed with zero nudges
  const [streak, setStreak] = useState(0) // consecutive spontaneous shares
  const [found, setFound] = useState(false) // discovery tapped this round
  const [called, setCalled] = useState(false) // friend tapped this round
  const [nudge, setNudge] = useState<'find' | 'share' | null>(null)
  const [stars, setStars] = useState(0)
  /** the one-time "drag to look around" hint, dismissed on the first look */
  const [hintSeen, setHintSeen] = useState(false)
  /** whether this browser can enter immersive VR (Quest etc.) — shows the button */
  const [canVR, setCanVR] = useState(false)
  /** whether the headset is actually presenting right now, vs. the flat pre-VR screen */
  const vrActive = useVrSessionActive(xrStore)
  /** The child selects by gaze right now — inside a headset with the default
   *  dwell method — so the share nudge says "look at your friend", not "tap".
   *  Flat screen (mouse) and the VR controller ray both keep "tap". */
  const gazeSelect = vrActive && inputMethod === 'dwell'
  /** Play was pressed on a VR-capable browser, but the session hasn't started
   *  yet — held here instead of calling `start()` so the round never begins
   *  on the flat screen before the child is actually in the headset. */
  const [awaitingVr, setAwaitingVr] = useState(false)

  /** timestamp of the surprise pop-in — the zero-point every latency runs from */
  const eventReadyAt = useRef<number | null>(null)
  /** onset -> friend-tap latency (the initiation measure), set at the friend tap */
  const shareLatency = useRef<number | null>(null)
  const nudgeCount = useRef(0)
  // refs mirror found/called so the nudge timer never reads stale state
  const foundRef = useRef(false)
  const calledRef = useRef(false)
  const spawnTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Hard only: logs once if the round goes unacted-on this long (review §3.6) */
  const noShareTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const noShareLogged = useRef(false)

  useEffect(() => () => clearTimers(), [])

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
    gameId: 'park360',
    level: difficulty,
    onRestart: handlePlayPress,
  })

  function clearTimers() {
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    if (noShareTimer.current) clearTimeout(noShareTimer.current)
    spawnTimer.current = null
    nudgeTimer.current = null
    noShareTimer.current = null
  }

  // Malayalam-aware speech + level captions (surface the fading scaffold).
  const say = (key: Parameters<typeof parkLine>[0], params?: Record<string, string>) =>
    speak(parkLine(key, lang, params), lang)
  const levelNotes = {
    easy: parkLine('noteEasy', lang),
    medium: parkLine('noteMedium', lang),
    hard: parkLine('noteHard', lang),
  }

  function start() {
    resetSession()
    clearTimers()
    setScore(0)
    setShared(0)
    setSpontCount(0)
    setStreak(0)
    setStars(0)
    setFriend(pickFriend())
    setPhase('playing')
    beginRound(null)
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

  function beginRound(prev: Round['discovery'] | null) {
    setRoundPhase('waiting')
    setFound(false)
    setCalled(false)
    setNudge(null)
    foundRef.current = false
    calledRef.current = false
    nudgeCount.current = 0
    noShareLogged.current = false
    eventReadyAt.current = null
    shareLatency.current = null
    const next = makeRound(prev)
    // the park stays calm for a beat so the pop-in is a genuine event
    spawnTimer.current = setTimeout(() => {
      setRound(next)
      setRoundPhase('active')
      eventReadyAt.current = performance.now()
      // open the head-telemetry window at the surprise pop-in — the child's
      // scan to spot it (and the turn to the friend) is measured from here
      beginHeadWindow()
      recordStep('event_ready', {
        discovery: next.discovery,
        saliency: cfg.saliency,
        nudgeAfterMs: cfg.nudgeAfterMs,
        // how far the child must turn to face the surprise — the 360 games'
        // attention-shift measure (signed degrees left/right)
        targetBearingDeg: discoveryBearingDeg(next.discovery),
      })
      armNudge()
      armNoShareTimeout(next.discovery)
    }, spawnDelayMs())
  }

  /** (re)arm the helper nudge — never on hard, and it repeats until the child acts */
  function armNudge() {
    if (cfg.nudgeAfterMs === null) return
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    nudgeTimer.current = setTimeout(fireNudge, cfg.nudgeAfterMs)
  }

  /**
   * Hard only (no nudges ever): if the round goes unacted-on this long, log a
   * one-off `no_share` timeout event so a non-initiating child still produces
   * data — the round itself keeps waiting, it can still be completed after.
   * Takes the discovery explicitly (not the `round` state) since this fires
   * from inside the same spawn callback that just set it, before the next render.
   */
  function armNoShareTimeout(discovery: Round['discovery']) {
    if (cfg.nudgeAfterMs !== null) return
    noShareTimer.current = setTimeout(() => {
      // clearTimers() (called from completeShare) already cancels this timer
      // once the round finishes, so reaching here always means an incomplete
      // share; noShareLogged just guards against a second timer somehow firing
      if (noShareLogged.current) return
      noShareLogged.current = true
      const head = headMetrics(discoveryBearingDeg(discovery))
      recordStep('no_share', {
        discovery,
        targetBearingDeg: discoveryBearingDeg(discovery),
        timedOutAfterMs: NO_SHARE_TIMEOUT_MS,
        foundOnly: foundRef.current,
        calledOnly: calledRef.current,
        ...head,
      })
    }, NO_SHARE_TIMEOUT_MS)
  }

  function fireNudge() {
    const kind = foundRef.current ? 'share' : 'find'
    nudgeCount.current += 1
    setNudge(kind)
    playGentle()
    say(kind === 'find' ? 'nudgeFind' : gazeSelect ? 'nudgeShareGaze' : 'nudgeShare')
    recordStep('nudge', { kind, count: nudgeCount.current })
    armNudge()
  }

  /** the "point": the child marks what they found */
  function tapDiscovery() {
    if (roundPhase !== 'active' || foundRef.current) return
    foundRef.current = true
    setFound(true)
    playTap()
    const latencyMs = eventReadyAt.current === null ? null : Math.round(performance.now() - eventReadyAt.current)
    recordStep('find', {
      discovery: round.discovery,
      latencyMs,
      order: calledRef.current ? 'call-first' : 'find-first',
    })
    if (calledRef.current) {
      completeShare('call-first')
    } else {
      setNudge(null)
      armNudge()
    }
  }

  /** the "hey, look!": the child brings the friend in — the IJA-critical act */
  function tapFriend() {
    if (roundPhase !== 'active' || calledRef.current) return
    calledRef.current = true
    setCalled(true)
    shareLatency.current = eventReadyAt.current === null ? null : Math.round(performance.now() - eventReadyAt.current)
    if (foundRef.current) {
      completeShare('find-first')
    } else {
      // called over before showing what — the friend turns, curious, and waits
      playTap()
      say('sayCurious')
      recordStep('call', { latencyMs: shareLatency.current })
      setNudge(null)
      armNudge()
    }
  }

  function completeShare(order: 'find-first' | 'call-first') {
    clearTimers()
    const spontaneous = nudgeCount.current === 0
    const nextStreak = spontaneous ? streak + 1 : 0
    const points = pointsFor(spontaneous, nextStreak)
    const nextScore = score + points
    const nextShared = shared + 1
    const nextSpont = spontCount + (spontaneous ? 1 : 0)
    setRoundPhase('celebrating')
    setNudge(null)
    playSuccess()
    setScore(nextScore)
    setShared(nextShared)
    setSpontCount(nextSpont)
    setStreak(nextStreak)
    say('sayWow', { label: discoveryLabel(round.discovery, lang) })
    // the head's scan across this whole round: headToTargetMs = time to first
    // look at the surprise, and the range/travel span the turn to the friend
    const head = headMetrics(discoveryBearingDeg(round.discovery))
    recordStep(
      'share',
      {
        correct: spontaneous, // scored server-side: success = un-nudged initiation
        spontaneous,
        nudges: nudgeCount.current,
        latencyMs: shareLatency.current, // onset -> friend tap, the initiation latency
        order,
        discovery: round.discovery,
        targetBearingDeg: discoveryBearingDeg(round.discovery),
        ...head,
        points,
        score: nextScore,
        found: nextShared,
      },
      { score: nextScore },
    )
    if (nextShared >= cfg.goal) {
      setStars(starsFor(nextSpont, cfg.goal))
      say('sayWin')
      reportScore('park360', nextScore)
      void submit(difficulty, nextSpont, cfg.goal)
      finishGame(nextScore)
      setTimeout(() => setPhase('over'), 1600)
      return
    }
    setTimeout(() => beginRound(round.discovery), 2000)
  }

  // one-time, unscored warm-up before this child's very first real session
  // (review U2): teaches the headset look-around + tap gesture. Shown only
  // when the browser can actually enter immersive VR — on a flat desktop
  // there's no headset novelty and it's just friction, so it's skipped.
  if (canVR && !vrPracticeDone) return <VRPracticeScene onComplete={() => setVrPracticeDone(true)} />

  if (phase === 'start' && !awaitingVr) {
    return <StartScreen game={META} onStart={handlePlayPress} levelNotes={levelNotes} />
  }

  const friendState = roundPhase === 'celebrating' ? 'celebrating' : called && !found ? 'curious' : 'away'

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} progress={`${shared} / ${cfg.goal}`} />
        <div className="game-canvas" onPointerDown={() => setHintSeen(true)}>
          <Park360Scene
            discovery={round.discovery}
            active={roundPhase !== 'waiting'}
            saliency={cfg.saliency}
            found={found}
            friend={friend}
            friendLabel={lang === 'ml' ? friend.name : friend.nameEn}
            friendState={friendState}
            awayYaw={cfg.awayYaw}
            nudge={nudge}
            onTapDiscovery={tapDiscovery}
            onTapFriend={tapFriend}
            hudScore={`⭐ ${score} · ✨ ${shared} / ${cfg.goal}`}
            hudPrompt={parkLine('prompt', lang)}
            hudQuit={t('vrQuit', lang)}
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
              👈 {parkLine('dragHint', lang)} 👉
            </div>
          )}
          {roundPhase === 'celebrating' && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={parkLine('prompt', lang)} lang={lang} />
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
            accent="rgba(22, 163, 74, 0.92)"
            label={lang === 'ml' ? 'VR-ൽ കളിക്കൂ' : 'Enter VR'}
            lang={lang}
          />
        )}
      </div>
    </WebGLGate>
  )
}
