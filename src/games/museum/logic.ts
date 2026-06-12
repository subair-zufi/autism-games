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
