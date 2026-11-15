import { describe, expect, it } from 'vitest'
import {
  CONFIG,
  DISCOVERIES,
  FRIEND_BEARING_DEG,
  FRIENDS,
  FRONT_HALF_ARC_DEG,
  NO_SHARE_TIMEOUT_MS,
  POINTS,
  STREAK_LEN,
  FRIEND_HALF_DEG,
  MAX_SURPRISE_HALF_DEG,
  SPOTS,
  friendPosition,
  isDragTail,
  lookDrag,
  makeRound,
  pickFriend,
  pointsFor,
  spawnDelayMs,
  spotBearingDeg,
  spotPosition,
  spotRadius,
  starsFor,
} from './logic'

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('park360 surprises and the spots they appear in', () => {
  it('offers ten surprises, every one a living thing a child knows', () => {
    expect(DISCOVERIES).toHaveLength(10)
    expect(new Set(DISCOVERIES).size).toBe(10)
  })

  it('keeps every spot inside the front half-circle — nothing behind the child', () => {
    SPOTS.forEach((spot, i) => {
      expect(Math.abs(spot.bearingDeg)).toBeLessThanOrEqual(FRONT_HALF_ARC_DEG)
      // and in front means negative z in world space
      const [, z] = spotPosition(i)
      expect(z).toBeLessThan(0)
      expect(spotBearingDeg(i)).toBe(spot.bearingDeg)
      expect(spotRadius(i)).toBe(spot.radius)
    })
  })

  it('uses the whole arc the friend leaves free, evenly', () => {
    // The old set clustered: five of six surprises sat at negative bearings,
    // and the child always turned left to find and right to share — one drilled
    // motor pattern rather than a varied search. What matters is not a
    // left/right count, though: the friend owns the right-hand side of the arc
    // and a surprise cannot share it without overlapping them (see SPOTS). The
    // property worth holding is that the spots spread EVENLY across everything
    // that is usable, so no part of the search space is over- or under-sampled.
    const bearings = SPOTS.map((s) => s.bearingDeg).sort((a, b) => a - b)
    expect(bearings[0]).toBeLessThanOrEqual(-45) // reaches the left edge
    expect(bearings[bearings.length - 1]).toBeGreaterThanOrEqual(12) // and as far right as it may
    const gaps = bearings.slice(1).map((b, i) => b - bearings[i])
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(2)
  })

  it('never puts a surprise where it would overlap the friend on screen', () => {
    // Not a rule-of-thumb gap: the real criterion is the two half-widths. The
    // friend's widest part is their floating NAME PLATE (1.1m), not their body,
    // and a big-saliency surprise at the nearest spot is wider still. A flat
    // 10deg rule passed a spot at +25deg where the easy butterfly sat squarely
    // across the name tag — ambiguous with the very person the child has to
    // turn and show it to.
    const needed = MAX_SURPRISE_HALF_DEG + FRIEND_HALF_DEG
    for (const spot of SPOTS) {
      expect(Math.abs(spot.bearingDeg - FRIEND_BEARING_DEG)).toBeGreaterThan(needed)
    }
  })

  it('spaces the spots far enough apart to be distinct places', () => {
    const sorted = [...SPOTS].map((s) => s.bearingDeg).sort((a, b) => a - b)
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(8)
    }
  })

  it('keeps the friend inside the front half-circle too', () => {
    expect(Math.abs(FRIEND_BEARING_DEG)).toBeLessThanOrEqual(FRONT_HALF_ARC_DEG)
    const [, z] = friendPosition()
    expect(z).toBeLessThan(0)
  })
})

describe('makeRound', () => {
  it('never repeats the previous surprise', () => {
    const rng = seededRng(7)
    let prev = makeRound(null, rng)
    for (let i = 0; i < 200; i++) {
      const next = makeRound(prev, rng)
      expect(next.discovery).not.toBe(prev.discovery)
      prev = next
    }
  })

  it('never repeats the previous spot either', () => {
    const rng = seededRng(11)
    let prev = makeRound(null, rng)
    for (let i = 0; i < 200; i++) {
      const next = makeRound(prev, rng)
      expect(next.spot).not.toBe(prev.spot)
      prev = next
    }
  })

  it('always returns a valid surprise and a valid spot', () => {
    const rng = seededRng(3)
    for (let i = 0; i < 100; i++) {
      const r = makeRound(null, rng)
      expect(DISCOVERIES).toContain(r.discovery)
      expect(r.spot).toBeGreaterThanOrEqual(0)
      expect(r.spot).toBeLessThan(SPOTS.length)
    }
  })

  it('draws WHAT appears independently of WHERE, so neither predicts the other', () => {
    // the whole point of splitting them: when a surprise owned a bearing, a
    // child who learned "bunny means 18 degrees left" stopped searching and
    // started recalling, and the game stopped measuring attention-getting
    const rng = seededRng(29)
    const seen = new Map<string, Set<number>>()
    for (let i = 0; i < 600; i++) {
      const r = makeRound(null, rng)
      if (!seen.has(r.discovery)) seen.set(r.discovery, new Set())
      seen.get(r.discovery)!.add(r.spot)
    }
    // every surprise should turn up in most of the nine spots
    for (const [, spots] of seen) expect(spots.size).toBeGreaterThanOrEqual(7)
  })
})

