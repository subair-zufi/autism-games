import { expect, test } from 'vitest'
import {
  EXHIBITS,
  FADE_STREAK,
  GAZE_TRIALS,
  GOAL,
  HAND_LADDER,
  START_TIER,
  bearingToXZ,
  cueSchedule,
  errorType,
  exhibitMeta,
  fadedTier,
  makeRound,
  pointsFor,
  slotBearing,
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
    expect(makeRound('medium', 'rocket', Math.random).target).not.toBe('rocket')
  }
})

test('deterministic with seeded rng', () => {
  const a = makeRound('hard', null, rng([0.2, 0.7, 0.4, 0.9]))
  const b = makeRound('hard', null, rng([0.2, 0.7, 0.4, 0.9]))
  expect(a).toEqual(b)
})

test('bearings run clockwise, symmetric around the point behind the child', () => {
  for (const n of [3, 4, 6]) {
    const bearings = Array.from({ length: n }, (_, i) => slotBearing(i, n))
    for (let i = 1; i < bearings.length; i++) expect(bearings[i]).toBeGreaterThan(bearings[i - 1])
    // symmetric: first and last pedestals sit at mirrored bearings
    expect(bearings[0] + bearings[n - 1]).toBeCloseTo(Math.PI * 2)
  }
})

test('a gap is kept around the helper (bearing 0) so no pedestal hides behind them', () => {
  for (const n of [3, 4, 6]) {
    for (let i = 0; i < n; i++) {
      const b = slotBearing(i, n)
      expect(b).toBeGreaterThan(Math.PI / 4)
      expect(b).toBeLessThan(Math.PI * 2 - Math.PI / 4)
    }
  }
})

test('on hard, some pedestals sit behind the child — the view must turn', () => {
  const behind = Array.from({ length: 6 }, (_, i) => slotBearing(i, 6)).filter(
    (b) => b > Math.PI / 2 && b < (3 * Math.PI) / 2,
  )
  expect(behind.length).toBeGreaterThanOrEqual(2)
})

test('bearingToXZ maps bearing 0 to straight ahead (-z) and π to behind (+z)', () => {
  const [x0, z0] = bearingToXZ(0, 5)
  expect(x0).toBeCloseTo(0)
  expect(z0).toBeCloseTo(-5)
  const [xPi, zPi] = bearingToXZ(Math.PI, 5)
  expect(xPi).toBeCloseTo(0)
  expect(zPi).toBeCloseTo(5)
})

test('all 6 exhibits have metadata', () => {
  expect(EXHIBITS).toHaveLength(6)
  for (const e of EXHIBITS) {
    expect(e.label.length).toBeGreaterThan(0)
    expect(e.emoji.length).toBeGreaterThan(0)
  }
  expect(exhibitMeta('gem').label).toBe('Gem')
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

test('errorType splits near-misses from picks far around the room', () => {
  const visible = ['gem', 'dino', 'rocket', 'vase'] as const
  expect(errorType([...visible], 'dino', 'gem')).toBe('adjacent')
  expect(errorType([...visible], 'dino', 'rocket')).toBe('adjacent')
  expect(errorType([...visible], 'gem', 'rocket')).toBe('far')
  expect(errorType([...visible], 'gem', 'vase')).toBe('far')
})
