import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../../types'
import {
  ACTIVITY_COUNT,
  allPerformances,
  BEHAVIORS,
  buildLevel,
  CARD_SPREAD_DEG,
  cardBearingDeg,
  cardPosition,
  CHANCE,
  FRONT_ARC_DEG,
  isDragTail,
  lookDrag,
  performanceFor,
  pointsFor,
  STAGE_BEARINGS_DEG,
  stageBearings,
  stagePosition,
  stagingFor,
  starsFor,
  type Performance,
} from './logic'

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

const ALL_PERFORMANCES: Performance[] = [
  'greet', 'politeTalk', 'shout', 'offer', 'grab', 'hold', 'holdTurn',
  'turnAway', 'walkPast', 'gentleTap', 'crowd', 'leanOver', 'queueWait',
  'queueCut', 'queueHog', 'usherFirst', 'pushThrough', 'apologize', 'bumpWalkOff',
]

describe('performanceFor — every behaviour is acted out', () => {
  it('maps all 80 banked behaviours to a known performance', () => {
    const map = allPerformances()
    expect(map.size).toBe(BEHAVIORS.length)
    for (const [id, perf] of map) {
      expect(ALL_PERFORMANCES, `behaviour "${id}"`).toContain(perf)
    }
  })

  it('stages the story of the sentence, not just the generic cue', () => {
    const byId = Object.fromEntries(BEHAVIORS.map((b) => [b.id, b]))
    // "walks right past his friend … says nothing" actually walks
    expect(performanceFor(byId.walkpast)).toBe('walkPast')
    // "grabs a toy right out of someone's hands" lunges and yanks
    expect(performanceFor(byId.grab)).toBe('grab')
    // "pushes the other children to get to the front" runs to the front
    expect(performanceFor(byId.push)).toBe('queueCut')
    // "taps her friend gently on the shoulder" taps, not waves
    expect(performanceFor(byId.tap)).toBe('gentleTap')
    // "leans right over Meera's drawing" looms over the crouched friend
    expect(performanceFor(byId.leanover)).toBe('leanOver')
    // "lets a smaller boy take his turn before her" waves the friend ahead
    expect(performanceFor(byId.letsmall)).toBe('usherFirst')
    // bump + sorry vs bump + walking off are visually different outcomes
    expect(performanceFor(byId.sorry)).toBe('apologize')
    expect(performanceFor(byId.nosorry)).toBe('bumpWalkOff')
    // squeezing through the line pops the bump between the queued kids
    expect(performanceFor(byId.squeeze)).toBe('pushThrough')
    // clutching the toy while turned away reads as ignoring the request
    expect(performanceFor(byId.nothear)).toBe('holdTurn')
    // staying on the swing while others wait hogs the front of the queue
    expect(performanceFor(byId.onemore)).toBe('queueHog')
  })

  it('keeps the subtle-okay vs subtle-not-okay pairs visually distinct', () => {
    const byId = Object.fromEntries(BEHAVIORS.map((b) => [b.id, b]))
    // polite hold ("after my turn") carries the kind-words heart; the silent
    // keep-it-all hold does not — the child can SEE the difference
    expect(stagingFor(byId.afterturn).heart).toBe(true)
    expect(stagingFor(byId.twoboxes).heart).toBe(false)
    expect(performanceFor(byId.afterturn)).toBe(performanceFor(byId.twoboxes))
  })

  it('shows the behaviour bubble emoji so the specific object is visible', () => {
    for (const b of BEHAVIORS) {
      expect(stagingFor(b).bubble).toBe(b.bubble)
    }
  })
})

describe('level building (reused from the flat game)', () => {
  it('keeps 10 trials with a 5/5 okay balance at every difficulty', () => {
    for (const d of DIFFS) {
      const rng = seededRng(7 + d.length)
      const level = buildLevel(d, rng)
      expect(level).toHaveLength(ACTIVITY_COUNT)
      expect(level.filter((b) => b.isFine)).toHaveLength(5)
    }
  })

  it('keeps chance at 1/2 (the two-thumb response set)', () => {
    expect(CHANCE).toBe(1 / 2)
  })
})

describe('stage placement', () => {
  it('keeps every stage bearing inside the front arc — never behind the child', () => {
    for (const deg of STAGE_BEARINGS_DEG) {
      expect(Math.abs(deg)).toBeLessThanOrEqual(FRONT_ARC_DEG)
    }
  })

  it('deals one bearing per trial, sweeping the arc in cycles', () => {
    const rng = seededRng(42)
    const bearings = stageBearings(10, rng)
    expect(bearings).toHaveLength(10)
    // each full cycle uses every spot once
    expect([...bearings.slice(0, 5)].sort((a, b) => a - b)).toEqual(
      [...STAGE_BEARINGS_DEG].sort((a, b) => a - b),
    )
    // never the same spot twice in a row (including across the cycle seam)
    for (let i = 1; i < bearings.length; i++) {
      expect(bearings[i]).not.toBe(bearings[i - 1])
    }
  })

  it('places the stage on the arc at the requested bearing', () => {
    const [x0, z0] = stagePosition(0)
    expect(x0).toBeCloseTo(0)
    expect(z0).toBeLessThan(0) // straight ahead is -z
    const [xr] = stagePosition(50)
    expect(xr).toBeGreaterThan(0) // positive bearing is to the right
  })

  it('hangs the two judgment cards either side of the stage bearing', () => {
    for (const stageDeg of STAGE_BEARINGS_DEG) {
      expect(cardBearingDeg(0, stageDeg)).toBe(stageDeg - CARD_SPREAD_DEG)
      expect(cardBearingDeg(1, stageDeg)).toBe(stageDeg + CARD_SPREAD_DEG)
      const [xl] = cardPosition(0, stageDeg)
      const [xr] = cardPosition(1, stageDeg)
      expect(xl).toBeLessThan(xr)
    }
  })
})

describe('scoring & feedback', () => {
  it('awards points only for correct judgments', () => {
    expect(pointsFor(true)).toBeGreaterThan(0)
    expect(pointsFor(false)).toBe(0)
  })

  it('always gives at least one star for finishing', () => {
    expect(starsFor(0, 10)).toBe(1)
    expect(starsFor(5, 10)).toBe(2)
    expect(starsFor(8, 10)).toBe(3)
  })
})

describe('look-drag tap guard', () => {
  it('swallows taps that arrive right after a look-around drag', () => {
    lookDrag.px = 40
    lookDrag.endedAt = 1000
    expect(isDragTail(1200)).toBe(true)
    expect(isDragTail(2000)).toBe(false)
    lookDrag.px = 4
    expect(isDragTail(1200)).toBe(false)
  })
})
