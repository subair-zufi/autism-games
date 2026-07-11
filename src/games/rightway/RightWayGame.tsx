/**
 * Right or Wrong — social-norms judgment game with three unlockable levels.
 *
 * This component only orchestrates: it owns the play flow (level select →
 * playing → result) and delegates the item bank to `content.ts`, level
 * construction to `logic.ts`, and progress persistence to `../progression`.
 *
 * Research-mode behaviour (matches Good Choice and the emotion battery):
 *  - Two modes. Practice: training behaviours, spoken explanation feedback,
 *    results count towards level unlocks. Assessment: held-out probe
 *    behaviours, corrective feedback withheld (neutral acknowledgement only),
 *    recorded in analytics but never submitted to the unlock ladder.
 *  - No lives / failure state: every child completes all trials, so struggling
 *    participants still produce a full item set.
 *  - Difficulty = stimulus subtlety (clear vs subtle tier), not round count;
 *    the response set is the same two neutral buttons everywhere, so chance
 *    stays 1/2 and neither button looks like "the correct one".
 *  - Every answer records decision latency from the moment the trial was
 *    presented, plus the item's tier and valence — the miss on subtle
 *    not-okay items (passive omissions) is the clinically interesting error.
 *  - Bilingual (English + Malayalam) prompts, buttons and feedback, spoken
 *    Malayalam-first like Good Choice.
 */
import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../../types'
import { useScores } from '../../state/scores'
import { useSettings } from '../../state/settings'
import { ProgressBar } from '../../components/ProgressBar'
import { WebGLGate } from '../../components/WebGLGate'
import { LevelResult, LevelSelect } from '../../components/LevelScreens'
import { speak, speechAvailable } from '../../services/speech'
import { playGentle, playSuccess, playTap } from '../../services/sounds'
import { t, type Lang } from '../../i18n/strings'
import { useGameAnalytics } from '../useGameAnalytics'
import { LEVELS, useLevelProgress } from '../progression'
import {
  buildLevel,
  CHANCE,
  scoreLevel,
  tallyByConstruct,
  tallyByValence,
  type Behavior,
  type Construct,
  type LevelSummary,
} from './logic'
import { RightWayScene } from './RightWayScene'

export const GAME_KEY = 'rightway'

const IS_IT_OKAY: Record<Lang, string> = {
  en: 'Is that okay?',
  ml: 'അത് ശരിയാണോ?',
}

/** The two judgment buttons — deliberately symmetric (thumbs, not ✅/🔧) so
 *  neither option carries a "this is the right answer" affordance. */
const JUDGMENTS: Array<{ saidFine: boolean; emoji: string; label: Record<Lang, string> }> = [
  { saidFine: true, emoji: '👍', label: { en: "It's okay", ml: 'അത് ശരിയാ' } },
  { saidFine: false, emoji: '👎', label: { en: 'Not okay', ml: 'അത് ശരിയല്ല' } },
]

/** Neutral acknowledgement shown in Assessment mode instead of feedback. */
const RECORDED: Record<Lang, string> = {
  en: 'Answer saved.',
  ml: 'ഉത്തരം സേവ് ആയി.',
}

const LEVEL_LABEL_KEY: Record<Difficulty, 'levelEasy' | 'levelMedium' | 'levelHard'> = {
  easy: 'levelEasy',
  medium: 'levelMedium',
  hard: 'levelHard',
}

interface Answer {
  construct: Construct
  isFine: boolean
  correct: boolean
}

