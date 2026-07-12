import type { Difficulty } from '../../types'

export type ExhibitId = 'gem' | 'dino' | 'rocket' | 'vase' | 'mask' | 'crystal'

export interface ExhibitMeta {
  id: ExhibitId
  label: string
  emoji: string
}

export const EXHIBITS: ExhibitMeta[] = [
  { id: 'gem', label: 'Gem', emoji: '💎' },
  { id: 'dino', label: 'Dino', emoji: '🦕' },
  { id: 'rocket', label: 'Rocket', emoji: '🚀' },
  { id: 'vase', label: 'Vase', emoji: '🏺' },
  { id: 'mask', label: 'Mask', emoji: '🎭' },
  { id: 'crystal', label: 'Crystal', emoji: '🔮' },
]

export function exhibitMeta(id: ExhibitId): ExhibitMeta {
  return EXHIBITS.find((e) => e.id === id)!
}

/** how many pedestals are on display — more exhibits = harder to follow the point */
const COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 6 }

/**
 * The joint-attention cue fades as difficulty rises (prompt-fading
 * hierarchy: responding to a highlighted proximal point -> plain
 * proximal point -> distal point from across the room). Same ladder
 * as the garden game so step-1 vs step-2 data lines up.
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
 * Researcher-facing error classification: tapping the pedestal right next
 * to the target is a near-miss (the point was roughly followed); a pick
 * further away suggests the cue itself was not followed.
 */
export function errorType(visible: ExhibitId[], target: ExhibitId, picked: ExhibitId): 'adjacent' | 'far' {
  return Math.abs(visible.indexOf(target) - visible.indexOf(picked)) <= 1 ? 'adjacent' : 'far'
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
  target: ExhibitId
  /** exhibits on display, left to right; the hand points at `target` */
  visible: ExhibitId[]
}

export function makeRound(
  difficulty: Difficulty,
  prevTarget: ExhibitId | null,
  rng: () => number = Math.random,
): Round {
  const n = COUNT[difficulty]
  const targets = EXHIBITS.filter((e) => e.id !== prevTarget)
  const target = targets[Math.floor(rng() * targets.length)].id
  const others = shuffle(EXHIBITS.filter((e) => e.id !== target).map((e) => e.id), rng)
  const visible = shuffle([target, ...others.slice(0, n - 1)], rng)
  return { target, visible }
}

/** Evenly spread `n` pedestals along a gentle arc facing the camera. */
export function slotPosition(index: number, n: number): [number, number] {
  if (n === 1) return [0, 0]
  const span = Math.min(2.6, 1.3 * (n - 1)) // half-width of the row
  const x = -span + (index / (n - 1)) * span * 2
  const z = Math.abs(x) * 0.35 // pull the ends slightly forward into an arc
  return [x, -z]
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
