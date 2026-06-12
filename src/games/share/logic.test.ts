import { expect, test } from 'vitest'
import { CONFIG, FINDS, findMeta } from './logic'

test('goals grow and time shrinks with difficulty', () => {
  expect(CONFIG.easy.goal).toBeLessThan(CONFIG.hard.goal)
  expect(CONFIG.easy.seconds).toBeGreaterThan(CONFIG.hard.seconds)
})

test('there are enough finds for the hardest goal', () => {
  expect(FINDS.length).toBeGreaterThanOrEqual(CONFIG.hard.goal)
})

test('every find has complete metadata', () => {
  for (const f of FINDS) {
    expect(f.label.length).toBeGreaterThan(0)
    expect(f.emoji.length).toBeGreaterThan(0)
    expect(f.react.length).toBeGreaterThan(0)
    expect(f.position).toHaveLength(2)
  }
})

test('find ids are unique and positions do not overlap', () => {
  expect(new Set(FINDS.map((f) => f.id)).size).toBe(FINDS.length)
  for (const a of FINDS) {
    for (const b of FINDS) {
      if (a.id === b.id) continue
      const dx = a.position[0] - b.position[0]
      const dz = a.position[1] - b.position[1]
      expect(Math.hypot(dx, dz)).toBeGreaterThan(1)
    }
  }
})

test('findMeta looks up by id', () => {
  expect(findMeta('frog').label).toBe('Frog')
  expect(findMeta('rainbow').emoji).toBe('🌈')
})
