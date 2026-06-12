import { expect, test } from 'vitest'
import { nextScenario, rounds, SCENARIOS } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('round counts grow with difficulty', () => {
  expect(rounds('easy')).toBeLessThan(rounds('hard'))
  expect(rounds('easy')).toBeGreaterThan(0)
})

test('scenarios are a balanced mix of fine and needs-fixing', () => {
  const fine = SCENARIOS.filter((s) => s.isFine).length
  const fix = SCENARIOS.length - fine
  expect(fine).toBeGreaterThan(0)
  expect(fix).toBeGreaterThan(0)
})

test('every scenario has complete, non-empty content', () => {
  for (const s of SCENARIOS) {
    expect(s.text.length).toBeGreaterThan(0)
    expect(s.bubble.length).toBeGreaterThan(0)
    expect(s.explain.length).toBeGreaterThan(0)
    expect(typeof s.isFine).toBe('boolean')
  }
})

test('scenario ids are unique', () => {
  expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length)
})

test('nextScenario never repeats the previous one', () => {
  for (let i = 0; i < 50; i++) {
    expect(nextScenario('wave', Math.random).id).not.toBe('wave')
  }
})

test('nextScenario is deterministic with a seeded rng', () => {
  expect(nextScenario(null, rng([0])).id).toBe(nextScenario(null, rng([0])).id)
})
