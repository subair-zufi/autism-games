/**
 * Progress management for Emotion Recognition, kept out of the UI component.
 *
 * Wraps the server-backed progress API: loads the active student's saved rows,
 * exposes per-level state (unlocked / best / attempts / passed / mastered), and
 * submits finished attempts. When logged out, progression lives only in memory
 * for the current session (easy unlocked; passing unlocks the next level).
 */
import { useCallback, useEffect, useState } from 'react'
import { analytics, type LevelProgress } from '../../services/analytics'
import { useAuth } from '../../state/auth'
import type { Difficulty } from '../../types'
import { PASS_THRESHOLD } from './logic'

export const GAME_KEY = 'emotionrecognition'
export const LEVELS: Difficulty[] = ['easy', 'medium', 'hard']

export interface LevelState {
  unlocked: boolean
  attempts: number
  bestScore: number
  bestAccuracy: number
  passed: boolean
  mastered: boolean
}

export function useLevelProgress() {
  const activeStudentId = useAuth((s) => s.activeStudentId)
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  const [rows, setRows] = useState<LevelProgress[]>([])
  // Levels unlocked this session (logged-out play, and instant feedback before
  // the server round-trip returns). Easy is always unlocked.
  const [localUnlocked, setLocalUnlocked] = useState<Set<Difficulty>>(() => new Set(['easy']))
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const data = await analytics.getProgress(GAME_KEY)
    setRows(data)
    setLoading(false)
  }, [])

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
  const submit = useCallback(async (level: Difficulty, score: number, total: number) => {
    const accuracy = total > 0 ? score / total : 0
    if (accuracy >= PASS_THRESHOLD) {
      const idx = LEVELS.indexOf(level)
      if (idx + 1 < LEVELS.length) {
        const next = LEVELS[idx + 1]
        setLocalUnlocked((s) => new Set(s).add(next))
      }
    }
    const data = await analytics.submitProgress({ game_key: GAME_KEY, level, score, total })
    if (data.length) setRows(data)
  }, [])

  return { stateFor, highestUnlocked, submit, refresh, loading }
}
