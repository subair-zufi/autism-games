import { useEffect, useRef, useState } from 'react'
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
import { playGentle, playSuccess, playTap } from '../../services/sounds'
import {
  CONFIG,
  makeRound,
  pickFriend,
  pointsFor,
  spawnDelayMs,
  starsFor,
  type Friend,
  type Round,
} from './logic'
import { discoveryLabel, discoveryLine } from './strings'
import { DiscoveryScene } from './DiscoveryScene'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'discovery')!

export function DiscoveryGame() {
  const difficulty = useSettings((s) => s.difficulty.discovery)
  const lang = useSettings((s) => s.language)
  const best = useScores((s) => s.best.discovery)
  const reportScore = useScores((s) => s.reportScore)
  const { recordStep, finishGame, resetSession } = useGameAnalytics('discovery')
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

  useEffect(() => () => clearTimers(), [])

  function clearTimers() {
    if (spawnTimer.current) clearTimeout(spawnTimer.current)
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    spawnTimer.current = null
    nudgeTimer.current = null
  }

  // Malayalam-aware speech + level captions (surface the fading scaffold).
  const say = (key: Parameters<typeof discoveryLine>[0], params?: Record<string, string>) =>
    speak(discoveryLine(key, lang, params), lang)
  const levelNotes = {
    easy: discoveryLine('noteEasy', lang),
    medium: discoveryLine('noteMedium', lang),
    hard: discoveryLine('noteHard', lang),
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

  function beginRound(prev: Round['discovery'] | null) {
    setRoundPhase('waiting')
    setFound(false)
    setCalled(false)
    setNudge(null)
    foundRef.current = false
    calledRef.current = false
    nudgeCount.current = 0
    eventReadyAt.current = null
    shareLatency.current = null
    const next = makeRound(prev)
    // the park stays calm for a beat so the pop-in is a genuine event
    spawnTimer.current = setTimeout(() => {
      setRound(next)
      setRoundPhase('active')
      eventReadyAt.current = performance.now()
      recordStep('event_ready', {
        discovery: next.discovery,
        saliency: cfg.saliency,
        nudgeAfterMs: cfg.nudgeAfterMs,
      })
      armNudge()
    }, spawnDelayMs())
  }

  /** (re)arm the helper nudge — never on hard, and it repeats until the child acts */
  function armNudge() {
    if (cfg.nudgeAfterMs === null) return
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current)
    nudgeTimer.current = setTimeout(fireNudge, cfg.nudgeAfterMs)
  }

  function fireNudge() {
    const kind = foundRef.current ? 'share' : 'find'
    nudgeCount.current += 1
    setNudge(kind)
    playGentle()
    say(kind === 'find' ? 'nudgeFind' : 'nudgeShare')
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
    praise()
    recordStep(
      'share',
      {
        correct: spontaneous, // scored server-side: success = un-nudged initiation
        spontaneous,
        nudges: nudgeCount.current,
        latencyMs: shareLatency.current, // onset -> friend tap, the initiation latency
        order,
        discovery: round.discovery,
        points,
        score: nextScore,
        found: nextShared,
      },
      { score: nextScore },
    )
    if (nextShared >= cfg.goal) {
      setStars(starsFor(nextSpont, cfg.goal))
      say('sayWin')
      reportScore('discovery', nextScore)
      finishGame(nextScore)
      setTimeout(() => setPhase('over'), 1600)
      return
    }
    setTimeout(() => beginRound(round.discovery), 2000)
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} levelNotes={levelNotes} />

  const friendState = roundPhase === 'celebrating' ? 'celebrating' : called && !found ? 'curious' : 'away'

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} progress={`${shared} / ${cfg.goal}`} />
        <div className="game-canvas">
          <DiscoveryScene
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
          />
          {roundPhase === 'celebrating' && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner text={discoveryLine('prompt', lang)} lang={lang} />
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={score}
            best={Math.max(best, score)}
            stars={stars}
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
