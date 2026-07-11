/**
 * Emotion Recognition — a single game (replacing the old "Feeling Faces" and
 * "Know the Emotion") with three unlockable difficulty levels.
 *
 * This component only orchestrates: it owns the play flow (level select →
 * playing → result) and delegates content generation to `logic.ts`,
 * presentation to `ui.tsx` + `components/LevelScreens`, localization to
 * `../../i18n`, and progress persistence to `../progression`.
 *
 * Every answer step records the response latency measured from the moment the
 * stimulus image finished loading (`onReady`), so slow networks don't inflate
 * the measurement.
 */
import { useEffect, useRef, useState } from 'react'
import type { Difficulty } from '../../types'
import { useScores } from '../../state/scores'
import { useSettings } from '../../state/settings'
import { playGentle, playSuccess } from '../../services/sounds'
import { useGameAnalytics } from '../useGameAnalytics'
import {
  t,
  whoFeelsQuestion,
  singleFaceQuestion,
  nameFaceQuestion,
  displayLangs,
  type Lang,
} from '../../i18n/strings'
import type { EmotionId } from '../emotionVocab'
import { buildLevel, levelChance, type Activity } from './logic'
import {
  LEVELS,
  scoreLevel,
  useLevelProgress,
  type LevelSummary,
} from '../progression'
import { LevelResult, LevelSelect } from '../../components/LevelScreens'
import {
  BilingualPrompt,
  ChoiceRow,
  GroupPhotoStage,
  ProgressBar,
  SingleImageStage,
} from './ui'

export const GAME_KEY = 'emotionrecognition'

const LEVEL_LABEL_KEY: Record<Difficulty, 'levelEasy' | 'levelMedium' | 'levelHard'> = {
  easy: 'levelEasy',
  medium: 'levelMedium',
  hard: 'levelHard',
}

// The question text for an activity, in a given language. Single/highlighted-face
// prompts use the pronoun that matches the child shown (he/she).
function questionText(a: Activity, lang: Lang): string {
  if (a.kind === 'single') return singleFaceQuestion(a.gender, lang)
  if (a.kind === 'nameFace') return nameFaceQuestion(a.gender, lang)
  return whoFeelsQuestion(a.targetEmotion, lang)
}

// The correct emotion for the emotion-choice activities.
function correctEmotion(a: Activity): EmotionId | null {
  if (a.kind === 'single') return a.emotion
  if (a.kind === 'nameFace') return a.answer
  return null
}

