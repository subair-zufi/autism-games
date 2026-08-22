import { expect, test } from 'vitest'
import {
  EXHIBITS,
  FADE_STREAK,
  GAZE_TRIALS,
  GOAL,
  HAND_LADDER,
  START_TIER,
  cueSchedule,
  errorType,
  exhibitMeta,
  fadedTier,
  makeRound,
  pointsFor,
  slotPosition,
  starsFor,
  supportedTier,
  trialCue,
} from './logic'

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
    expect(makeRound('medium', 'butterfly', Math.random).target).not.toBe('butterfly')
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
  expect(exhibitMeta('butterfly').label).toBe('Butterfly')
})

test('the hand ladder runs highlighted point -> plain point -> distal point', () => {
  expect(HAND_LADDER).toEqual(['pulse', 'hover', 'distal'])
})

test('difficulty sets the entry rung: pulse / hover / distal', () => {
  expect(HAND_LADDER[START_TIER.easy]).toBe('pulse')
  expect(HAND_LADDER[START_TIER.medium]).toBe('hover')
  expect(HAND_LADDER[START_TIER.hard]).toBe('distal')
})

test('fading thins the hand one rung at a time, capped at the distal point', () => {
  expect(fadedTier(START_TIER.easy)).toBe(1)
  expect(fadedTier(1)).toBe(2)
  expect(fadedTier(2)).toBe(2) // distal is the thinnest hand rung — no further fade
  expect(FADE_STREAK).toBeGreaterThan(1) // fading requires a run of successes
})

test('errors bring support back, but never below the entry rung', () => {
  expect(supportedTier(2, 'hard')).toBe(2) // hard never regains a closer point
  expect(supportedTier(2, 'easy')).toBe(1)
  expect(supportedTier(1, 'easy')).toBe(0)
  expect(supportedTier(0, 'easy')).toBe(0)
})

test('gaze trials are a steady, evenly-spread share of the session', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    const schedule = cueSchedule(d)
    expect(schedule).toHaveLength(GOAL[d])
    expect(schedule.filter((k) => k === 'gaze')).toHaveLength(GAZE_TRIALS[d])
    expect(schedule[0]).toBe('hand') // the session always opens on the supportive hand
  }
  // hard alternates hand/gaze so gaze is probed every other trial, not once
  expect(cueSchedule('hard')).toEqual([
    'hand', 'gaze', 'hand', 'gaze', 'hand', 'gaze', 'hand', 'gaze', 'hand', 'gaze',
  ])
})

test('a gaze trial falls back to the hand once the child has missed it', () => {
  expect(trialCue('gaze', 2, false)).toBe('gaze') // first try: gaze only
  expect(trialCue('gaze', 2, true)).toBe('distal') // after a miss: hand support returns
  expect(trialCue('hand', 0, false)).toBe('pulse') // hand trials follow the hand ladder
  expect(trialCue('hand', 1, true)).toBe('hover')
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

test('stars reward first-try finds; every finished session earns at least one', () => {
  expect(starsFor(5, 5)).toBe(3) // 100% first-try
  expect(starsFor(4, 5)).toBe(3) // 80%
  expect(starsFor(3, 5)).toBe(2) // 60%
  expect(starsFor(2, 5)).toBe(1) // 40%
  expect(starsFor(0, 5)).toBe(1) // never below one
})

test('errorType splits near-misses from picks far from the point', () => {
  const visible = ['butterfly', 'bird', 'doll', 'balloon'] as const
  expect(errorType([...visible], 'bird', 'butterfly')).toBe('adjacent')
  expect(errorType([...visible], 'bird', 'doll')).toBe('adjacent')
  expect(errorType([...visible], 'butterfly', 'doll')).toBe('far')
  expect(errorType([...visible], 'butterfly', 'balloon')).toBe('far')
})
