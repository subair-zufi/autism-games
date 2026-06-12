import type { Difficulty } from '../../types'

export type WeatherId = 'sunny' | 'rainy' | 'stormy' | 'snowy'

export interface WeatherMeta {
  id: WeatherId
  label: string
  feeling: string
  emoji: string
  color: string
}

export const ZONES: WeatherMeta[] = [
  { id: 'sunny', label: 'Sunny', feeling: 'Happy', emoji: '☀️', color: '#f5c542' },
  { id: 'rainy', label: 'Rainy', feeling: 'Sad', emoji: '🌧️', color: '#6f9fd8' },
  { id: 'stormy', label: 'Stormy', feeling: 'Angry', emoji: '⛈️', color: '#7d6b9e' },
  { id: 'snowy', label: 'Snowy', feeling: 'Scared', emoji: '🌨️', color: '#9fd3d8' },
]

export function zoneMeta(id: WeatherId): WeatherMeta {
  return ZONES.find((z) => z.id === id)!
}

type Tier = 'easy' | 'medium'

export interface Situation {
  id: string
  text: string
  emoji: string
  weather: WeatherId
  tier: Tier
}

export const SITUATIONS: Situation[] = [
  { id: 'gift', text: 'You get a surprise present at your party.', emoji: '🎁', weather: 'sunny', tier: 'easy' },
  { id: 'friend', text: 'Your best friend comes over to play.', emoji: '🧑‍🤝‍🧑', weather: 'sunny', tier: 'easy' },
  { id: 'icecream', text: 'Your ice cream falls on the ground.', emoji: '🍦', weather: 'rainy', tier: 'easy' },
  { id: 'cancelled', text: 'Your trip to the park is cancelled.', emoji: '🌂', weather: 'rainy', tier: 'medium' },
  { id: 'broke', text: 'Someone breaks your toy on purpose.', emoji: '🧸', weather: 'stormy', tier: 'easy' },
  { id: 'snatch', text: 'Someone snatches your crayons away.', emoji: '🖍️', weather: 'stormy', tier: 'medium' },
  { id: 'dog', text: 'A big dog barks and runs at you.', emoji: '🐕', weather: 'snowy', tier: 'easy' },
  { id: 'dark', text: 'You hear a loud noise in the dark.', emoji: '🌙', weather: 'snowy', tier: 'medium' },
  { id: 'goal', text: 'You score a goal for your team.', emoji: '⚽', weather: 'sunny', tier: 'medium' },
  { id: 'lost', text: 'You cannot find your mum in the shop.', emoji: '🛒', weather: 'snowy', tier: 'medium' },
]

const ROUNDS: Record<Difficulty, number> = { easy: 5, medium: 6, hard: 8 }
export function rounds(difficulty: Difficulty): number {
  return ROUNDS[difficulty]
}

/** Easy sessions stick to the most obvious situations; harder ones use all. */
export function nextSituation(
  difficulty: Difficulty,
  prevId: string | null,
  rng: () => number = Math.random,
): Situation {
  const pool = SITUATIONS.filter(
    (s) => s.id !== prevId && (difficulty !== 'easy' || s.tier === 'easy'),
  )
  return pool[Math.floor(rng() * pool.length)]
}

/** Evenly spread the 4 zones along a gentle arc facing the camera. */
export function zonePosition(index: number): [number, number] {
  const span = 4.2
  const x = -span / 2 + (index / (ZONES.length - 1)) * span
  return [x, -Math.abs(x) * 0.25]
}
