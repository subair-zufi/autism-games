import type { Difficulty } from '../../types'

export type ColorId = 'red' | 'blue' | 'yellow' | 'green' | 'purple'

export interface ColorMeta {
  id: ColorId
  label: string
  hex: string
}

export const BOX_COLORS: ColorMeta[] = [
  { id: 'red', label: 'Red', hex: '#e26d5c' },
  { id: 'blue', label: 'Blue', hex: '#5c9ead' },
  { id: 'yellow', label: 'Yellow', hex: '#f2c14e' },
  { id: 'green', label: 'Green', hex: '#84a98c' },
  { id: 'purple', label: 'Purple', hex: '#9d8cd6' },
]

const BOX_COUNT: Record<Difficulty, number> = { easy: 3, medium: 4, hard: 5 }

/** correct drops needed to win a session */
export const GOAL: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 10 }

export function boxesFor(difficulty: Difficulty): ColorId[] {
  return BOX_COLORS.slice(0, BOX_COUNT[difficulty]).map((c) => c.id)
}

export function pickTarget(
  boxes: ColorId[],
  prev: ColorId | null,
  rng: () => number = Math.random,
): ColorId {
  const pool = boxes.filter((c) => c !== prev)
  return pool[Math.floor(rng() * pool.length)]
}
