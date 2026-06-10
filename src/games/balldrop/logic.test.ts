import { expect, test } from 'vitest'
import { BOX_COLORS, boxesFor, pickTarget } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('boxesFor returns 3/4/5 unique colors', () => {
  expect(boxesFor('easy')).toHaveLength(3)
  expect(boxesFor('medium')).toHaveLength(4)
  expect(boxesFor('hard')).toHaveLength(5)
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const boxes = boxesFor(d)
    expect(new Set(boxes).size).toBe(boxes.length)
  }
})

test('pickTarget returns a color from the boxes', () => {
  const boxes = boxesFor('easy')
  for (let i = 0; i < 30; i++) {
    expect(boxes).toContain(pickTarget(boxes, null, Math.random))
  }
})

test('pickTarget never repeats the previous target', () => {
  const boxes = boxesFor('easy')
  for (let i = 0; i < 30; i++) {
    expect(pickTarget(boxes, 'red', Math.random)).not.toBe('red')
  }
})

test('pickTarget is deterministic with seeded rng', () => {
  expect(pickTarget(boxesFor('hard'), null, rng([0]))).toBe('red')
})

test('every color has label and hex', () => {
  expect(BOX_COLORS).toHaveLength(5)
  for (const c of BOX_COLORS) {
    expect(c.label.length).toBeGreaterThan(0)
    expect(c.hex).toMatch(/^#[0-9a-f]{6}$/)
  }
})
