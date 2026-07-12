import { describe, expect, it } from 'vitest'
import {
  CUE_LADDER,
  FADE_STREAK,
  GARDEN_OBJECTS,
  GOAL,
  POINTS,
  START_TIER,
  STREAK_LEN,
  errorType,
  fadedTier,
  makeRound,
  objectMeta,
  pointsFor,
  starsFor,
  supportedTier,
} from './logic'

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('garden objects', () => {
  it('has 8 objects with labels, categories and positions', () => {
    expect(GARDEN_OBJECTS).toHaveLength(8)
    for (const o of GARDEN_OBJECTS) {
      expect(o.label.length).toBeGreaterThan(0)
      expect(o.category.length).toBeGreaterThan(0)
      expect(o.position).toHaveLength(2)
    }
  })

  it('groups the three flowers into one category', () => {
    const flowers = GARDEN_OBJECTS.filter((o) => o.category === 'flower')
    expect(flowers.map((f) => f.id).sort()).toEqual(['flower-purple', 'flower-red', 'flower-yellow'])
  })
})

describe('makeRound', () => {
  it('never repeats the previous target', () => {
    const rng = seededRng(7)
    let prev = makeRound(null, rng).target
    for (let i = 0; i < 200; i++) {
      const next = makeRound(prev, rng).target
      expect(next).not.toBe(prev)
      prev = next
    }
  })

  it('always returns a valid object id', () => {
    const rng = seededRng(3)
    const ids = GARDEN_OBJECTS.map((o) => o.id)
    for (let i = 0; i < 50; i++) {
      expect(ids).toContain(makeRound(null, rng).target)
    }
  })
})

describe('cue fading within a session', () => {
  it('runs the ladder highlighted point -> plain point -> distal point -> gaze', () => {
    expect(CUE_LADDER).toEqual(['pulse', 'hover', 'distal', 'gaze'])
  })

  it('difficulty sets the entry rung: pulse / hover / distal', () => {
    expect(CUE_LADDER[START_TIER.easy]).toBe('pulse')
    expect(CUE_LADDER[START_TIER.medium]).toBe('hover')
    expect(CUE_LADDER[START_TIER.hard]).toBe('distal')
  })

  it('success thins the prompt one rung at a time, capped at gaze', () => {
    expect(fadedTier(0)).toBe(1)
    expect(fadedTier(2)).toBe(3)
    expect(fadedTier(3)).toBe(3)
    expect(FADE_STREAK).toBeGreaterThan(1)
  })

  it('errors bring support back, never below the entry rung', () => {
    expect(supportedTier(3, 'medium')).toBe(2)
    expect(supportedTier(1, 'medium')).toBe(1)
    expect(supportedTier(1, 'easy')).toBe(0)
  })

  it('needs more finds on higher levels', () => {
    expect(GOAL.easy).toBeLessThan(GOAL.medium)
    expect(GOAL.medium).toBeLessThan(GOAL.hard)
  })
})

describe('scoring', () => {
  it('rewards first-attempt responses more than corrected ones', () => {
    expect(pointsFor(true, 1)).toBe(POINTS.first)
    expect(pointsFor(false, 0)).toBe(POINTS.retry)
    expect(POINTS.first).toBeGreaterThan(POINTS.retry)
  })

  it('adds the streak bonus only from the streak threshold onwards', () => {
    expect(pointsFor(true, STREAK_LEN - 1)).toBe(POINTS.first)
    expect(pointsFor(true, STREAK_LEN)).toBe(POINTS.first + POINTS.streakBonus)
    expect(pointsFor(true, STREAK_LEN + 2)).toBe(POINTS.first + POINTS.streakBonus)
  })

  it('never awards the streak bonus on a corrected response', () => {
    expect(pointsFor(false, STREAK_LEN)).toBe(POINTS.retry)
  })

  it('gives stars by first-try finds, never below one', () => {
    expect(starsFor(5, 5)).toBe(3) // 100% first-try
    expect(starsFor(4, 5)).toBe(3) // 80%
    expect(starsFor(3, 5)).toBe(2) // 60%
    expect(starsFor(2, 5)).toBe(1) // 40%
    expect(starsFor(0, 5)).toBe(1) // never below one
  })
})

describe('error classification', () => {
  it('flags wrong picks within the same category as discrimination slips', () => {
    expect(errorType('flower-red', 'flower-yellow')).toBe('same-category')
  })

  it('flags cross-category picks as cue-following errors', () => {
    expect(errorType('flower-red', 'bee')).toBe('different-category')
    expect(errorType('tree', 'mushroom')).toBe('different-category')
  })

  it('objectMeta resolves every id', () => {
    for (const o of GARDEN_OBJECTS) {
      expect(objectMeta(o.id).id).toBe(o.id)
    }
  })
})
