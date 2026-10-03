import { describe, expect, it } from 'vitest'
import {
  CONFIG,
  DISCOVERIES,
  FRIEND_BEARING_DEG,
  FRIEND_SLOTS_DEG,
  FRIEND_SURPRISE_MIN_SEP_DEG,
  FRIENDS,
  FRONT_HALF_ARC_DEG,
  NO_SHARE_TIMEOUT_MS,
  POINTS,
  STREAK_LEN,
  buildFriendBearings,
  clearFriendBearing,
  discoveryBearingDeg,
  discoveryMeta,
  discoveryPosition,
  friendPosition,
  isDragTail,
  lookDrag,
  makeRound,
  pickFriend,
  pointsFor,
  spawnDelayMs,
  starsFor,
} from './logic'

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('park360 discoveries (identical game design to Look What I Found!)', () => {
  it('has 6 surprises with front-arc spots', () => {
    expect(DISCOVERIES).toHaveLength(6)
    for (const d of DISCOVERIES) {
      expect(discoveryMeta(d.id)).toBe(d)
    }
  })

  it('keeps every surprise inside the front half-circle — nothing behind the child', () => {
    for (const d of DISCOVERIES) {
      expect(Math.abs(d.bearingDeg)).toBeLessThanOrEqual(FRONT_HALF_ARC_DEG)
      // and in front means negative z in world space
      const [, z] = discoveryPosition(d.id)
      expect(z).toBeLessThan(0)
    }
  })

  it('keeps the friend inside the front half-circle too — every slot', () => {
    expect(Math.abs(FRIEND_BEARING_DEG)).toBeLessThanOrEqual(FRONT_HALF_ARC_DEG)
    for (const slot of FRIEND_SLOTS_DEG) {
      expect(Math.abs(slot)).toBeLessThanOrEqual(FRONT_HALF_ARC_DEG)
      const [, z] = friendPosition(slot)
      expect(z).toBeLessThan(0)
    }
  })

  it('reports the signed head-turn bearing per surprise', () => {
    for (const d of DISCOVERIES) {
      expect(discoveryBearingDeg(d.id)).toBe(d.bearingDeg)
    }
  })
})

describe('makeRound', () => {
  it('never repeats the previous surprise', () => {
    const rng = seededRng(7)
    let prev = makeRound(null, FRIEND_BEARING_DEG, rng).discovery
    for (let i = 0; i < 200; i++) {
      const next = makeRound(prev, FRIEND_BEARING_DEG, rng).discovery
      expect(next).not.toBe(prev)
      prev = next
    }
  })

  it('always returns a valid discovery id', () => {
    const rng = seededRng(3)
    const ids = DISCOVERIES.map((d) => d.id)
    for (let i = 0; i < 50; i++) {
      expect(ids).toContain(makeRound(null, FRIEND_BEARING_DEG, rng).discovery)
    }
  })

  it('keeps the friend clear of the round surprise (R2)', () => {
    const rng = seededRng(13)
    for (const slot of FRIEND_SLOTS_DEG) {
      for (let i = 0; i < 60; i++) {
        const r = makeRound(null, slot, rng)
        const gap = Math.abs(r.friendBearingDeg - discoveryBearingDeg(r.discovery))
        expect(gap).toBeGreaterThanOrEqual(FRIEND_SURPRISE_MIN_SEP_DEG)
        expect(FRIEND_SLOTS_DEG).toContain(r.friendBearingDeg)
      }
    }
  })
})

describe('friend position varies across a session (R2)', () => {
  it('deals a full session of bearings, all valid slots, no immediate repeat', () => {
    const rng = seededRng(21)
    const goal = CONFIG.hard.goal
    const bag = buildFriendBearings(goal, rng)
    expect(bag).toHaveLength(goal)
    for (let i = 0; i < bag.length; i++) {
      expect(FRIEND_SLOTS_DEG).toContain(bag[i])
      if (i > 0) expect(bag[i]).not.toBe(bag[i - 1])
    }
    // a session visibly sweeps more than one spot (not a fixed habitual turn)
    expect(new Set(bag).size).toBeGreaterThan(1)
  })

  it('sweeps both sides of centre over enough rounds', () => {
    const bag = buildFriendBearings(40, seededRng(2))
    expect(bag.some((b) => b < 0)).toBe(true)
    expect(bag.some((b) => b > 0)).toBe(true)
  })

  it('clearFriendBearing only moves a bearing that is too close', () => {
    // flower sits at -52; a -40 friend is only 12 deg away -> must move
    expect(clearFriendBearing(-40, -52)).not.toBe(-40)
    expect(Math.abs(clearFriendBearing(-40, -52) - -52)).toBeGreaterThanOrEqual(
      FRIEND_SURPRISE_MIN_SEP_DEG,
    )
    // a +40 friend is well clear of the same surprise -> unchanged
    expect(clearFriendBearing(40, -52)).toBe(40)
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
