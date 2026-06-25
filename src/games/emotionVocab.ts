export type EmotionId = 'happy' | 'sad' | 'angry' | 'surprised' | 'scared' | 'disgust'

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
  { id: 'disgust', label: 'Disgust', emoji: '🤢' },
]

export function emotionMeta(id: EmotionId): EmotionMeta {
  return EMOTIONS.find((e) => e.id === id)!
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
