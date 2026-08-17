import { useEffect, useRef, useState } from 'react'
import { GAME_LIST } from '../../types'
import { useSettings } from '../../state/settings'
import { useScores } from '../../state/scores'
import { StartScreen } from '../../components/StartScreen'
import { ScoreBar } from '../../components/ScoreBar'
import { GameOverDialog } from '../../components/GameOverDialog'
import { WebGLGate } from '../../components/WebGLGate'
import { praise, speakAll, speechAvailable } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import {
  CONFIG,
  GOAL,
  buildPlayers,
  makeSequence,
  classifyReturn,
  pointsFor,
  starsFor,
  type Player,
  type Rally,
} from './logic'
import { RollBackScene } from './RollBackScene'
import { t } from '../../i18n/strings'
import { rbLine, rbLines, rbSpeak, type RollBackMessageKey } from './strings'
import { useGameAnalytics } from '../useGameAnalytics'

const META = GAME_LIST.find((g) => g.id === 'rollback')!
const MAX_LIVES = 3

/** A name as both languages need it: Malayalam for the ml line, romanized for en. */
function biName(p: Player | undefined): { en: string; ml: string } {
  return { en: p?.nameEn ?? '', ml: p?.name ?? '' }
}

/**
 * One rally moves through: incoming (a peer rolls the ball in — skipped when
 * the child initiates) → hold (the child has the ball; after readyDelayMs the
 * target partner shows the ready cue) → rolling (correct return travels) or
 * reject (a not-ready partner sends it back, then hold again).
 */
type Stage = 'incoming' | 'hold' | 'reject' | 'rolling'

type Params = Parameters<typeof rbSpeak>[2]

export function RollBackGame() {
  const difficulty = useSettings((s) => s.difficulty.rollback)
  const lang = useSettings((s) => s.language)
  const best = useScores((s) => s.best.rollback)
  const reportScore = useScores((s) => s.reportScore)
  const config = CONFIG[difficulty]
  const goal = GOAL[difficulty]
  const { recordStep, finishGame, resetSession } = useGameAnalytics('rollback')

  // Speak a line in the chosen language.
  const say = (key: RollBackMessageKey, params?: Params) => speakAll(rbSpeak(key, lang, params))

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
  const [streak, setStreak] = useState(0) // consecutive first-attempt returns
  const [attempts, setAttempts] = useState(0) // failed tries this rally
  const [lives, setLives] = useState(MAX_LIVES)
  const [shake, setShake] = useState(0)
  const [stars, setStars] = useState(0)
  const [completed, setCompleted] = useState(false)
  /** the ready-cue onset — the latency zero-point (never the ball arrival) */
  const cueAt = useRef<number | null>(null)

  const rally: Rally | null = ri < sequence.length ? sequence[ri] : null

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
    setStreak(0)
    setAttempts(0)
    setLives(MAX_LIVES)
    setShake(0)
    setStars(0)
    setCompleted(false)
    cueAt.current = null
    setPhase('playing')
  }

  // Incoming roll: the peer holds the ball for a beat, then rolls it in.
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

  // Hold: the child has the ball; after a beat, one partner shows the ready cue.
  useEffect(() => {
    if (phase !== 'playing' || rally === null || stage !== 'hold' || cueShown) return
    if (rally.initiate) say('sayInitiate')
    const t = setTimeout(() => {
      setCueShown(true)
      cueAt.current = performance.now()
      recordStep('cue_ready', {
        rally: ri,
        to: players[rally.to].id,
        cue: config.cue,
        initiate: rally.initiate,
      })
      if (config.cue === 'verbal') say('sayVerbalCue', { name: biName(players[rally.to]) })
      else if (config.cue === 'gesture') say('sayGestureCue')
      else if (ri === 0) say('sayOrientCue')
    }, config.readyDelayMs)
    return () => clearTimeout(t)
  }, [phase, ri, stage, cueShown]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reject: the not-ready partner sends the ball straight back.
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
        reportScore('rollback', score)
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
      reportScore('rollback', score)
      finishGame(score)
      setPhase('over')
    }
  }

  /** The child rolls the ball to partner `i` (scene tap or chip tap). */
  function pick(i: number) {
    if (phase !== 'playing' || rally === null) return
    if (stage === 'rolling' || stage === 'reject') return // ball is travelling
    const result = classifyReturn(rally, i, cueShown && stage === 'hold')
    if (result === 'premature') {
      // rolled (or reached) before the ready cue — the reciprocity slip
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
    const latencyMs = cueAt.current === null ? null : Math.round(performance.now() - cueAt.current)
    if (result === 'correct') {
      const firstAttempt = attempts === 0
      const nextStreak = firstAttempt ? streak + 1 : 0
      const points = pointsFor(firstAttempt, nextStreak)
      const nextScore = score + points
      const nextReturned = returned + 1
      playSuccess()
      say('sayCorrect', { name: biName(players[i]) })
      praise()
      setBallOwner(i)
      setScore(nextScore)
      setReturned(nextReturned)
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
          points,
          score: nextScore,
          returned: nextReturned,
        },
        { score: nextScore },
      )
      setStage('rolling')
    } else {
      // wrong-partner: they catch it, look puzzled, and roll it straight back
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
      })
      setStage('reject')
      loseLife()
    }
  }

  if (phase === 'start') return <StartScreen game={META} onStart={start} />

  // Which bilingual line the banner shows for the current stage (and its 🔊).
  let promptKey: RollBackMessageKey
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
        <div className="game-canvas">
          <RollBackScene
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
          />
        </div>
        <div className="game-bottom">
          <div className="prompt-banner er-prompt">
            <div className="er-prompt-lines">
              {rbLines(promptKey, lang, promptParams).map(({ lang: l, text }) => (
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
          <div className="player-btn-row">
            {players.map((p, i) => {
              if (p.kind === 'child') {
                const labelKey: RollBackMessageKey =
                  stage === 'incoming'
                    ? 'chipCatch'
                    : stage === 'hold'
                      ? cueShown
                        ? 'chipRoll'
                        : 'chipWatch'
                      : 'chipNice'
                const cls =
                  stage === 'hold' && cueShown ? 'player-btn child ready' : 'player-btn child wait'
                return (
                  <div key={p.id} className={cls}>
                    <span className="player-emoji">{p.emoji}</span>
                    {rbLines(labelKey, lang).map(({ lang: l, text }) => (
                      <span key={l} className={`choice-label choice-label-${l}`}>
                        {text}
                      </span>
                    ))}
                  </div>
                )
              }
              const active = i === ballOwner
              return (
                <button
                  key={p.id}
                  className={active ? 'player-btn peer active' : 'player-btn peer'}
                  onClick={() => pick(i)}
                >
                  <span className="player-emoji">{p.emoji}</span>
                  <span className="choice-label">{lang === 'ml' ? p.name : p.nameEn}</span>
                </button>
              )
            })}
          </div>
        </div>
        {phase === 'over' && (
          <GameOverDialog
            score={score}
            best={Math.max(best, score)}
            stars={stars}
            message={
              completed ? `${rbLine('overWin', lang)} 🎉` : `${rbLine('overTry', lang)} 🌟`
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
