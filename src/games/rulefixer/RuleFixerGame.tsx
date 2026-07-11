/**
 * Good Choice — social-norms decision game with three unlockable levels.
 *
 * This component only orchestrates: it owns the play flow (level select →
 * playing → result) and delegates the item bank to `content.ts`, level
 * construction to `logic.ts`, and progress persistence to `../progression`.
 *
 * Research-mode behaviour (matches the emotion battery):
 *  - Two modes. Practice: training situations, spoken consequence feedback,
 *    results count towards level unlocks. Assessment: held-out probe
 *    situations, corrective feedback withheld (neutral acknowledgement only),
 *    recorded in analytics but never submitted to the unlock ladder.
 *  - No lives / failure state: every child completes all trials, so struggling
 *    participants still produce a full item set.
 *  - Every answer records decision latency from the moment the trial was
 *    presented, plus the graded role picked (kind / passive / wrong) — the
 *    passive-omission error is the clinically interesting one.
 *  - Bilingual (English + Malayalam) prompts, options and feedback, spoken
 *    Malayalam-first like Roll-Back Buddy.
 */
import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../../types'
import { useScores } from '../../state/scores'
import { useSettings } from '../../state/settings'
import { ProgressBar } from '../../components/ProgressBar'
import { WebGLGate } from '../../components/WebGLGate'
import { LevelResult, LevelSelect } from '../../components/LevelScreens'
import { speakAll, speechAvailable } from '../../services/speech'
import { playGentle, playSuccess, playTap } from '../../services/sounds'
import { t, DISPLAY_LANGS, type Lang } from '../../i18n/strings'
import { useGameAnalytics } from '../useGameAnalytics'
import { LEVELS, useLevelProgress } from '../progression'
import {
  buildLevel,
  levelChance,
  scoreLevel,
  tallyByConstruct,
  trialChance,
  type Construct,
  type LevelSummary,
  type Option,
  type Trial,
} from './logic'
import { RuleFixerScene } from './RuleFixerScene'

export const GAME_KEY = 'rulefixer'

/** Voice reads Malayalam first (primary audience), then English. */
const VOICE_ORDER: Lang[] = ['ml', 'en']

const WHAT_NOW: Record<Lang, string> = {
  en: 'What should you do?',
  ml: 'നീ എന്ത് ചെയ്യും?',
}

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

