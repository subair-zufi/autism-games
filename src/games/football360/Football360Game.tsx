import { useEffect, useRef, useState } from 'react'
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
import {
  CONFIG,
  GOAL,
  buildPlayers,
  makeSequence,
  classifyReturn,
  playerHeadingDeg,
  pointsFor,
  starsFor,
  type Player,
  type Rally,
} from './logic'
import { useLevelProgress } from '../progression'
import { Football360Scene } from './Football360Scene'
import { fbLine, fbLines, fbSpeak, type Football360MessageKey } from './strings'
import { xrStore, vrSupported } from './xrStore'
import { EnterVRButton } from '../EnterVRButton'
import { useVrGameOverPanel } from '../gameOverPanel'
import { useGameAnalytics } from '../useGameAnalytics'
import { beginHeadWindow, headMetrics } from '../headTracking'
import { VRPracticeScene } from '../vrPractice/VRPracticeScene'

const META = GAME_LIST.find((g) => g.id === 'football360')!
const MAX_LIVES = 3

/** A name as both languages need it: Malayalam for the ml line, romanized for en. */
function biName(p: Player | undefined): { en: string; ml: string } {
  return { en: p?.nameEn ?? '', ml: p?.name ?? '' }
}

/**
 * Same rally state machine as Roll-Back Buddy: incoming (a teammate passes the
 * ball in — skipped when the child initiates) → hold (the child has the ball;
 * after readyDelayMs the target teammate shows the ready cue) → rolling
 * (correct return travels) or reject (a not-ready teammate sends it back, then
 * hold again). The 360 twist is purely presentational: the child stands on the
 * centre spot and turns the view (or their head, in VR) to read the teammates.
 */
type Stage = 'incoming' | 'hold' | 'reject' | 'rolling'

type Params = Parameters<typeof fbSpeak>[2]

