import { expect, test } from 'vitest'
import { EMOTIONS, emotionMeta, shuffle } from './emotionVocab'

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

test('shuffle keeps the same elements and does not mutate input', () => {
  const input = [1, 2, 3, 4, 5]
  const out = shuffle(input, () => 0)
  expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
  expect(input).toEqual([1, 2, 3, 4, 5])
})
