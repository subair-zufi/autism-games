import { expect, test } from 'vitest'
import { EXHIBITS, exhibitMeta, makeRound, slotPosition } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('easy shows 3 exhibits, medium 4, hard 6', () => {
  expect(makeRound('easy', null, Math.random).visible).toHaveLength(3)
  expect(makeRound('medium', null, Math.random).visible).toHaveLength(4)
  expect(makeRound('hard', null, Math.random).visible).toHaveLength(6)
})

test('visible always includes the target and has no duplicates', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    for (let i = 0; i < 40; i++) {
      const r = makeRound(d, null, Math.random)
      expect(r.visible).toContain(r.target)
      expect(new Set(r.visible).size).toBe(r.visible.length)
    }
  }
})

test('target never repeats the previous round', () => {
  for (let i = 0; i < 40; i++) {
    expect(makeRound('medium', 'rocket', Math.random).target).not.toBe('rocket')
  }
})

test('deterministic with seeded rng', () => {
  const a = makeRound('hard', null, rng([0.2, 0.7, 0.4, 0.9]))
  const b = makeRound('hard', null, rng([0.2, 0.7, 0.4, 0.9]))
  expect(a).toEqual(b)
})

test('slot positions are ordered left to right and symmetric', () => {
  const xs = [0, 1, 2, 3].map((i) => slotPosition(i, 4)[0])
  for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
  expect(slotPosition(0, 4)[0]).toBeCloseTo(-slotPosition(3, 4)[0])
})

test('all 6 exhibits have metadata', () => {
  expect(EXHIBITS).toHaveLength(6)
  for (const e of EXHIBITS) {
    expect(e.label.length).toBeGreaterThan(0)
    expect(e.emoji.length).toBeGreaterThan(0)
  }
  expect(exhibitMeta('gem').label).toBe('Gem')
})
