import type { Difficulty } from '../../types'

export type ObjectId =
  | 'flower-red'
  | 'flower-yellow'
  | 'flower-purple'
  | 'butterfly'
  | 'tree'
  | 'bird'
  | 'mushroom'
  | 'bee'

export interface ObjectMeta {
  id: ObjectId
  label: string
  category: string
  /** [x, z] spot in the garden; y is decided by each model */
  position: [number, number]
}

export const GARDEN_OBJECTS: ObjectMeta[] = [
  { id: 'flower-red', label: 'Red Flower', category: 'flower', position: [-1.7, 0.6] },
  { id: 'flower-yellow', label: 'Yellow Flower', category: 'flower', position: [0, 0.9] },
  { id: 'flower-purple', label: 'Purple Flower', category: 'flower', position: [1.7, 0.6] },
  { id: 'butterfly', label: 'Butterfly', category: 'butterfly', position: [1, -1.3] },
  { id: 'tree', label: 'Tree', category: 'tree', position: [-2.7, -1.6] },
  { id: 'bird', label: 'Bird', category: 'bird', position: [-0.9, -1] },
  { id: 'mushroom', label: 'Mushroom', category: 'mushroom', position: [3.2, -0.7] },
  { id: 'bee', label: 'Bee', category: 'bee', position: [-2.2, 1.3] },
]

export function objectMeta(id: ObjectId): ObjectMeta {
  return GARDEN_OBJECTS.find((o) => o.id === id)!
}

/**
 * The joint-attention cue fades *within a session* (JASPER-style prompt
 * fading): highlighted proximal point -> plain proximal point -> distal point
 * from across the garden -> gaze only (a face turning toward the target, no
 * hand at all). Difficulty sets the *entry* rung; every `FADE_STREAK`
 * consecutive first-attempt finds thins the prompt one rung, and a wrong pick
 * brings one rung of support back (least-to-most), never below the entry
 * rung. Same ladder as the museum game so step-1 vs step-2 data lines up.
 */
export type CueMode = 'pulse' | 'hover' | 'distal' | 'gaze'
export const CUE_LADDER: CueMode[] = ['pulse', 'hover', 'distal', 'gaze']
export const START_TIER: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 }
/** consecutive first-attempt finds needed to fade the cue one rung */
export const FADE_STREAK = 3

export function fadedTier(tier: number): number {
  return Math.min(tier + 1, CUE_LADDER.length - 1)
}

export function supportedTier(tier: number, difficulty: Difficulty): number {
  return Math.max(tier - 1, START_TIER[difficulty])
}

/** correct finds needed to win a session */
export const GOAL: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 10 }

/**
 * Child-facing points. Independent (first-attempt) responses earn more
 * than corrected ones; retries are still rewarded, never punished.
 */
export const POINTS = { first: 10, retry: 5, streakBonus: 2 }
/** consecutive first-attempt finds needed before the streak bonus kicks in */
export const STREAK_LEN = 3

export function pointsFor(firstAttempt: boolean, streakAfterThis: number): number {
  if (!firstAttempt) return POINTS.retry
  return POINTS.first + (streakAfterThis >= STREAK_LEN ? POINTS.streakBonus : 0)
}

/**
 * Researcher-facing error classification: tapping a same-category object
 * (e.g. wrong flower) is a fine-discrimination slip; a different-category
 * object suggests the cue itself was not followed.
 */
export function errorType(target: ObjectId, picked: ObjectId): 'same-category' | 'different-category' {
  return objectMeta(target).category === objectMeta(picked).category
    ? 'same-category'
    : 'different-category'
}

/**
 * Stars reward *first-try* finds (the game never fails — wrong taps are only
 * gently corrected, per the joint-attention "errors are never punished"
 * principle). 3 stars ≥80% of finds were first-attempt, 2 ≥50%, else 1 — every
 * finished session earns at least one.
 */
export function starsFor(firstAttemptFinds: number, goal: number): number {
  const ratio = goal > 0 ? firstAttemptFinds / goal : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return 1
}

export interface Round {
  target: ObjectId
}

export function makeRound(prevTarget: ObjectId | null, rng: () => number = Math.random): Round {
  const targets = GARDEN_OBJECTS.filter((o) => o.id !== prevTarget)
  return { target: targets[Math.floor(rng() * targets.length)].id }
}
