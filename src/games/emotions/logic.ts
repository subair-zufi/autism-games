import type { Difficulty } from '../../types'

export type EmotionId = 'happy' | 'sad' | 'angry' | 'surprised' | 'scared' | 'calm'

export interface EmotionMeta {
  id: EmotionId
  label: string
  emoji: string
}

export const EMOTIONS: EmotionMeta[] = [
  { id: 'happy', label: 'Happy', emoji: '😊' },
  { id: 'sad', label: 'Sad', emoji: '😢' },
  { id: 'angry', label: 'Angry', emoji: '😠' },
  { id: 'surprised', label: 'Surprised', emoji: '😮' },
  { id: 'scared', label: 'Scared', emoji: '😨' },
  { id: 'calm', label: 'Calm', emoji: '😌' },
]

const POOLS: Record<Difficulty, EmotionId[]> = {
  easy: ['happy', 'sad', 'angry'],
  medium: ['happy', 'sad', 'angry', 'surprised', 'scared'],
  hard: ['happy', 'sad', 'angry', 'surprised', 'scared', 'calm'],
}

const CHOICE_COUNT: Record<Difficulty, number> = { easy: 2, medium: 3, hard: 4 }

export interface Round {
  target: EmotionId
  choices: EmotionId[]
}

export function makeRound(
  difficulty: Difficulty,
  prevTarget: EmotionId | null,
  rng: () => number = Math.random,
): Round {
  const pool = POOLS[difficulty]
  const targets = pool.filter((e) => e !== prevTarget)
  const target = targets[Math.floor(rng() * targets.length)]
  const others = shuffle(pool.filter((e) => e !== target), rng)
  const choices = shuffle([target, ...others.slice(0, CHOICE_COUNT[difficulty] - 1)], rng)
  return { target, choices }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
