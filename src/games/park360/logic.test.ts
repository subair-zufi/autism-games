import { describe, expect, it } from 'vitest'
import {
  BUSH_PLACEMENTS,
  CONFIG,
  DISCOVERIES,
  FENCE_RADIUS,
  FRIEND_CLEARANCE_DEG,
  FRIEND_SPOTS,
  FRIENDS,
  FRONT_HALF_ARC_DEG,
  isDragTail,
  lookDrag,
  makeRound,
  MIN_FRIEND_SPREAD_DEG,
  NO_SHARE_TIMEOUT_MS,
  pickFriend,
  pickFriendSpot,
  placeOnLawn,
  POINTS,
  pointsFor,
  rememberedFriendSpot,
  rememberFriendSpot,
  SCENERY_FRONT_CLEAR_DEG,
  spawnDelayMs,
  SPOT_COUNT,
  spotsFor,
  starsFor,
  STREAK_LEN,
  TREE_PLACEMENTS,
} from './logic'

/** shortest signed angle from straight ahead, in degrees */
function angleFromFront(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('park360 surprises, and the spots they appear in', () => {
  it('offers ten surprises, every one a living thing a child knows', () => {
    expect(DISCOVERIES).toHaveLength(10)
    expect(new Set(DISCOVERIES).size).toBe(10)
  })

  // whichever side the friend takes, the same properties have to hold
  const everyFriendSpot = Object.values(FRIEND_SPOTS).flat()

  it('keeps every spot inside the front half-circle — nothing behind the child', () => {
    for (const f of everyFriendSpot) {
      for (const spot of spotsFor(f.bearingDeg)) {
        expect(Math.abs(spot.bearingDeg)).toBeLessThanOrEqual(FRONT_HALF_ARC_DEG)
        // and in front means negative z in world space
        const [, z] = placeOnLawn(spot)
        expect(z).toBeLessThan(0)
      }
    }
  })

  it('never puts a surprise where it would overlap the friend on screen', () => {
    // Not a rule-of-thumb gap: the real criterion is the two half-widths. The
    // friend's widest part is their floating NAME PLATE (1.1m), not their body,
    // and a big-saliency surprise is wider still. An earlier flat 10deg rule
    // passed a spot where the easy butterfly sat across the name tag —
    // ambiguous with the very person the child has to turn and show it to.
    for (const f of everyFriendSpot) {
      for (const spot of spotsFor(f.bearingDeg)) {
        expect(Math.abs(spot.bearingDeg - f.bearingDeg)).toBeGreaterThanOrEqual(FRIEND_CLEARANCE_DEG)
      }
    }
  })

  it('spreads the spots evenly across whatever the friend leaves free', () => {
    // no part of the child's search space over- or under-sampled
    for (const f of everyFriendSpot) {
      const bearings = spotsFor(f.bearingDeg).map((s) => s.bearingDeg)
      const gaps = bearings.slice(1).map((b, i) => b - bearings[i])
      expect(Math.min(...gaps)).toBeGreaterThan(0)
      expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThanOrEqual(2)
    }
  })

  it('moves the search area to the side the friend is NOT on', () => {
    // the whole point: with one fixed friend the spots stayed bunched left
    // forever, so the child turned left to find and right to share every single
    // round of every session
    const leftFriend = spotsFor(-36).map((s) => s.bearingDeg)
    const rightFriend = spotsFor(38).map((s) => s.bearingDeg)
    expect(leftFriend.filter((b) => b > 0).length).toBeGreaterThan(leftFriend.length / 2)
    expect(rightFriend.filter((b) => b < 0).length).toBeGreaterThan(rightFriend.length / 2)
  })

  it('keeps the friend inside the front half-circle too', () => {
    for (const f of everyFriendSpot) {
      expect(Math.abs(f.bearingDeg)).toBeLessThanOrEqual(FRONT_HALF_ARC_DEG)
      const [, z] = placeOnLawn(f)
      expect(z).toBeLessThan(0)
    }
  })
})

describe('where the friend kneels, by level', () => {
  it('puts the friend on the LEFT for every easy session', () => {
    expect(FRIEND_SPOTS.easy.every((f) => f.bearingDeg < 0)).toBe(true)
  })

  it('mirrors them to the RIGHT on medium, so the direction cannot carry over', () => {
    expect(FRIEND_SPOTS.medium.every((f) => f.bearingDeg > 0)).toBe(true)
  })

  it('uses BOTH sides on hard, so the child has to find their friend', () => {
    const sides = new Set(FRIEND_SPOTS.hard.map((f) => Math.sign(f.bearingDeg)))
    expect(sides.size).toBe(2)
  })

  it('moves the friend FAR enough between sessions to be noticed', () => {
    // The first attempt gave each level two spots 7deg apart. The code did
    // exactly what it claimed — easy drew left, medium drew right — but 7deg at
    // four metres is about a shoulder's width, so from inside the headset the
    // friend was in the same place every session and the variation may as well
    // not have existed. Distinctness on paper is not the property worth
    // holding; being somewhere visibly else is.
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const spots = FRIEND_SPOTS[level]
      expect(spots.length).toBeGreaterThanOrEqual(3)
      const sorted = [...spots].map((f) => f.bearingDeg).sort((a, b) => a - b)
      const sameSideGaps = sorted
        .slice(1)
        .map((b, i) => ({ gap: b - sorted[i], crossesMiddle: Math.sign(b) !== Math.sign(sorted[i]) }))
        .filter((g) => !g.crossesMiddle)
        .map((g) => g.gap)
      for (const gap of sameSideGaps) expect(gap).toBeGreaterThanOrEqual(MIN_FRIEND_SPREAD_DEG)
    }
  })

  it('draws a spot belonging to the level it was asked for', () => {
    const rng = seededRng(13)
    for (const level of ['easy', 'medium', 'hard'] as const) {
      let last: ReturnType<typeof pickFriendSpot> | null = null
      for (let i = 0; i < 40; i++) {
        last = pickFriendSpot(level, last, rng)
        expect(FRIEND_SPOTS[level]).toContainEqual(last)
      }
    }
  })

  it('alternates sides on hard, instead of leaving it to chance', () => {
    // Reported from play: "the hard level is on the left only". It was an
    // independent uniform draw over three left spots and three right ones, so
    // three lefts running had a one-in-eight chance and four a one-in-sixteen
    // — and reloading between plays made every draw independent of the last.
    // Random is not varied; the child only experiences the run they got.
    const rng = seededRng(17)
    let last = pickFriendSpot('hard', null, rng)
    const sides = [Math.sign(last.bearingDeg)]
    for (let i = 0; i < 60; i++) {
      last = pickFriendSpot('hard', last, rng)
      sides.push(Math.sign(last.bearingDeg))
    }
    for (let i = 1; i < sides.length; i++) expect(sides[i]).not.toBe(sides[i - 1])
  })

  it('never puts the friend on the same patch of lawn twice running', () => {
    const rng = seededRng(23)
    for (const level of ['easy', 'medium', 'hard'] as const) {
      let last = pickFriendSpot(level, null, rng)
      for (let i = 0; i < 60; i++) {
        const next = pickFriendSpot(level, last, rng)
        expect(next.bearingDeg).not.toBe(last.bearingDeg)
        last = next
      }
    }
  })

  it('keeps easy on the left and medium on the right while it varies them', () => {
    // alternating must not be allowed to override the per-level side: a level
    // with only one side has nowhere to swap to, and must move position instead
    const rng = seededRng(31)
    for (const [level, want] of [['easy', -1], ['medium', 1]] as const) {
      let last = pickFriendSpot(level, null, rng)
      for (let i = 0; i < 40; i++) {
        last = pickFriendSpot(level, last, rng)
        expect(Math.sign(last.bearingDeg)).toBe(want)
      }
    }
  })

  it('reaches every one of a level\'s spots over a run of sessions', () => {
    const rng = seededRng(5)
    for (const level of ['easy', 'medium', 'hard'] as const) {
      let last = pickFriendSpot(level, null, rng)
      const seen = new Set([last.bearingDeg])
      for (let i = 0; i < 200; i++) {
        last = pickFriendSpot(level, last, rng)
        seen.add(last.bearingDeg)
      }
      expect(seen.size).toBe(FRIEND_SPOTS[level].length)
    }
  })

  it('remembers across a reload, which is what made it look random', () => {
    // a facilitator restarting the headset browser between runs is the normal
    // case; an in-memory cycle would start afresh each time and hand back the
    // very independent draw this exists to avoid
    const first = FRIEND_SPOTS.hard[0]
    rememberFriendSpot('hard', first)
    expect(rememberedFriendSpot('hard')).toEqual(first)
    const next = pickFriendSpot('hard', rememberedFriendSpot('hard'), seededRng(41))
    expect(Math.sign(next.bearingDeg)).not.toBe(Math.sign(first.bearingDeg))
  })
})

