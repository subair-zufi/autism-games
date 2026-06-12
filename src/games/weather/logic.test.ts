import { expect, test } from 'vitest'
import { nextSituation, rounds, SITUATIONS, ZONES, zoneMeta, zonePosition } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('round counts grow with difficulty', () => {
  expect(rounds('easy')).toBeLessThan(rounds('hard'))
  expect(rounds('easy')).toBeGreaterThan(0)
})

test('all four weather zones have complete metadata', () => {
  expect(ZONES).toHaveLength(4)
  for (const z of ZONES) {
    expect(z.label.length).toBeGreaterThan(0)
    expect(z.feeling.length).toBeGreaterThan(0)
    expect(z.emoji.length).toBeGreaterThan(0)
  }
  expect(zoneMeta('sunny').feeling).toBe('Happy')
})

test('every situation maps to a real zone and has content', () => {
  const zoneIds = ZONES.map((z) => z.id)
  for (const s of SITUATIONS) {
    expect(zoneIds).toContain(s.weather)
    expect(s.text.length).toBeGreaterThan(0)
    expect(s.emoji.length).toBeGreaterThan(0)
  }
})

test('every zone has at least one situation', () => {
  for (const z of ZONES) {
    expect(SITUATIONS.some((s) => s.weather === z.id)).toBe(true)
  }
})

test('situation ids are unique', () => {
  expect(new Set(SITUATIONS.map((s) => s.id)).size).toBe(SITUATIONS.length)
})

test('easy sessions only use easy-tier situations', () => {
  for (let i = 0; i < 60; i++) {
    expect(nextSituation('easy', null, Math.random).tier).toBe('easy')
  }
})

test('nextSituation never repeats the previous one', () => {
  for (let i = 0; i < 50; i++) {
    expect(nextSituation('hard', 'gift', Math.random).id).not.toBe('gift')
  }
})

test('deterministic with a seeded rng', () => {
  expect(nextSituation('medium', null, rng([0.4])).id).toBe(nextSituation('medium', null, rng([0.4])).id)
})

test('zone positions are ordered left to right and symmetric', () => {
  const xs = [0, 1, 2, 3].map((i) => zonePosition(i)[0])
  for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1])
  expect(xs[0]).toBeCloseTo(-xs[3])
})
