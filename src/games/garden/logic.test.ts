import { expect, test } from 'vitest'
import { GARDEN_OBJECTS, makeRound, objectMeta } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('easy has 3 choices, medium and hard have 4', () => {
  expect(makeRound('easy', null, Math.random).choices).toHaveLength(3)
  expect(makeRound('medium', null, Math.random).choices).toHaveLength(4)
  expect(makeRound('hard', null, Math.random).choices).toHaveLength(4)
})

test('choices always include the target and are unique', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    for (let i = 0; i < 40; i++) {
      const r = makeRound(d, null, Math.random)
      expect(r.choices).toContain(r.target)
      expect(new Set(r.choices).size).toBe(r.choices.length)
    }
  }
})

test('easy choices never share a category', () => {
  for (let i = 0; i < 60; i++) {
    const r = makeRound('easy', null, Math.random)
    const cats = r.choices.map((c) => objectMeta(c).category)
    expect(new Set(cats).size).toBe(cats.length)
  }
})

test('hard rounds with a flower target include at least two flowers', () => {
  for (let i = 0; i < 60; i++) {
    const r = makeRound('hard', null, Math.random)
    if (objectMeta(r.target).category === 'flower') {
      const flowers = r.choices.filter((c) => objectMeta(c).category === 'flower')
      expect(flowers.length).toBeGreaterThanOrEqual(2)
    }
  }
})

test('target never repeats the previous round', () => {
  for (let i = 0; i < 40; i++) {
    expect(makeRound('medium', 'tree', Math.random).target).not.toBe('tree')
  }
})

test('deterministic with seeded rng', () => {
  const r = makeRound('easy', null, rng([0]))
  expect(r.choices).toContain(r.target)
})

test('all 8 objects have complete metadata', () => {
  expect(GARDEN_OBJECTS).toHaveLength(8)
  for (const o of GARDEN_OBJECTS) {
    expect(o.label.length).toBeGreaterThan(0)
    expect(o.emoji.length).toBeGreaterThan(0)
    expect(o.position).toHaveLength(2)
  }
})
