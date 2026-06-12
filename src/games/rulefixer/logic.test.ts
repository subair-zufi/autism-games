import { expect, test } from 'vitest'
import { makeRound, rounds, SITUATIONS } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('round counts grow with difficulty', () => {
  expect(rounds('easy')).toBeLessThan(rounds('hard'))
  expect(rounds('easy')).toBeGreaterThan(0)
})

test('every situation has exactly one kind (good) option of three', () => {
  for (const s of SITUATIONS) {
    expect(s.options).toHaveLength(3)
    expect(s.options.filter((o) => o.isGood)).toHaveLength(1)
  }
})

test('every option has label, emoji and a spoken result', () => {
  for (const s of SITUATIONS) {
    for (const o of s.options) {
      expect(o.label.length).toBeGreaterThan(0)
      expect(o.emoji.length).toBeGreaterThan(0)
      expect(o.result.length).toBeGreaterThan(0)
    }
  }
})

test('situation and option ids are unique', () => {
  expect(new Set(SITUATIONS.map((s) => s.id)).size).toBe(SITUATIONS.length)
  for (const s of SITUATIONS) {
    expect(new Set(s.options.map((o) => o.id)).size).toBe(3)
  }
})

test('makeRound returns all three options including the good one', () => {
  for (let i = 0; i < 40; i++) {
    const r = makeRound(null, Math.random)
    expect(r.choices).toHaveLength(3)
    expect(r.choices.filter((o) => o.isGood)).toHaveLength(1)
    expect(new Set(r.choices.map((o) => o.id))).toEqual(new Set(r.situation.options.map((o) => o.id)))
  }
})

test('makeRound never repeats the previous situation', () => {
  for (let i = 0; i < 50; i++) {
    expect(makeRound('books', Math.random).situation.id).not.toBe('books')
  }
})

test('deterministic with a seeded rng', () => {
  const a = makeRound(null, rng([0.3, 0.6, 0.1]))
  const b = makeRound(null, rng([0.3, 0.6, 0.1]))
  expect(a.situation.id).toBe(b.situation.id)
  expect(a.choices.map((o) => o.id)).toEqual(b.choices.map((o) => o.id))
})
