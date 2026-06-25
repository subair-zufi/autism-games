import { expect, test } from 'vitest'
import { VIDEO_CLIPS, buildQuiz } from './logic'

test('there are 12 clips, 2 per emotion', () => {
  expect(VIDEO_CLIPS).toHaveLength(12)
  const counts: Record<string, number> = {}
  for (const c of VIDEO_CLIPS) counts[c.emotion] = (counts[c.emotion] ?? 0) + 1
  expect(Object.values(counts)).toEqual([2, 2, 2, 2, 2, 2])
})

test('video counts: easy 5, medium 7, hard 10', () => {
  expect(buildQuiz('easy').length).toBe(5)
  expect(buildQuiz('medium').length).toBe(7)
  expect(buildQuiz('hard').length).toBe(10)
})

test('choice counts: easy 3, medium/hard 4; answer always present and unique', () => {
  const check = (d: 'easy' | 'medium' | 'hard', n: number) => {
    for (let i = 0; i < 30; i++) {
      for (const q of buildQuiz(d)) {
        expect(q.choices).toHaveLength(n)
        expect(q.choices).toContain(q.answer)
        expect(q.answer).toBe(q.clip.emotion)
        expect(new Set(q.choices).size).toBe(q.choices.length)
      }
    }
  }
  check('easy', 3)
  check('medium', 4)
  check('hard', 4)
})
