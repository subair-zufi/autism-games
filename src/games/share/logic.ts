import type { Difficulty } from '../../types'

export type FindId =
  | 'rainbow'
  | 'balloon'
  | 'frog'
  | 'snail'
  | 'duck'
  | 'sunflower'
  | 'kite'
  | 'ladybug'

export interface FindMeta {
  id: FindId
  label: string
  emoji: string
  /** what the robot exclaims when this is shared */
  react: string
  /** [x, z] spot in the meadow; y is decided by each model */
  position: [number, number]
}

export const FINDS: FindMeta[] = [
  { id: 'rainbow', label: 'Rainbow', emoji: '🌈', react: 'Wow, a rainbow! I see it too!', position: [-3.4, -2.6] },
  { id: 'balloon', label: 'Balloon', emoji: '🎈', react: 'A red balloon! How lovely!', position: [2.8, -2.2] },
  { id: 'frog', label: 'Frog', emoji: '🐸', react: 'A little frog! Ribbit ribbit!', position: [-1.2, 0.8] },
  { id: 'snail', label: 'Snail', emoji: '🐌', react: 'A snail with a swirly shell!', position: [1.4, 1.2] },
  { id: 'duck', label: 'Duck', emoji: '🦆', react: 'A yellow duck! Quack quack!', position: [3.6, 0.2] },
  { id: 'sunflower', label: 'Sunflower', emoji: '🌻', react: 'A tall sunflower! So bright!', position: [-3.2, 0.4] },
  { id: 'kite', label: 'Kite', emoji: '🪁', react: 'A kite in the sky! Amazing!', position: [0.6, -3] },
  { id: 'ladybug', label: 'Ladybug', emoji: '🐞', react: 'A tiny ladybug! I love it!', position: [-0.4, 2] },
]

export function findMeta(id: FindId): FindMeta {
  return FINDS.find((f) => f.id === id)!
}

export interface ShareConfig {
  /** finds needed to win the session */
  goal: number
  /** session length in seconds */
  seconds: number
}

export const CONFIG: Record<Difficulty, ShareConfig> = {
  easy: { goal: 3, seconds: 120 },
  medium: { goal: 5, seconds: 100 },
  hard: { goal: 7, seconds: 90 },
}