describe('scaffold fading by difficulty (same CONFIG as the flat-screen game)', () => {
  it('fades saliency: big -> medium -> subtle', () => {
    expect(CONFIG.easy.saliency).toBe('big')
    expect(CONFIG.medium.saliency).toBe('medium')
    expect(CONFIG.hard.saliency).toBe('subtle')
  })

  it('slows then removes the nudge — hard must be fully spontaneous', () => {
    expect(CONFIG.easy.nudgeAfterMs).not.toBeNull()
    expect(CONFIG.medium.nudgeAfterMs).not.toBeNull()
    expect(CONFIG.easy.nudgeAfterMs!).toBeLessThan(CONFIG.medium.nudgeAfterMs!)
    expect(CONFIG.hard.nudgeAfterMs).toBeNull()
  })

  it('turns the friend further away as difficulty rises', () => {
    expect(CONFIG.easy.awayYaw).toBeLessThan(CONFIG.medium.awayYaw)
    expect(CONFIG.medium.awayYaw).toBeLessThan(CONFIG.hard.awayYaw)
  })

  it('defines a sane no_share timeout for hard (no-nudge) rounds (review §3.6)', () => {
    // hard is the only tier with no nudge path, so it's the only tier where a
    // non-initiating child produces zero telemetry without this timeout
    expect(CONFIG.hard.nudgeAfterMs).toBeNull()
    expect(NO_SHARE_TIMEOUT_MS).toBeGreaterThan(0)
    // generous enough that it never fires before a nudge would on easy/medium
    expect(NO_SHARE_TIMEOUT_MS).toBeGreaterThan(CONFIG.medium.nudgeAfterMs!)
  })

  it('raises the session goal with difficulty', () => {
    expect(CONFIG.easy.goal).toBeLessThan(CONFIG.medium.goal)
    expect(CONFIG.medium.goal).toBeLessThan(CONFIG.hard.goal)
  })
})

describe('pointsFor', () => {
  it('rewards spontaneous shares more than prompted ones, never zero', () => {
    expect(pointsFor(true, 1)).toBe(POINTS.spontaneous)
    expect(pointsFor(false, 0)).toBe(POINTS.prompted)
    expect(pointsFor(false, 0)).toBeGreaterThan(0)
  })

  it('adds the streak bonus only at the streak threshold', () => {
    expect(pointsFor(true, STREAK_LEN - 1)).toBe(POINTS.spontaneous)
    expect(pointsFor(true, STREAK_LEN)).toBe(POINTS.spontaneous + POINTS.streakBonus)
  })
})

describe('starsFor', () => {
  it('gives 3 stars at >=80% spontaneous, 2 at >=50%, else 1', () => {
    expect(starsFor(5, 5)).toBe(3)
    expect(starsFor(4, 5)).toBe(3)
    expect(starsFor(3, 5)).toBe(2)
    expect(starsFor(2, 5)).toBe(1)
    expect(starsFor(0, 5)).toBe(1)
  })
})

describe('session helpers', () => {
  it('spawn delay stays in a calm 0.9-2.5s window', () => {
    const rng = seededRng(11)
    for (let i = 0; i < 100; i++) {
      const ms = spawnDelayMs(rng)
      expect(ms).toBeGreaterThanOrEqual(900)
      expect(ms).toBeLessThanOrEqual(2500)
    }
  })

  it('picks a valid friend', () => {
    const rng = seededRng(5)
    for (let i = 0; i < 20; i++) {
      expect(FRIENDS).toContain(pickFriend(rng))
    }
  })
})

describe('isDragTail (look-around drags must not count as taps)', () => {
  it('ignores clicks right after a real drag, allows clean taps', () => {
    lookDrag.px = 40
    lookDrag.endedAt = 1000
    expect(isDragTail(1100)).toBe(true)
    expect(isDragTail(1800)).toBe(false)
    lookDrag.px = 3
    lookDrag.endedAt = 1000
    expect(isDragTail(1100)).toBe(false)
  })
})
