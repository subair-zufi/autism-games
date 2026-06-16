import type { Difficulty } from '../../types'

export type EmotionId = 'happy' | 'sad' | 'angry' | 'surprised' | 'scared' | 'calm'

export interface EmotionMeta {
  id: EmotionId
  label: string
  emoji: string
  images: string[]
}

export const EMOTIONS: EmotionMeta[] = [
  { id: 'happy', label: 'Happy', emoji: '😊', images: ['./emotions/HappyFace.png', './emotions/Happy_Girl.png', './emotions/HappyG.png'] },
  { id: 'sad', label: 'Sad', emoji: '😢', images: ['./emotions/SadFace.png', './emotions/Sad_Boy.png', './emotions/Sad_G.png', './emotions/SadGirl.png'] },
  { id: 'angry', label: 'Angry', emoji: '😠', images: ['./emotions/Angry_Boy.png', './emotions/AngryGirl.png', './emotions/Angry.png'] },
  { id: 'surprised', label: 'Surprised', emoji: '😮', images: ['./emotions/Surprise_Boy.png', './emotions/Surprise.png'] },
  { id: 'scared', label: 'Scared', emoji: '😨', images: ['./emotions/Fear_Boy.png', './emotions/Fear.png'] },
  { id: 'calm', label: 'Calm', emoji: '😌', images: ['./emotions/Smile_Boy.png', './emotions/Smile_Girl.png', './emotions/Smile2_Girl.png'] },
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
  imageMap: Record<EmotionId, string>
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
  const imageMap = {} as Record<EmotionId, string>
  for (const id of pool) {
    const meta = EMOTIONS.find((e) => e.id === id)!
    imageMap[id] = meta.images[Math.floor(rng() * meta.images.length)]
  }
  return { target, choices, imageMap }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
