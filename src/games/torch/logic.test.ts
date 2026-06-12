import { expect, test } from 'vitest'
import { CONFIG, nextQuestion, QUESTIONS } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('exchanges grow and waiting gets longer with difficulty', () => {
  expect(CONFIG.easy.exchanges).toBeLessThan(CONFIG.hard.exchanges)
  expect(CONFIG.easy.robotMs).toBeLessThan(CONFIG.hard.robotMs)
})

test('every question has three answers and a reply', () => {
  for (const q of QUESTIONS) {
    expect(q.ask.length).toBeGreaterThan(0)
    expect(q.answers).toHaveLength(3)
    expect(q.reply.length).toBeGreaterThan(0)
    for (const a of q.answers) {
      expect(a.label.length).toBeGreaterThan(0)
      expect(a.emoji.length).toBeGreaterThan(0)
    }
  }
})

test('question and answer ids are unique', () => {
  expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length)
  for (const q of QUESTIONS) {
    expect(new Set(q.answers.map((a) => a.id)).size).toBe(3)
  }
})

test('there are enough questions for the longest session', () => {
  expect(QUESTIONS.length).toBeGreaterThanOrEqual(CONFIG.hard.exchanges)
})

test('nextQuestion never repeats the previous one', () => {
  for (let i = 0; i < 50; i++) {
    expect(nextQuestion('animal', Math.random).id).not.toBe('animal')
  }
})

test('deterministic with a seeded rng', () => {
  expect(nextQuestion(null, rng([0.5])).id).toBe(nextQuestion(null, rng([0.5])).id)
})
