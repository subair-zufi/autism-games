import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../../types'
import {
  CARD_STEP_DEG,
  CAUSE_RADIUS,
  CAUSE_STEP_DEG,
  SCREEN_DISTANCE,
  SCREEN_H,
  SCREEN_W,
  SCREEN_Y,
  buildQuiz,
  cardBearingDeg,
  cardPosition,
  causeBearingDeg,
  isDragTail,
  lookDrag,
  pointsFor,
  sessionLength,
  starsFor,
} from './logic'

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

describe('screen ergonomics', () => {
  it('keeps a comfortable big-screen viewing angle (~30–45° horizontal)', () => {
    const halfAngle = Math.atan(SCREEN_W / 2 / SCREEN_DISTANCE) // radians, half of horizontal FOV
    const fovDeg = (2 * halfAngle * 180) / Math.PI
    expect(fovDeg).toBeGreaterThan(30)
    expect(fovDeg).toBeLessThan(45)
  })

  it('sits the screen bottom above the floor and centre near eye level', () => {
    expect(SCREEN_Y - SCREEN_H / 2).toBeGreaterThan(0.3) // bottom clears the floor
    expect(SCREEN_Y).toBeGreaterThan(1.3) // centre roughly at a child's eye line
    expect(SCREEN_Y).toBeLessThan(1.9) // never craned upward
  })
})

describe('answer card layout', () => {
  it('centres the cards symmetrically on straight-ahead', () => {
    for (const n of [2, 3, 4]) {
      const bearings = Array.from({ length: n }, (_, i) => cardBearingDeg(i, n))
      const sum = bearings.reduce((a, b) => a + b, 0)
      expect(Math.abs(sum)).toBeLessThan(1e-9) // symmetric → sums to zero
      // evenly spaced by CARD_STEP_DEG
      for (let i = 1; i < n; i++) {
        expect(bearings[i] - bearings[i - 1]).toBeCloseTo(CARD_STEP_DEG)
      }
    }
  })

  it('places cards on the near console, in front of the child', () => {
    const [x, z] = cardPosition(0, 3)
    expect(z).toBeLessThan(0) // in front (toward -z)
    // leftmost of three is on the child's left
    expect(x).toBeLessThan(0)
  })
})

describe('cause ("why?") card layout — whole sentences, wider spacing', () => {
  it('centres the cause cards symmetrically on straight-ahead', () => {
    for (const n of [2, 3]) {
      const bearings = Array.from({ length: n }, (_, i) => causeBearingDeg(i, n))
      const sum = bearings.reduce((a, b) => a + b, 0)
      expect(Math.abs(sum)).toBeLessThan(1e-9)
      for (let i = 1; i < n; i++) {
        expect(bearings[i] - bearings[i - 1]).toBeCloseTo(CAUSE_STEP_DEG)
      }
    }
  })

  it('spaces the sentence cards far enough apart that they never overlap', () => {
    // the cause cards are 1.25 m wide (sentences); adjacent centres must sit
    // further apart than that on the arc, or they would collide (the bug)
    const CAUSE_CARD_WIDTH = 1.25
    const arcGap = CAUSE_RADIUS * ((CAUSE_STEP_DEG * Math.PI) / 180)
    expect(arcGap).toBeGreaterThan(CAUSE_CARD_WIDTH)
  })
})

describe('reused quiz (delegates to the flat Emotion Clips)', () => {
  it('builds a full session per difficulty', () => {
    for (const d of DIFFS) {
      const quiz = buildQuiz(d, seededRng(d.length + 2))
      expect(quiz.length).toBe(sessionLength(d))
      for (const question of quiz) {
        expect(question.choices).toContain(question.answer)
      }
    }
  })

  it('freezes hard clips early (partially-formed) and carries a cause', () => {
    const quiz = buildQuiz('hard', seededRng(5))
    for (const question of quiz) {
      expect(question.freezeKind).toBe('early')
      expect(question.cause).toBeTruthy()
    }
  })
})

describe('scoring', () => {
  it('pays a first try more than a corrected one, but never nothing', () => {
    // no-fail: a child who gets there after "let's look again" is still paid,
    // like every other 360 game. Only the ordering is load-bearing.
    expect(pointsFor(true)).toBeGreaterThan(pointsFor(false))
    expect(pointsFor(false)).toBeGreaterThan(0)
  })

  it('awards stars by first-try accuracy, always at least one', () => {
    expect(starsFor(12, 12)).toBe(3)
    expect(starsFor(6, 12)).toBe(2)
    expect(starsFor(0, 12)).toBe(1)
  })
})

describe('drag guard', () => {
  it('ignores a tap that is the tail of a look-around drag', () => {
    lookDrag.px = 20
    lookDrag.endedAt = 1000
    expect(isDragTail(1100)).toBe(true)
    expect(isDragTail(2000)).toBe(false)
  })
})