export function Football360Game() {
  const difficulty = useSettings((s) => s.difficulty.football360)
  const lang = useSettings((s) => s.language)
  const vrPracticeDone = useSettings((s) => s.vrPracticeDone)
  const setVrPracticeDone = useSettings((s) => s.setVrPracticeDone)
  const best = useScores((s) => s.best.football360)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]
  const goal = GOAL[difficulty]
  const { recordStep, finishGame, resetSession } = useGameAnalytics('football360', xrStore)
  // Per-level progression: FIRST-ATTEMPT correct returns out of the level's
  // goal — the same numerator the server's `_rollback_trials` counts. The
  // denominator stays `goal` (never the rallies actually reached), so a
  // session that ends early on lives reads as the partial level it was.
  const { submit } = useLevelProgress('football360')

  // Speak a line in the chosen language. `onEnd` (used for the ready cue) fires
  // when the spoken line finishes, so latency can also be measured from there.
  const say = (key: Football360MessageKey, params?: Params, onEnd?: () => void) =>
    speakAll(fbSpeak(key, lang, params), onEnd)

  const [phase, setPhase] = useState<'start' | 'playing' | 'over'>('start')
  const [players, setPlayers] = useState<Player[]>([])
  const [sequence, setSequence] = useState<Rally[]>([])
  const [ri, setRi] = useState(0) // rally index
  const [stage, setStage] = useState<Stage>('incoming')
  const [cueShown, setCueShown] = useState(false)
  const [ballOwner, setBallOwner] = useState(0)
  const [lastPicked, setLastPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0) // child-facing points
  const [returned, setReturned] = useState(0) // correct returns this session
  const [firstTries, setFirstTries] = useState(0) // returns made on the first attempt
  const [streak, setStreak] = useState(0) // consecutive first-attempt returns
  const [attempts, setAttempts] = useState(0) // failed tries this rally
  const [lives, setLives] = useState(MAX_LIVES)
  const [shake, setShake] = useState(0)
  const [stars, setStars] = useState(0)
  const [completed, setCompleted] = useState(false)
  /** the one-time "drag to look around" hint, dismissed on the first look */
  const [hintSeen, setHintSeen] = useState(false)
  /** whether this browser can enter immersive VR (Quest etc.) — shows the button */
  const [canVR, setCanVR] = useState(false)
  /** the ready-cue onset — the latency zero-point (never the ball arrival) */
  const cueAt = useRef<number | null>(null)
  /** when the spoken ready cue finished — a TTS-unconfounded latency runs from
   *  here (item 4), guarded by a token against a later rally's utterance */
  const promptEndAt = useRef<number | null>(null)
  const promptTok = useRef(0)

  const rally: Rally | null = ri < sequence.length ? sequence[ri] : null

  useEffect(() => {
    void vrSupported().then(setCanVR)
  }, [])

  // Results stay inside VR. Ending the session here (as this used to) is
  // what dropped the child into the Quest home environment with no window
  // to come back to — every completed game, not just Quit.
  useVrGameOverPanel({
    over: phase === 'over',
    headline: completed ? `${fbLine('overWin', lang)} 🎉` : `${fbLine('overTry', lang)} 🌟`,
    score,
    best: Math.max(best, score),
    stars,
    lang,
    gameId: 'football360',
    level: difficulty,
    onRestart: start,
  })

  function start() {
    resetSession()
    const ps = buildPlayers(config.partners)
    const seq = makeSequence(config, ps)
    setPlayers(ps)
    setSequence(seq)
    setRi(0)
    setStage(seq[0]?.initiate ? 'hold' : 'incoming')
    setCueShown(false)
    setBallOwner(seq[0]?.initiate ? 0 : seq[0]?.from ?? 0)
    setLastPicked(null)
    setScore(0)
    setReturned(0)
    setFirstTries(0)
    setStreak(0)
    setAttempts(0)
    setLives(MAX_LIVES)
    setShake(0)
    setStars(0)
    setCompleted(false)
    setHintSeen(false)
    cueAt.current = null
    setPhase('playing')
  }

  // Incoming pass: the teammate holds the ball for a beat, then plays it in.
  useEffect(() => {
    if (phase !== 'playing' || rally === null || stage !== 'incoming') return
    say('sayIncoming', { name: biName(players[rally.from]) })
    setBallOwner(rally.from)
    const t1 = setTimeout(() => setBallOwner(0), 500)
    const t2 = setTimeout(() => setStage('hold'), 500 + config.rollTravelMs)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [phase, ri, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Hold: the child has the ball; after a beat, one teammate shows the ready cue.
  useEffect(() => {
    if (phase !== 'playing' || rally === null || stage !== 'hold' || cueShown) return
    if (rally.initiate) say('sayInitiate')
    const t = setTimeout(() => {
      setCueShown(true)
      cueAt.current = performance.now()
      // open the head-telemetry window at cue onset (the scan to the ready
      // teammate is measured from here, same zero-point as the latency)
      beginHeadWindow()
      const tok = ++promptTok.current
      promptEndAt.current = null
      const markEnd = () => {
        if (promptTok.current === tok) promptEndAt.current = performance.now()
      }
      recordStep('cue_ready', {
        rally: ri,
        to: players[rally.to].id,
        cue: config.cue,
        initiate: rally.initiate,
        // how far the child must turn to face the ready teammate — the 360
        // attention-shift size, recorded like Museum 360's targetBearingDeg
        targetBearingDeg: playerHeadingDeg(rally.to, config.partners),
      })
      if (config.cue === 'verbal') say('sayVerbalCue', { name: biName(players[rally.to]) }, markEnd)
      else if (config.cue === 'gesture') say('sayGestureCue', undefined, markEnd)
      else if (ri === 0) say('sayOrientCue', undefined, markEnd)
      // no spoken cue this rally (orient after the first) — the prompt-end
      // latency then simply coincides with the cue onset
      else markEnd()
    }, config.readyDelayMs)
    return () => clearTimeout(t)
  }, [phase, ri, stage, cueShown]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reject: the not-ready teammate sends the ball straight back.
  useEffect(() => {
    if (phase !== 'playing' || rally === null || stage !== 'reject') return
    const back = config.rollTravelMs * 0.9
    const t1 = setTimeout(() => {
      say('sayReject', { name: biName(lastPicked !== null ? players[lastPicked] : undefined) })
      setBallOwner(0)
    }, back)
    const t2 = setTimeout(() => {
      setLastPicked(null)
      setStage('hold')
    }, back * 2)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [phase, ri, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rolling: a correct return travels, the catcher celebrates, next rally.
  useEffect(() => {
    if (phase !== 'playing' || rally === null || stage !== 'rolling') return
    const t = setTimeout(() => {
      if (ri + 1 >= sequence.length) {
        setCompleted(true)
        setStars(starsFor(true, lives))
        say('sayWin')
        reportScore('football360', score)
        void submit(difficulty, firstTries, goal)
        finishGame(score)
        setPhase('over')
        return
      }
      cueAt.current = null
      setCueShown(false)
      setAttempts(0)
      setLastPicked(null)
      setRi(ri + 1)
      setStage(sequence[ri + 1].initiate ? 'hold' : 'incoming')
      if (sequence[ri + 1].initiate) setBallOwner(0)
    }, config.rollTravelMs + 700)
    return () => clearTimeout(t)
  }, [phase, ri, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  function loseLife() {
    const next = lives - 1
    setLives(next)
    if (next <= 0) {
      setCompleted(false)
      setStars(starsFor(false, 0))
      say('sayLose')
      reportScore('football360', score)
      // out of lives: the level was still attempted, so it is reported against
      // the full goal rather than silently dropped
      void submit(difficulty, firstTries, goal)
      finishGame(score)
      setPhase('over')
    }
  }

  /** The child passes the ball to teammate `i` (scene tap / VR ray). */
  function pick(i: number) {
    if (phase !== 'playing' || rally === null) return
    if (stage === 'rolling' || stage === 'reject') return // ball is travelling
    const result = classifyReturn(rally, i, cueShown && stage === 'hold')
    if (result === 'premature') {
      // passed (or reached) before the ready cue — the reciprocity slip
      playGentle()
      setShake((s) => s + 1)
      setStreak(0)
      setAttempts((a) => a + 1)
      say('sayPremature')
      recordStep('premature_roll', {
        rally: ri,
        picked: players[i]?.id,
        during: stage,
        cue: config.cue,
        initiate: rally.initiate,
      })
      loseLife()
      return
    }
    const now = performance.now()
    const latencyMs = cueAt.current === null ? null : Math.round(now - cueAt.current)
    // second latency from the end of the spoken cue, so a long "pass it to me!"
    // never inflates it; coincides with latencyMs when no cue was spoken
    const latencyFromPromptEndMs = promptEndAt.current === null ? null : Math.round(now - promptEndAt.current)
    const head = headMetrics(playerHeadingDeg(rally.to, config.partners))
    if (result === 'correct') {
      const firstAttempt = attempts === 0
      const nextStreak = firstAttempt ? streak + 1 : 0
      const points = pointsFor(firstAttempt, nextStreak)
      const nextScore = score + points
      const nextReturned = returned + 1
      playSuccess()
      say('sayCorrect', { name: biName(players[i]) })
      setBallOwner(i)
      setScore(nextScore)
      setReturned(nextReturned)
      if (firstAttempt) setFirstTries((f) => f + 1)
      setStreak(nextStreak)
      recordStep(
        'roll_return',
        {
          correct: true,
          rally: ri,
          target: players[rally.to].id,
          picked: players[i].id,
          cue: config.cue,
          initiate: rally.initiate,
          firstAttempt,
          latencyMs,
          latencyFromPromptEndMs,
          ...head,
          points,
          score: nextScore,
          returned: nextReturned,
          targetBearingDeg: playerHeadingDeg(rally.to, config.partners),
        },
        { score: nextScore },
      )
      setStage('rolling')
    } else {
      // wrong-partner: they trap it, look puzzled, and pass it straight back
      playGentle()
      setStreak(0)
      setAttempts((a) => a + 1)
      setLastPicked(i)
      setBallOwner(i)
      recordStep('roll_return', {
        correct: false,
        result: 'wrong-partner',
        rally: ri,
        target: players[rally.to].id,
        picked: players[i].id,
        cue: config.cue,
        initiate: rally.initiate,
        latencyMs,
        latencyFromPromptEndMs,
        ...head,
        targetBearingDeg: playerHeadingDeg(rally.to, config.partners),
      })
      setStage('reject')
      loseLife()
    }
  }

  // one-time, unscored warm-up before this child's very first real session
  // (review U2): teaches the headset look-around + tap gesture. Shown only
  // when the browser can actually enter immersive VR — on a flat desktop
  // there's no headset novelty and it's just friction, so it's skipped.
  if (canVR && !vrPracticeDone) return <VRPracticeScene onComplete={() => setVrPracticeDone(true)} />

  if (phase === 'start') {
    return (
      <StartScreen
        game={META}
        onStart={start}
        levelNotes={{
          easy: fbLine('noteEasy', lang),
          medium: fbLine('noteMedium', lang),
          hard: fbLine('noteHard', lang),
        }}
      />
    )
  }

  // Which bilingual line the banner shows for the current stage (and its 🔊).
  let promptKey: Football360MessageKey
  let promptParams: Params
  if (stage === 'incoming') {
    promptKey = 'promptIncoming'
    promptParams = { name: biName(players[rally?.from ?? 0]) }
  } else if (stage === 'reject') {
    promptKey = 'promptReject'
  } else if (stage === 'rolling') {
    promptKey = 'promptRolling'
  } else if (!cueShown) {
    promptKey = rally?.initiate ? 'promptInitiate' : 'promptCaught'
  } else if (config.cue === 'verbal') {
    promptKey = 'promptVerbal'
    promptParams = { name: biName(rally ? players[rally.to] : undefined) }
  } else {
    promptKey = config.cue === 'gesture' ? 'promptGesture' : 'promptOrient'
  }

  return (
    <WebGLGate>
      <div className="game-page">
        <ScoreBar score={score} lives={lives} maxLives={MAX_LIVES} progress={`${returned} / ${goal}`} />
        <div className="game-canvas" onPointerDown={() => setHintSeen(true)}>
          <Football360Scene
            players={players}
            cue={config.cue}
            ballOwner={ballOwner}
            readyIndex={rally && cueShown && stage !== 'rolling' ? rally.to : null}
            rollerIndex={rally && stage === 'incoming' && !rally.initiate ? rally.from : null}
            rejectIndex={stage === 'reject' ? lastPicked : null}
            celebrateIndex={rally && stage === 'rolling' ? rally.to : null}
            childTurn={stage === 'hold'}
            shake={shake}
            onPickPartner={pick}
            lang={lang}
            hudScore={`⭐ ${score} · ⚽ ${returned} / ${goal} · ❤️ ${lives}`}
            hudPrompt={fbLine(promptKey, lang, promptParams)}
            hudQuit={t('vrQuit', lang)}
          />
          {canVR && (
            <EnterVRButton store={xrStore} accent="rgba(22, 163, 74, 0.92)" label={fbLine('enterVR', lang)} />
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
              👈 {fbLine('hintLook', lang)} 👉
            </div>
          )}
        </div>
        <div className="game-bottom">
          <div className="prompt-banner er-prompt">
            <div className="er-prompt-lines">
              {fbLines(promptKey, lang, promptParams).map(({ lang: l, text }) => (
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
            message={
              completed ? `${fbLine('overWin', lang)} 🎉` : `${fbLine('overTry', lang)} 🌟`
            }
            lang={lang}
            onRestart={start}
            onChooseLevel={() => setPhase('start')}
          />
        )}
      </div>
    </WebGLGate>
  )
}