export function RightWayGame() {
  const lang = useSettings((s) => s.language)
  const reportScore = useScores((s) => s.reportScore)
  const { stateFor, highestUnlocked, submit } = useLevelProgress(GAME_KEY)
  const { recordStep, finishGame, resetSession } = useGameAnalytics(GAME_KEY)

  const [phase, setPhase] = useState<'select' | 'playing' | 'result'>('select')
  const [selectedLevel, setSelectedLevel] = useState<Difficulty>('easy')
  const [assessment, setAssessment] = useState(false)
  const [level, setLevel] = useState<Difficulty>('easy')
  const [trials, setTrials] = useState<Behavior[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<boolean | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [summary, setSummary] = useState<LevelSummary | null>(null)
  const [celebrate, setCelebrate] = useState(0)
  // When the current trial was presented — decision latency runs from here to
  // the answer tap.
  const readyAtRef = useRef<number | null>(null)

  // While choosing, keep the selection on the highest unlocked level so a
  // returning learner resumes where they left off.
  const highest = highestUnlocked()
  useEffect(() => {
    if (phase === 'select') setSelectedLevel(highest)
  }, [highest, phase])

  const trial = trials[idx] as Behavior | undefined

  // Speak the behaviour (in the chosen language) and start the latency clock
  // whenever a new trial is presented.
  useEffect(() => {
    if (phase !== 'playing' || !trial) return
    speak(promptFor(trial, lang), lang)
    readyAtRef.current = performance.now()
  }, [phase, trial, lang])

  function start(lvl: Difficulty) {
    resetSession()
    setLevel(lvl)
    setTrials(buildLevel(lvl, Math.random, assessment ? 'probe' : 'training'))
    setIdx(0)
    setPicked(null)
    setAnswers([])
    setSummary(null)
    setCelebrate(0)
    readyAtRef.current = null
    setPhase('playing')
  }

  function choose(saidFine: boolean) {
    if (picked !== null || phase !== 'playing' || !trial) return
    const correct = saidFine === trial.isFine
    setPicked(saidFine)
    setAnswers((a) => [...a, { construct: trial.construct, isFine: trial.isFine, correct }])

    if (assessment) {
      // Probe trials measure — they don't teach. Neutral acknowledgement only.
      playTap()
    } else if (correct) {
      setCelebrate((c) => c + 1)
      playSuccess()
      speak(trial.explain[lang], lang)
    } else {
      playGentle()
      speak(trial.explain[lang], lang)
    }

    const latencyMs =
      readyAtRef.current !== null ? Math.round(performance.now() - readyAtRef.current) : null
    recordStep('answer', {
      behaviorId: trial.id,
      construct: trial.construct,
      tier: trial.tier,
      isFine: trial.isFine,
      saidFine,
      correct,
      level,
      mode: assessment ? 'assessment' : 'practice',
      latencyMs,
      chance: CHANCE,
      voiceOn: useSettings.getState().voiceOn,
    })
  }

  function next() {
    if (idx + 1 >= trials.length) {
      const correct = answers.filter((a) => a.correct).length
      const result = scoreLevel(correct, trials.length, CHANCE)
      setSummary(result)
      reportScore(GAME_KEY, result.correct)
      // Chance-corrected accuracy goes to analytics; byValence exposes
      // response bias (always answering "okay" scores at chance overall).
      recordStep('level_result', {
        level,
        mode: assessment ? 'assessment' : 'practice',
        accuracy: result.accuracy,
        chance: result.chance,
        adjustedAccuracy: result.adjustedAccuracy,
        passed: result.passed,
        mastered: result.mastered,
        byConstruct: tallyByConstruct(answers),
        byValence: tallyByValence(answers),
      })
      finishGame(result.correct)
      // Persist the attempt + unlock the next level server-side — but never
      // from an assessment run: probes measure, they don't teach or unlock.
      if (!assessment) void submit(level, result.correct, result.total)
      setPhase('result')
    } else {
      setIdx(idx + 1)
      setPicked(null)
      readyAtRef.current = null
    }
  }

  if (phase === 'select') {
    return (
      <LevelSelect
        title="Right or Wrong"
        icon="⚖️"
        levels={LEVELS}
        selected={selectedLevel}
        stateFor={stateFor}
        lang={lang}
        onSelect={setSelectedLevel}
        onStart={() => start(selectedLevel)}
        assessment={assessment}
        onAssessmentChange={setAssessment}
      />
    )
  }

  if (!trial) return null
  const isLast = idx + 1 >= trials.length
  const answered = picked !== null
  const wasCorrect = answered && picked === trial.isFine

  return (
    <WebGLGate>
      <div className="game-page">
        <span className="er-level-chip">{t('level', lang)}: {t(LEVEL_LABEL_KEY[level], lang)}</span>
        <span className="er-activity-chip">{t('activity', lang, { n: idx + 1, total: trials.length })}</span>
        {/* Trial progress only — no running score on screen: seeing the tally
            move is itself corrective feedback, which assessment must withhold
            and practice already gives through the spoken explanation. */}
        <ProgressBar value={Math.round(((idx + (answered ? 1 : 0)) / trials.length) * 100)} />
        <div className="game-canvas">
          <RightWayScene behavior={trial} celebrate={assessment ? 0 : celebrate} />
          <div className="action-bubble">{trial.bubble}</div>
          {!assessment && wasCorrect && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <PromptBanner trial={trial} lang={lang} />
          <div className="choice-row">
            {JUDGMENTS.map((j) => (
              <button
                key={String(j.saidFine)}
                className={`choice-btn${feedbackClass(j.saidFine, picked, trial.isFine, assessment)}`}
                disabled={answered}
                // In assessment the picked button keeps full opacity (a neutral
                // "registered" cue) without revealing correct/wrong colours.
                style={assessment && picked === j.saidFine ? { opacity: 1 } : undefined}
                onClick={() => choose(j.saidFine)}
              >
                <span className="choice-emoji">{j.emoji}</span>
                <span>{j.label[lang]}</span>
              </button>
            ))}
          </div>
          {answered && (
            <div className="er-feedback-row">
              <span className={`er-feedback ${assessment || wasCorrect ? 'correct' : 'wrong'}`}>
                {assessment ? RECORDED[lang] : trial.explain[lang]}
              </span>
              <button className="big-btn er-next" onClick={next}>
                {t(isLast ? 'finish' : 'next', lang)}
              </button>
            </div>
          )}
        </div>
        {phase === 'result' && summary && (
          <LevelResult
            summary={summary}
            lang={lang}
            onReplay={() => start(level)}
            onChooseLevel={() => setPhase('select')}
            countsTowardsUnlock={!assessment}
          />
        )}
      </div>
    </WebGLGate>
  )
}

/** Behaviour text + "Is that okay?" in the chosen language (banner + voice). */
function promptFor(trial: Behavior, lang: Lang): string {
  return `${trial.text[lang]} ${IS_IT_OKAY[lang]}`
}

/** Prompt banner (chosen language) with a say-it-again button (same layout as
 *  the emotion games' prompt). */
function PromptBanner({ trial, lang }: { trial: Behavior; lang: Lang }) {
  const text = promptFor(trial, lang)
  return (
    <div className="prompt-banner er-prompt">
      <div className="er-prompt-lines">
        <span className={`er-prompt-line er-prompt-${lang}`}>{text}</span>
      </div>
      {speechAvailable() && (
        <button aria-label="Say it again" onClick={() => speak(text, lang)}>🔊</button>
      )}
    </div>
  )
}

/** Reveal correct/wrong colouring after answering — but only in practice mode;
 *  assessment withholds all corrective feedback. */
function feedbackClass(
  saidFine: boolean,
  picked: boolean | null,
  isFine: boolean,
  assessment: boolean,
): string {
  if (picked === null || assessment) return ''
  if (saidFine === isFine) return ' correct'
  if (picked === saidFine) return ' wrong'
  return ''
}
