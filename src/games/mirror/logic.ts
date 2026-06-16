import type { Difficulty } from '../../types'

export type EmotionId = 'happy' | 'sad' | 'angry' | 'scared' | 'surprised' | 'disgusted'

export interface EmotionMeta {
  id: EmotionId
  label: string
  emoji: string
  images: string[]
  /** shape hints the 3D face reads to actually emote (not just a label) */
  face: {
    mouthCurve: number // + smile, - frown
    mouthOpen: number // 0..1 how round/open the mouth is
    browInner: number // + raised inner brow (worry), - lowered inner brow (anger)
    eyeWide: number // eye scale, 1 = neutral
  }
}

export const EMOTIONS: EmotionMeta[] = [
  { id: 'happy', label: 'Happy', emoji: '😊', images: ['/emotions/HappyFace.png', '/emotions/Happy_Girl.png', '/emotions/HappyG.png'], face: { mouthCurve: 0.55, mouthOpen: 0.2, browInner: 0.1, eyeWide: 1 } },
  { id: 'sad', label: 'Sad', emoji: '😢', images: ['/emotions/SadFace.png', '/emotions/Sad_Boy.png', '/emotions/Sad_G.png', '/emotions/SadGirl.png'], face: { mouthCurve: -0.45, mouthOpen: 0.05, browInner: 0.5, eyeWide: 0.9 } },
  { id: 'angry', label: 'Angry', emoji: '😠', images: ['/emotions/Angry_Boy.png', '/emotions/AngryGirl.png', '/emotions/Angry.png'], face: { mouthCurve: -0.3, mouthOpen: 0.15, browInner: -0.6, eyeWide: 0.85 } },
  { id: 'scared', label: 'Scared', emoji: '😨', images: ['/emotions/Fear_Boy.png', '/emotions/Fear.png'], face: { mouthCurve: -0.1, mouthOpen: 0.6, browInner: 0.6, eyeWide: 1.35 } },
  { id: 'surprised', label: 'Surprised', emoji: '😮', images: ['/emotions/Surprise_Boy.png', '/emotions/Surprise.png'], face: { mouthCurve: 0, mouthOpen: 0.95, browInner: 0.4, eyeWide: 1.45 } },
  { id: 'disgusted', label: 'Yucky', emoji: '🤢', images: ['/emotions/Disgust_boy.png', '/emotions/Disgust.png'], face: { mouthCurve: -0.35, mouthOpen: 0.25, browInner: -0.4, eyeWide: 0.8 } },
]

export function emotionMeta(id: EmotionId): EmotionMeta {
  return EMOTIONS.find((e) => e.id === id)!
}

const POOLS: Record<Difficulty, EmotionId[]> = {
  easy: ['happy', 'sad', 'angry'],
  medium: ['happy', 'sad', 'angry', 'scared', 'surprised'],
  hard: ['happy', 'sad', 'angry', 'scared', 'surprised', 'disgusted'],
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
