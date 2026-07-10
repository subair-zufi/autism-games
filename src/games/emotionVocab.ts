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

export const ALL_EMOTION_IDS: EmotionId[] = EMOTIONS.map((e) => e.id)

/**
 * Which emotions are perceptually confusable with each other, per the facial
 * expression literature (fear↔surprise and anger↔disgust are the classic hard
 * discriminations; sadness is moderately confusable with fear/disgust/anger).
 * Kept symmetric: a ∈ CONFUSABLE_WITH[b] ⇔ b ∈ CONFUSABLE_WITH[a].
 *
 * This drives the difficulty of answer options: an easy trial pairs the target
 * with a far distractor (e.g. happy vs. sad); a hard trial forces at least one
 * confusable distractor (e.g. scared vs. surprised).
 */
export const CONFUSABLE_WITH: Record<EmotionId, EmotionId[]> = {
  happy: ['surprised'],
  sad: ['scared', 'disgust', 'angry'],
  angry: ['disgust', 'sad'],
  surprised: ['scared', 'happy'],
  scared: ['surprised', 'sad'],
  disgust: ['angry', 'sad'],
}

/**
 * How hard the distractors should be:
 *  - 'low'   → prefer non-confusable ("far") emotions, so the discrimination is easy.
 *  - 'mixed' → uniform random over all other emotions.
 *  - 'high'  → always include at least one confusable emotion when one exists.
 */
export type DistractorTier = 'low' | 'mixed' | 'high'

/**
 * Pick `count` distractor emotions for `answer` at the given difficulty tier.
 * Order is not meaningful — callers shuffle the final choice list.
 */
export function pickDistractors(
  answer: EmotionId,
  count: number,
  tier: DistractorTier,
  rng: () => number,
): EmotionId[] {
  const others = ALL_EMOTION_IDS.filter((id) => id !== answer)
  const confusable = CONFUSABLE_WITH[answer]
  const far = others.filter((id) => !confusable.includes(id))
  if (tier === 'low') {
    // Far distractors first; only fall back to confusable ones if we run out.
    return [...shuffle(far, rng), ...shuffle(confusable, rng)].slice(0, count)
  }
  if (tier === 'high') {
    const lead = shuffle(confusable, rng).slice(0, 1)
    const rest = shuffle(others.filter((id) => !lead.includes(id)), rng)
    return [...lead, ...rest].slice(0, count)
  }
  return shuffle(others, rng).slice(0, count)
}

export function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
