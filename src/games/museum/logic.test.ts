import { expect, test } from 'vitest'
import { CUE, EXHIBITS, GOAL, errorType, exhibitMeta, makeRound, pointsFor, slotPosition, starsFor } from './logic'

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

test('cue fades with difficulty: highlighted point -> plain point -> distal point', () => {
  expect(CUE.easy).toBe('pulse')
  expect(CUE.medium).toBe('hover')
  expect(CUE.hard).toBe('distal')
})

test('goal rises with difficulty', () => {
  expect(GOAL.easy).toBeLessThan(GOAL.medium)
  expect(GOAL.medium).toBeLessThan(GOAL.hard)
})

test('first-attempt finds outscore corrected ones; retries still earn points', () => {
  expect(pointsFor(true, 1)).toBe(10)
  expect(pointsFor(false, 0)).toBe(5)
  expect(pointsFor(false, 0)).toBeGreaterThan(0)
})

test('streak bonus kicks in after 3 consecutive first-attempt finds', () => {
  expect(pointsFor(true, 2)).toBe(10)
  expect(pointsFor(true, 3)).toBe(12)
  expect(pointsFor(true, 5)).toBe(12)
})

test('stars reflect lives kept; an unfinished session still earns one', () => {
  expect(starsFor(true, 3)).toBe(3)
  expect(starsFor(true, 2)).toBe(2)
  expect(starsFor(true, 1)).toBe(1)
  expect(starsFor(false, 0)).toBe(1)
})

test('errorType splits near-misses from picks far from the point', () => {
  const visible = ['gem', 'dino', 'rocket', 'vase'] as const
  expect(errorType([...visible], 'dino', 'gem')).toBe('adjacent')
  expect(errorType([...visible], 'dino', 'rocket')).toBe('adjacent')
  expect(errorType([...visible], 'gem', 'rocket')).toBe('far')
  expect(errorType([...visible], 'gem', 'vase')).toBe('far')
})