describe('the play area stays clear of scenery', () => {
  const everyFriendSpot = Object.values(FRIEND_SPOTS).flat()

  it('keeps every tree and bush out of the front of the park', () => {
    // Four tree crowns used to sit inside the play arc, and two bushes sat
    // NEARER than several surprise spots — not merely cluttering the backdrop
    // but standing in front of the surprise and hiding it.
    for (const t of TREE_PLACEMENTS) {
      expect(Math.abs(angleFromFront(t.bearingDeg))).toBeGreaterThanOrEqual(SCENERY_FRONT_CLEAR_DEG)
    }
    for (const b of BUSH_PLACEMENTS) {
      expect(Math.abs(angleFromFront(b.bearingDeg))).toBeGreaterThanOrEqual(FRONT_HALF_ARC_DEG)
    }
  })

  it('leaves nothing standing in front of a surprise, at any friend spot', () => {
    for (const f of everyFriendSpot) {
      for (const spot of spotsFor(f.bearingDeg)) {
        for (const b of BUSH_PLACEMENTS) {
          // a bush nearer than the surprise and on its bearing would occlude it
          const sameWay = Math.abs(angleFromFront(b.bearingDeg - spot.bearingDeg)) < 20
          if (b.radius < spot.radius) expect(sameWay).toBe(false)
        }
      }
    }
  })

  it('keeps every surprise inside the fence, so no rail cuts across one', () => {
    for (const f of everyFriendSpot) {
      for (const spot of spotsFor(f.bearingDeg)) {
        expect(spot.radius).toBeLessThan(FENCE_RADIUS)
      }
    }
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
      expect(r.spot).toBeLessThan(SPOT_COUNT)
    }
  })

  it('draws WHAT appears independently of WHERE, so neither predicts the other', () => {
    // when a surprise owned a bearing, a child who learned "bunny means 18
    // degrees left" stopped searching and started recalling, and the game
    // stopped measuring attention-getting
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
