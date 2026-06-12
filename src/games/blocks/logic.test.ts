import { expect, test } from 'vitest'
import { BLOCK_COLORS, BLOCK_H, blockY, CONFIG, makeSequence } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('config rounds grow and waiting gets longer with difficulty', () => {
  expect(CONFIG.easy.rounds).toBeLessThan(CONFIG.hard.rounds)
  expect(CONFIG.easy.robotTurnMs).toBeLessThan(CONFIG.hard.robotTurnMs)
})

test('sequence has two blocks per round and alternates robot-first', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const seq = makeSequence(CONFIG[d].rounds, Math.random)
    expect(seq).toHaveLength(CONFIG[d].rounds * 2)
    seq.forEach((b, i) => {
      expect(b.owner).toBe(i % 2 === 0 ? 'robot' : 'child')
      expect(BLOCK_COLORS).toContain(b.color)
    })
  }
})

test('child places exactly one block per round', () => {
  const seq = makeSequence(5, Math.random)
  expect(seq.filter((b) => b.owner === 'child')).toHaveLength(5)
  expect(seq.filter((b) => b.owner === 'robot')).toHaveLength(5)
})

test('deterministic with seeded rng', () => {
  const a = makeSequence(4, rng([0.1, 0.5, 0.9]))
  const b = makeSequence(4, rng([0.1, 0.5, 0.9]))
  expect(a).toEqual(b)
})

test('blocks stack without overlap', () => {
  expect(blockY(0)).toBeCloseTo(BLOCK_H / 2)
  expect(blockY(1) - blockY(0)).toBeCloseTo(BLOCK_H)
  expect(blockY(3)).toBeGreaterThan(blockY(2))
})
