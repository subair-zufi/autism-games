import { expect, test } from 'vitest'
import {
  ALL_EMOTION_IDS,
  CONFUSABLE_WITH,
  EMOTIONS,
  emotionMeta,
  pickDistractors,
  shuffle,
  type EmotionId,
} from './emotionVocab'

test('has the six asset emotions with labels and emojis', () => {
  expect(EMOTIONS.map((e) => e.id)).toEqual([
    'happy', 'sad', 'angry', 'surprised', 'scared', 'disgust',
  ])
  for (const e of EMOTIONS) {
    expect(e.label.length).toBeGreaterThan(0)
    expect(e.emoji.length).toBeGreaterThan(0)
  }
})

test('emotionMeta returns the matching entry', () => {
  expect(emotionMeta('scared').label).toBe('Scared')
})

test('emotionMeta falls back to a placeholder for unknown server ids', () => {
  const meta = emotionMeta('fear' as EmotionId)
  expect(meta.label).toBe('fear')
  expect(meta.emoji.length).toBeGreaterThan(0)
})

test('shuffle keeps the same elements and does not mutate input', () => {
  const input = [1, 2, 3, 4, 5]
  const out = shuffle(input, () => 0)
  expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  expect(input).toEqual([1, 2, 3, 4, 5])
})

// Deterministic PRNG (mulberry32) for the distractor sampling checks.
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('confusability matrix is symmetric and never lists the emotion itself', () => {
  for (const id of ALL_EMOTION_IDS) {
    expect(CONFUSABLE_WITH[id]).not.toContain(id)
    for (const other of CONFUSABLE_WITH[id]) {
      expect(CONFUSABLE_WITH[other]).toContain(id)
    }
  }
})

test('pickDistractors returns unique emotions excluding the answer', () => {
  for (const tier of ['low', 'mixed', 'high'] as const) {
    for (const answer of ALL_EMOTION_IDS) {
      for (let s = 1; s <= 20; s++) {
        const d = pickDistractors(answer, 3, tier, seeded(s))
        expect(d).toHaveLength(3)
        expect(d).not.toContain(answer)
        expect(new Set(d).size).toBe(3)
      }
    }
  }
})

test('low tier avoids confusable distractors when enough far emotions exist', () => {
  for (const answer of ALL_EMOTION_IDS) {
    const far = ALL_EMOTION_IDS.filter(
      (id) => id !== answer && !CONFUSABLE_WITH[answer].includes(id),
    )
    for (let s = 1; s <= 20; s++) {
      // Ask for exactly as many distractors as there are far emotions: none
      // of the confusable ones should be needed.
      const d = pickDistractors(answer, far.length, 'low', seeded(s))
      for (const id of d) expect(CONFUSABLE_WITH[answer]).not.toContain(id)
    }
  }
})

test('high tier always includes at least one confusable distractor', () => {
  for (const answer of ALL_EMOTION_IDS) {
    for (let s = 1; s <= 20; s++) {
      const d = pickDistractors(answer, 1, 'high', seeded(s))
      const confusable = d.filter((id: EmotionId) => CONFUSABLE_WITH[answer].includes(id))
      expect(confusable.length).toBeGreaterThanOrEqual(1)
    }
  }
})
