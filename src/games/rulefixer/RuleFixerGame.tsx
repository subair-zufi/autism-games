/**
 * Good Choice — social-norms decision game with three unlockable levels.
 *
 * This component only orchestrates: it owns the play flow (level select →
 * playing → result) and delegates the item bank to `content.ts`, level
 * construction to `logic.ts`, and progress persistence to `../progression`.
 *
 * Research-mode behaviour (matches the emotion battery):
 *  - Training situations, spoken consequence feedback; results count towards
 *    level unlocks.
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
import { speak, speechAvailable } from '../../services/speech'
import { playGentle, playSuccess } from '../../services/sounds'
import { t, type Lang } from '../../i18n/strings'
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

const WHAT_NOW: Record<Lang, string> = {
  en: 'What should you do?',
  ml: 'നീ എന്ത് ചെയ്യും?',
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

  // Speak the situation (in the chosen language) and start the latency clock
  // whenever a new trial is presented.
  useEffect(() => {
    if (phase !== 'playing' || !trial) return
    speak(promptFor(trial, lang), lang)
    readyAtRef.current = performance.now()
  }, [phase, trial, lang])

  function start(lvl: Difficulty) {
    resetSession()
    setLevel(lvl)
    setTrials(buildLevel(lvl, Math.random))
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

    if (correct) {
      playSuccess()
      speak(opt.result[lang], lang)
    } else {
      playGentle()
      speak(opt.result[lang], lang)
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
      mode: 'practice',
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
        mode: 'practice',
        accuracy: result.accuracy,
        chance: result.chance,
        adjustedAccuracy: result.adjustedAccuracy,
        passed: result.passed,
        mastered: result.mastered,
        byConstruct: tallyByConstruct(answers),
      })
      finishGame(result.correct)
      // Persist the attempt + unlock the next level server-side.
      void submit(level, result.correct, result.total)
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
      />
    )
  }

  if (!trial) return null
  const isLast = idx + 1 >= trials.length
  const outcome = picked ? (picked.role === 'kind' ? 'good' : 'bad') : null

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
          <PromptBanner trial={trial} lang={lang} />
          <div className="choice-row">
            {trial.choices.map((opt) => (
              <button
                key={opt.id}
                className={`choice-btn${feedbackClass(opt, picked)}`}
                disabled={picked !== null}
                onClick={() => choose(opt)}
              >
                <span className="choice-emoji">{opt.emoji}</span>
                <span>{opt.label[lang]}</span>
              </button>
            ))}
          </div>
          {picked && (
            <div className="er-feedback-row">
              <span className={`er-feedback ${picked.role === 'kind' ? 'correct' : 'wrong'}`}>
                {picked.result[lang]}
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
          />
        )}
      </div>
    </WebGLGate>
  )
}

/** Situation text + "What should you do?" in the chosen language (banner + voice). */
function promptFor(trial: Trial, lang: Lang): string {
  return `${trial.situation.text[lang]} ${WHAT_NOW[lang]}`
}

/** Prompt banner (chosen language) with a say-it-again button (same layout as
 *  the emotion games' prompt). */
function PromptBanner({ trial, lang }: { trial: Trial; lang: Lang }) {
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

/** Reveal correct/wrong colouring after answering. */
function feedbackClass(opt: Option, picked: Option | null): string {
  if (!picked) return ''
  if (opt.role === 'kind') return ' correct'
  if (picked.id === opt.id) return ' wrong'
  return ''
}
