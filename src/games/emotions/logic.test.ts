import { expect, test } from 'vitest'
import { EMOTIONS, makeRound } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('easy rounds have 2 choices from basic emotions', () => {
  const r = makeRound('easy', null, Math.random)
  expect(r.choices).toHaveLength(2)
  expect(r.choices).toContain(r.target)
  for (const c of r.choices) expect(['happy', 'sad', 'angry']).toContain(c)
})

test('medium has 3 choices, hard has 4', () => {
  expect(makeRound('medium', null, Math.random).choices).toHaveLength(3)
  expect(makeRound('hard', null, Math.random).choices).toHaveLength(4)
})

test('choices are unique', () => {
  for (let i = 0; i < 50; i++) {
    const r = makeRound('hard', null, Math.random)
    expect(new Set(r.choices).size).toBe(r.choices.length)
  }
})

test('target never repeats the previous round', () => {
  for (let i = 0; i < 50; i++) {
    expect(makeRound('easy', 'happy', Math.random).target).not.toBe('happy')
  }
})

test('deterministic with seeded rng', () => {
  const r = makeRound('easy', null, rng([0, 0]))
  expect(r.choices).toContain(r.target)
  expect(r.target).toBe('happy')
})

test('every emotion has display metadata', () => {
  expect(EMOTIONS).toHaveLength(6)
  for (const e of EMOTIONS) {
    expect(e.label.length).toBeGreaterThan(0)
    expect(e.emoji.length).toBeGreaterThan(0)
  }
})