export function EmotionRecognitionGame() {
  const lang = useSettings((s) => s.language)
  const reportScore = useScores((s) => s.reportScore)
  const { stateFor, highestUnlocked, submit } = useLevelProgress(GAME_KEY)
  const { recordStep, finishGame, resetSession } = useGameAnalytics(GAME_KEY)

  const [phase, setPhase] = useState<'select' | 'playing' | 'result'>('select')
  const [selectedLevel, setSelectedLevel] = useState<Difficulty>('easy')
  const [level, setLevel] = useState<Difficulty>('easy')
  const [activities, setActivities] = useState<Activity[]>([])
  const [idx, setIdx] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [pickedEmotion, setPickedEmotion] = useState<EmotionId | null>(null)
  const [pickedIndex, setPickedIndex] = useState<number | null>(null)
  const [summary, setSummary] = useState<LevelSummary | null>(null)
  // When the current stimulus image became visible — response latency runs
  // from here to the answer tap.
  const readyAtRef = useRef<number | null>(null)

  // While choosing, keep the selection on the highest unlocked level so a
  // returning learner resumes where they left off.
  const highest = highestUnlocked()
  useEffect(() => {
    if (phase === 'select') setSelectedLevel(highest)
  }, [highest, phase])

  function resetAnswer() {
    setAnswered(false)
    setPickedEmotion(null)
    setPickedIndex(null)
    readyAtRef.current = null
  }

  function start(lvl: Difficulty) {
    resetSession()
    setLevel(lvl)
    setActivities(buildLevel(lvl, Math.random))
    setIdx(0)
    setCorrectCount(0)
    setSummary(null)
    resetAnswer()
    setPhase('playing')
  }

  /** The stimulus image finished loading — latency measurement starts now. */
  function markReady() {
    if (readyAtRef.current === null) readyAtRef.current = performance.now()
  }

  // Record an answer and show immediate feedback (no auto-advance — the learner
  // taps Next when ready).
  function grade(correct: boolean, payload: Record<string, unknown>) {
    setAnswered(true)
    setLastCorrect(correct)
    if (correct) {
      setCorrectCount((c) => c + 1)
      playSuccess()
    } else {
      playGentle()
    }
    const latencyMs =
      readyAtRef.current !== null ? Math.round(performance.now() - readyAtRef.current) : null
    recordStep('answer', {
      ...payload,
      correct,
      level,
      kind: activities[idx].kind,
      latencyMs,
      mode: 'practice',
    })
  }

  function answerEmotion(id: EmotionId) {
    if (answered) return
    const answer = correctEmotion(activities[idx])
    setPickedEmotion(id)
    grade(id === answer, { picked: id, answer })
  }

  function answerRegion(i: number) {
    const a = activities[idx]
    if (answered || a.kind !== 'whoFeels') return
    setPickedIndex(i)
    // Record the picked *emotion* too (not just the position), so wrong taps
    // feed the per-emotion confusion matrix like every other question type.
    grade(i === a.answerIndex, {
      picked: a.photo.emotions[i],
      answer: a.targetEmotion,
      pickedIndex: i,
      answerIndex: a.answerIndex,
    })
  }

  function next() {
    if (idx + 1 >= activities.length) {
      const chance = levelChance(activities)
      const result = scoreLevel(correctCount, activities.length, chance)
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
      })
      finishGame(result.correct)
      // Persist the attempt + unlock the next level server-side.
      void submit(level, result.correct, result.total)
      setPhase('result')
    } else {
      setIdx(idx + 1)
      resetAnswer()
    }
  }

  if (phase === 'select') {
    return (
      <LevelSelect
        title={t('gameTitle', lang)}
        icon="🧠"
        levels={LEVELS}
        selected={selectedLevel}
        stateFor={stateFor}
        lang={lang}
        onSelect={setSelectedLevel}
        onStart={() => start(selectedLevel)}
      />
    )
  }

  const a = activities[idx]
  const answerId = correctEmotion(a)
  const lines = displayLangs(lang).map((l) => ({ lang: l, text: questionText(a, l) }))
  const isLast = idx + 1 >= activities.length

  return (
    <div className="game-page">
      <span className="er-level-chip">{t('level', lang)}: {t(LEVEL_LABEL_KEY[level], lang)}</span>
      <span className="er-activity-chip">{t('activity', lang, { n: idx + 1, total: activities.length })}</span>
      <ProgressBar current={idx + (answered ? 1 : 0)} total={activities.length} />

      {a.kind === 'single' ? (
        <SingleImageStage src={a.imageSrc} onReady={markReady} />
      ) : (
        <GroupPhotoStage
          photo={a.photo}
          mode={a.kind === 'whoFeels' ? 'whoFeels' : 'nameFace'}
          highlightIndex={a.kind === 'nameFace' ? a.position : undefined}
          answered={answered}
          correctIndex={a.kind === 'whoFeels' ? a.answerIndex : undefined}
          pickedIndex={pickedIndex}
          onPick={answerRegion}
          onReady={markReady}
        />
      )}

      <div className="game-bottom">
        <BilingualPrompt lines={lines} speakText={questionText(a, lang)} speakLang={lang} />

        {(a.kind === 'single' || a.kind === 'nameFace') && answerId && (
          <ChoiceRow
            choices={a.choices}
            answer={answerId}
            picked={pickedEmotion}
            answered={answered}
            lang={lang}
            onPick={answerEmotion}
          />
        )}

        {answered && (
          <div className="er-feedback-row">
            <span className={`er-feedback ${lastCorrect ? 'correct' : 'wrong'}`}>
              {t(lastCorrect ? 'feedbackCorrect' : 'feedbackWrong', lang)}
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
  )
}
