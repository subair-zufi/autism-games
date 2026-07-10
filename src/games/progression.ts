/**
 * Shared level-progression model for level-based games (Emotion Recognition,
 * Emotion Clips): the pass/mastery thresholds, level scoring, and the
 * server-backed unlock state, all keyed by the game.
 *
 * Scoring supports an optional chance correction: because the number of answer
 * options differs per level (2/3/4 choices → 50%/33%/25% guessing baselines),
 * raw accuracy is not comparable across levels. `scoreLevel` therefore also
 * reports `adjustedAccuracy` = (accuracy − chance) / (1 − chance), the standard
 * correction for guessing (0 = chance-level performance, 1 = perfect). The
 * child-facing UI keeps showing raw accuracy; the adjusted value is recorded
 * for analysis.
 */
import { useCallback, useEffect, useState } from 'react'
import { analytics, type LevelProgress } from '../services/analytics'
import { useAuth } from '../state/auth'
import type { Difficulty, GameId } from '../types'

export const LEVELS: Difficulty[] = ['easy', 'medium', 'hard']

/** Accuracy needed to unlock the next level. */
export const PASS_THRESHOLD = 0.7
/** Accuracy that marks a level "mastered" (fully complete). */
export const MASTERY_THRESHOLD = 0.8

export interface LevelSummary {
  correct: number
  incorrect: number
  total: number
  accuracy: number // 0..1, raw
  /** Mean guessing probability across the level's items (e.g. 0.5 for 2 choices). */
  chance: number
  /** Chance-corrected accuracy: (accuracy − chance) / (1 − chance), clamped to ≥0. */
  adjustedAccuracy: number
  passed: boolean // ≥ PASS_THRESHOLD → next level unlocks
  mastered: boolean // ≥ MASTERY_THRESHOLD → level fully complete
}

/**
 * Score a finished level against the pass (70%) and mastery (80%) thresholds.
 * `chance` is the mean per-item guessing probability (0 disables correction).
 */
export function scoreLevel(correct: number, total: number, chance = 0): LevelSummary {
  const accuracy = total > 0 ? correct / total : 0
  const adjustedAccuracy = chance < 1 ? Math.max(0, (accuracy - chance) / (1 - chance)) : 0
  return {
    correct,
    incorrect: total - correct,
    total,
    accuracy,
    chance,
    adjustedAccuracy,
    passed: accuracy >= PASS_THRESHOLD,
    mastered: accuracy >= MASTERY_THRESHOLD,
  }
}

export interface LevelState {
  unlocked: boolean
  attempts: number
  bestScore: number
  bestAccuracy: number
  passed: boolean
  mastered: boolean
}

/**
 * Server-backed unlock/progress state for one game.
 *
 * Loads the active student's saved rows, exposes per-level state (unlocked /
 * best / attempts / passed / mastered), and submits finished attempts. When
 * logged out, progression lives only in memory for the current session (easy
 * unlocked; passing unlocks the next level).
 */
export function useLevelProgress(gameKey: GameId) {
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const [rows, setRows] = useState<LevelProgress[]>([])
  // Levels unlocked this session (logged-out play, and instant feedback before
  // the server round-trip returns). Easy is always unlocked.
  const [localUnlocked, setLocalUnlocked] = useState<Set<Difficulty>>(() => new Set(['easy']))
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await analytics.getProgress(gameKey)
    setRows(data)
    setLoading(false)
  }, [gameKey])

  // Reload whenever the login state or active student changes ("resume on login").
  useEffect(() => {
    void refresh()
  }, [refresh, activeStudentId, isLoggedIn])

  const stateFor = useCallback(
    (level: Difficulty): LevelState => {
      const r = rows.find((x) => x.level === level)
      return {
        unlocked: level === 'easy' || localUnlocked.has(level) || !!r?.unlocked,
        attempts: r?.attempts ?? 0,
        bestScore: r?.best_score ?? 0,
        bestAccuracy: r?.best_accuracy ?? 0,
        passed: r?.passed ?? false,
        mastered: r?.mastered ?? false,
      }
    },
    [rows, localUnlocked],
  )

  /** Highest unlocked level — where the level picker resumes the learner. */
  const highestUnlocked = useCallback((): Difficulty => {
    let highest: Difficulty = 'easy'
    for (const l of LEVELS) if (stateFor(l).unlocked) highest = l
    return highest
  }, [stateFor])

  /** Persist a finished attempt and unlock the next level if it passed. */
  const submit = useCallback(
    async (level: Difficulty, score: number, total: number) => {
      const accuracy = total > 0 ? score / total : 0
      if (accuracy >= PASS_THRESHOLD) {
        const idx = LEVELS.indexOf(level)
        if (idx + 1 < LEVELS.length) {
          const next = LEVELS[idx + 1]
          setLocalUnlocked((s) => new Set(s).add(next))
        }
      }
      const data = await analytics.submitProgress({ game_key: gameKey, level, score, total })
      if (data.length) setRows(data)
    },
    [gameKey],
  )

  return { stateFor, highestUnlocked, submit, refresh, loading }
}