export function RuleFixerGame() {
  const lang = useSettings((s) => s.language)
  const reportScore = useScores((s) => s.reportScore)
  const { stateFor, highestUnlocked, submit } = useLevelProgress(GAME_KEY)
  const { recordStep, finishGame, resetSession } = useGameAnalytics(GAME_KEY)

  const [phase, setPhase] = useState<'select' | 'playing' | 'result'>('select')
  const [selectedLevel, setSelectedLevel] = useState<Difficulty>('easy')
  const [assessment, setAssessment] = useState(false)
  const [level, setLevel] = useState<Difficulty>('easy')
  const [trials, setTrials] = useState<Trial[]>([])
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<Option | null>(null)
  const [answers, setAnswers] = useState<Array<{ construct: Construct; correct: boolean }>>([])
  const [summary, setSummary] = useState<LevelSummary | null>(null)
  // When the current trial was presented — decision latency runs from here to
  // the answer tap.
  const readyAtRef = useRef<number | null>(null)

  // While choosing, keep the selection on the highest unlocked level so a
  // returning learner resumes where they left off.
  const highest = highestUnlocked()
  useEffect(() => {
    if (phase === 'select') setSelectedLevel(highest)
  }, [highest, phase])

  const trial = trials[idx] as Trial | undefined

  // Speak the situation (Malayalam first) and start the latency clock whenever
  // a new trial is presented.
  useEffect(() => {
    if (phase !== 'playing' || !trial) return
    speakAll(promptSpeech(trial))
    readyAtRef.current = performance.now()
  }, [phase, trial])

  function start(lvl: Difficulty) {
    resetSession()
    setLevel(lvl)
    setTrials(buildLevel(lvl, Math.random, assessment ? 'probe' : 'training'))
    setIdx(0)
    setPicked(null)
    setAnswers([])
    setSummary(null)
    readyAtRef.current = null
    setPhase('playing')
  }

  function choose(opt: Option) {
    if (picked || phase !== 'playing' || !trial) return
    const correct = opt.role === 'kind'
    setPicked(opt)
    setAnswers((a) => [...a, { construct: trial.situation.construct, correct }])

    if (assessment) {
      // Probe trials measure — they don't teach. Neutral acknowledgement only.
      playTap()
    } else if (correct) {
      playSuccess()
      speakAll(VOICE_ORDER.map((l) => ({ lang: l, text: opt.result[l] })))
    } else {
      playGentle()
      speakAll(VOICE_ORDER.map((l) => ({ lang: l, text: opt.result[l] })))
    }

    const latencyMs =
      readyAtRef.current !== null ? Math.round(performance.now() - readyAtRef.current) : null
    recordStep('answer', {
      situationId: trial.situation.id,
      construct: trial.situation.construct,
      picked: opt.id,
      pickedRole: opt.role,
      correct,
      level,
      mode: assessment ? 'assessment' : 'practice',
      latencyMs,
      chance: trialChance(trial),
      voiceOn: useSettings.getState().voiceOn,
    })
  }

  function next() {
    if (idx + 1 >= trials.length) {
      const correct = answers.filter((a) => a.correct).length
      const chance = levelChance(trials)
      const result = scoreLevel(correct, trials.length, chance)
      setSummary(result)
      reportScore(GAME_KEY, result.correct)
      // Chance-corrected accuracy goes to analytics (levels have different
      // guessing baselines, so raw accuracy is not comparable across them).
      recordStep('level_result', {
        level,
        mode: assessment ? 'assessment' : 'practice',
        accuracy: result.accuracy,
        chance: result.chance,
        adjustedAccuracy: result.adjustedAccuracy,
        passed: result.passed,
        mastered: result.mastered,
        byConstruct: tallyByConstruct(answers),
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
        title="Good Choice"
        icon="💡"
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
  const outcome = picked && !assessment ? (picked.role === 'kind' ? 'good' : 'bad') : null

  return (
    <WebGLGate>
      <div className="game-page">
        <span className="er-level-chip">{t('level', lang)}: {t(LEVEL_LABEL_KEY[level], lang)}</span>
        <span className="er-activity-chip">{t('activity', lang, { n: idx + 1, total: trials.length })}</span>
        {/* Trial progress only — no running score on screen: seeing the tally
            move is itself corrective feedback, which assessment must withhold
            and practice already gives through the spoken consequence. */}
        <ProgressBar value={Math.round(((idx + (picked ? 1 : 0)) / trials.length) * 100)} />
        <div className="game-canvas">
          <RuleFixerScene situation={trial.situation} outcome={outcome} />
          <div className="action-bubble">{trial.situation.bubble}</div>
          {outcome === 'good' && <div className="celebrate">⭐</div>}
        </div>
        <div className="game-bottom">
          <BilingualBanner trial={trial} />
          <div className="choice-row">
            {trial.choices.map((opt) => (
              <button
                key={opt.id}
                className={`choice-btn${feedbackClass(opt, picked, assessment)}`}
                disabled={picked !== null}
                // In assessment the picked button keeps full opacity (a neutral
                // "registered" cue) without revealing correct/wrong colours.
                style={assessment && picked?.id === opt.id ? { opacity: 1 } : undefined}
                onClick={() => choose(opt)}
              >
                <span className="choice-emoji">{opt.emoji}</span>
                <span>{opt.label.en}</span>
                <span className="er-prompt-ml">{opt.label.ml}</span>
              </button>
            ))}
          </div>
          {picked && (
            <div className="er-feedback-row">
              <span className={`er-feedback ${assessment || picked.role === 'kind' ? 'correct' : 'wrong'}`}>
                {assessment
                  ? RECORDED[lang]
                  : DISPLAY_LANGS.map((l) => picked.result[l]).join(' · ')}
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

/** Situation text + "What should you do?" in both languages (banner + voice). */
function promptLines(trial: Trial): Array<{ lang: Lang; text: string }> {
  return DISPLAY_LANGS.map((lang) => ({
    lang,
    text: `${trial.situation.text[lang]} ${WHAT_NOW[lang]}`,
  }))
}

function promptSpeech(trial: Trial): Array<{ lang: Lang; text: string }> {
  return VOICE_ORDER.map((lang) => ({
    lang,
    text: `${trial.situation.text[lang]} ${WHAT_NOW[lang]}`,
  }))
}

/** Bilingual prompt banner with a say-it-again button (same layout as the
 *  emotion games' prompt). */
function BilingualBanner({ trial }: { trial: Trial }) {
  const lines = promptLines(trial)
  return (
    <div className="prompt-banner er-prompt">
      <div className="er-prompt-lines">
        {lines.map(({ lang, text }) => (
          <span key={lang} className={`er-prompt-line er-prompt-${lang}`}>{text}</span>
        ))}
      </div>
      {speechAvailable() && (
        <button aria-label="Say it again" onClick={() => speakAll(promptSpeech(trial))}>🔊</button>
      )}
    </div>
  )
}

/** Reveal correct/wrong colouring after answering — but only in practice mode;
 *  assessment withholds all corrective feedback. */
function feedbackClass(opt: Option, picked: Option | null, assessment: boolean): string {
  if (!picked || assessment) return ''
  if (opt.role === 'kind') return ' correct'
  if (picked.id === opt.id) return ' wrong'
  return ''
}
