import { expect, test } from 'vitest'
import { GROUP_PHOTOS, buildQuiz } from './logic'

test('photo emotion order matches the slug', () => {
  const happySad = GROUP_PHOTOS.find((p) => p.slug === 'happy_sad')!
  expect(happySad.emotions).toEqual(['happy', 'sad'])
  const sha = GROUP_PHOTOS.find((p) => p.slug === 'sad_happy_angry')!
  expect(sha.emotions).toEqual(['sad', 'happy', 'angry'])
})

test('question counts: easy 6, medium 6, hard 10', () => {
  expect(buildQuiz('easy').length).toBe(6)
  expect(buildQuiz('medium').length).toBe(6)
  expect(buildQuiz('hard').length).toBe(10)
})

test('easy uses only two-person photos and find questions', () => {
  for (const q of buildQuiz('easy')) {
    expect(q.photo.emotions).toHaveLength(2)
    expect(q.type).toBe('find')
  }
})

test('medium uses only three-person photos and find questions', () => {
  for (const q of buildQuiz('medium')) {
    expect(q.photo.emotions).toHaveLength(3)
    expect(q.type).toBe('find')
  }
})

test('find answerIndex points at the target emotion', () => {
  for (let i = 0; i < 50; i++) {
    for (const q of buildQuiz('hard')) {
      if (q.type === 'find') {
        expect(q.photo.emotions[q.answerIndex]).toBe(q.targetEmotion)
      } else {
        expect(q.photo.emotions[q.position]).toBe(q.answer)
        expect(q.choices).toContain(q.answer)
        expect(q.choices).toHaveLength(4)
        expect(new Set(q.choices).size).toBe(q.choices.length)
      }
    }
  }
})

test('deterministic with a seeded rng', () => {
  const seq = [0.1, 0.5, 0.9, 0.3, 0.7]
  const makeRng = () => {
    let i = 0
    return () => seq[i++ % seq.length]
  }
  const a = buildQuiz('hard', makeRng())
  const b = buildQuiz('hard', makeRng())
  expect(a.map((q) => q.photo.slug)).toEqual(b.map((q) => q.photo.slug))
})
