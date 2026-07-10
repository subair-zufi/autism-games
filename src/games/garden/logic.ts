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
 * The joint-attention cue fades as difficulty rises (prompt-fading
 * hierarchy: responding to a highlighted proximal point -> plain
 * proximal point -> distal point from across the garden).
 */
export type CueMode = 'pulse' | 'hover' | 'distal'
export const CUE: Record<Difficulty, CueMode> = {
  easy: 'pulse',
  medium: 'hover',
  hard: 'distal',
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

/** 3 stars = all lives kept, 2 = one slip, 1 = finished (or kept trying) */
export function starsFor(completed: boolean, livesLeft: number): number {
  if (!completed) return 1
  if (livesLeft >= 3) return 3
  if (livesLeft === 2) return 2
  return 1
}

export interface Round {
  target: ObjectId
}

export function makeRound(prevTarget: ObjectId | null, rng: () => number = Math.random): Round {
  const targets = GARDEN_OBJECTS.filter((o) => o.id !== prevTarget)
  return { target: targets[Math.floor(rng() * targets.length)].id }
}
