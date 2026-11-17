import { expect, test } from 'vitest'
import {
  AVATAR_Z,
  avatarEyeElevationDeg,
  bearingToXZ,
  centreOccluderElevationDeg,
  cueSchedule,
  dragDistance,
  errorType,
  EXHIBIT_Y,
  exhibitMeta,
  EXHIBITS,
  FADE_STREAK,
  fadedTier,
  GAZE_TRIALS,
  GOAL,
  HAND_LADDER,
  handClearanceDeg,
  HIT_RADIUS_MAX,
  hitHalfAngleDeg,
  hitRadius,
  isDragTail,
  lookDrag,
  makeRound,
  MAX_POINT_DEPRESSION_DEG,
  MIN_DESIGN_EYE_Y,
  OBJECT_RADIUS,
  pointsFor,
  slotBearing,
  slotDistance,
  slotHeadingDeg,
  slotPosition,
  starsFor,
  START_TIER,
  supportedTier,
  trialCue,
} from './logic'
import { CONFIRM_TOL_DEG } from '../headAim'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('easy shows 3 exhibits, medium 4, hard 5', () => {
  expect(makeRound('easy', null, Math.random).visible).toHaveLength(3)
  expect(makeRound('medium', null, Math.random).visible).toHaveLength(4)
  expect(makeRound('hard', null, Math.random).visible).toHaveLength(5)
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

test('exhibit angles are ordered left to right and symmetric about the avatar', () => {
  for (const n of [3, 4, 5]) {
    const bearings = Array.from({ length: n }, (_, i) => slotBearing(i, n))
    for (let i = 1; i < bearings.length; i++) expect(bearings[i]).toBeGreaterThan(bearings[i - 1])
    // symmetric about the avatar's forward line: the two ends mirror around 0
    expect(bearings[0] + bearings[n - 1]).toBeCloseTo(0)
  }
})

test('every exhibit stays in front — a head turn, never a spin behind the child', () => {
  for (const n of [3, 4, 5]) {
    for (let i = 0; i < n; i++) {
      const [x, z] = slotPosition(i, n)
      // in front of the child (negative z) and a modest head turn from centre
      expect(z).toBeLessThan(0)
      expect(Math.abs(Math.atan2(x, -z))).toBeLessThan(Math.PI / 2)
    }
  }
})

test('the row arcs around the AVATAR: every exhibit is equidistant from it', () => {
  for (const n of [3, 4, 5]) {
    for (let i = 0; i < n; i++) {
      const [x, z] = slotPosition(i, n)
      const distToAvatar = Math.hypot(x - 0, z - AVATAR_Z)
      expect(distToAvatar).toBeCloseTo(OBJECT_RADIUS) // even gaze/point angles
    }
  }
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

test('dragDistance reads screen drags but treats XR events as clean taps', () => {
  // screen (r3f) events report drag pixels in `delta`
  expect(dragDistance({ delta: 0 })).toBe(0)
  expect(dragDistance({ delta: 42 })).toBe(42)
  expect(dragDistance({})).toBe(0)
  // XR controller/hand events (pmndrs/pointer-events) THROW on accessing
  // `delta` — a trigger squeeze must still count as a tap, never crash
  const xrEvent = {
    get delta(): number {
      throw new Error('not supported')
    },
  }
  expect(dragDistance(xrEvent)).toBe(0)
})

test('isDragTail blocks clicks that end a look-around drag, then expires', () => {
  lookDrag.px = 0
  lookDrag.endedAt = 1000
  expect(isDragTail(1050)).toBe(false) // no drag: a plain tap goes through
  lookDrag.px = 120
  expect(isDragTail(1050)).toBe(true) // click right after a drag is the drag's tail
  expect(isDragTail(1000 + 800)).toBe(false) // ...but a later tap is deliberate
  lookDrag.px = 4
  expect(isDragTail(1050)).toBe(false) // tiny wobble under the threshold is a tap
  lookDrag.px = 0
})

test('errorType splits near-misses from picks far around the room', () => {
  const visible = ['butterfly', 'bird', 'doll', 'balloon'] as const
  expect(errorType([...visible], 'bird', 'butterfly')).toBe('adjacent')
  expect(errorType([...visible], 'bird', 'doll')).toBe('adjacent')
  expect(errorType([...visible], 'butterfly', 'doll')).toBe('far')
  expect(errorType([...visible], 'butterfly', 'balloon')).toBe('far')
})

/**
 * At the default steadiness setting the confirm cone stays narrower than the
 * gap between two pedestals, so even a gaze resting on nothing between them
 * cannot finish a confirm for the exhibit it has left. That margin is free at
 * `CONFIRM_TOL_DEG` and this pins it, because widening the arc or adding a
 * sixth exhibit is what would quietly spend it.
 *
 * It is the second of two guards, and the weaker one: the looser profiles in
 * `DWELL_PROFILES` deliberately open the cone wider than this gap, for children
 * who cannot otherwise answer at all. What holds at every setting is
 * `HeadSelect`'s rule that the cone is never applied while the ray rests on a
 * different selectable option — so moving on always means re-arming.
 *
 * The tightest pair is at the ends of the row: the arc is centred on the
 * avatar, not the child, so from where the child stands the outer pedestals
 * crowd together.
 */
test('the default confirm cone stays narrower than the gap between pedestals', () => {
  for (const n of [3, 4, 5]) {
    const headings = Array.from({ length: n }, (_, i) => slotHeadingDeg(i, n))
    for (let i = 1; i < n; i++) {
      expect(headings[i] - headings[i - 1]).toBeGreaterThan(CONFIRM_TOL_DEG)
    }
  }
})

/* ---- tap / gaze targets: generous, but never into a neighbour -------------
 * The arc is centred on the AVATAR, so distance from the CHILD varies: on hard
 * the centre pedestal is 3.20m away and the outermost 4.98m. Every exhibit
 * nevertheless carried the same ~1m hit box, so the outer pairs — only 10.3deg
 * apart in heading — overlapped by ~3.1deg, and in that band the raycaster
 * returns the NEARER one. A child looking squarely at the outermost exhibit
 * selected its neighbour, recorded as an `adjacent` cue-following error.
 */
for (const n of [3, 4, 5]) {
  test(`no two of ${n} exhibits' targets can ever overlap`, () => {
    for (let i = 1; i < n; i++) {
      const combined = hitHalfAngleDeg(i - 1, n) + hitHalfAngleDeg(i, n)
      const gap = Math.abs(slotHeadingDeg(i, n) - slotHeadingDeg(i - 1, n))
      // strictly separated: no bearing may ever reach two different exhibits
      expect(combined).toBeLessThan(gap)
    }
  })

  test(`every one of ${n} exhibits keeps a usable target`, () => {
    for (let i = 0; i < n; i++) {
      // never a pinprick: at least 4deg of half-angle, i.e. 8deg across
      expect(hitHalfAngleDeg(i, n)).toBeGreaterThan(4)
      expect(hitRadius(i, n)).toBeLessThanOrEqual(HIT_RADIUS_MAX)
    }
  })
}

test('uncrowded exhibits keep the full padded target', () => {
  // easy (n=3) has 32.8deg between neighbours, so nothing needs clamping
  for (let i = 0; i < 3; i++) expect(hitRadius(i, 3)).toBeCloseTo(HIT_RADIUS_MAX, 6)
  // hard's centre exhibit has 22.6deg either side — also uncrowded
  expect(hitRadius(2, 5)).toBeGreaterThan(0.5)
})

test('only the crowded hard positions are clamped, and only a little', () => {
  // exhibits 1 and 3 sit 10.3deg from the outermost pair and give up the most
  expect(hitRadius(1, 5)).toBeLessThan(hitRadius(2, 5))
  expect(hitRadius(1, 5)).toBeCloseTo(hitRadius(3, 5), 6)
  expect(hitRadius(0, 5)).toBeCloseTo(hitRadius(4, 5), 6)
  // still comfortably bigger than a fingertip-sized target at 3.74m
  expect(hitRadius(1, 5)).toBeGreaterThan(0.25)
})

test('the target scales with distance, so equal gaps give equal angles', () => {
  // the outer pair and their neighbours share a 10.3deg gap and so share a
  // half-angle, even though they stand at different distances
  expect(hitHalfAngleDeg(0, 5)).toBeCloseTo(hitHalfAngleDeg(1, 5), 6)
  expect(slotDistance(0, 5)).toBeGreaterThan(slotDistance(1, 5))
})

/* ---- the helper avatar must stay visible to a CHILD ----------------------
 * In a headset the camera rides at the wearer's real eye height, and nothing
 * re-centres the world for a short one. From 0.95-1.35m the exhibit row rises
 * in the child's view, and on the odd slot counts one pedestal sits exactly on
 * the avatar's bearing, 3.2m away against the avatar's 7.4m. It used to cut
 * the avatar off at the waist and swallow the pointing hand — hiding the
 * SCAFFOLD rungs (pulse/hover/distal) from the children who depend on them,
 * while the unsupported gaze rung stayed readable.
 */
for (const n of [3, 4, 5]) {
  test(`the pointing hand clears the row for a child, with ${n} exhibits`, () => {
    for (let i = 0; i < n; i++) {
      expect(handClearanceDeg(i, n, MIN_DESIGN_EYE_Y)).toBeGreaterThan(0)
      // and with headroom at the heights most children will actually play at
      expect(handClearanceDeg(i, n, 1.15)).toBeGreaterThan(2)
    }
  })
}

test('an adult at the authored camera height sees the hand too', () => {
  for (const n of [3, 4, 5]) {
    for (let i = 0; i < n; i++) expect(handClearanceDeg(i, n, 1.7)).toBeGreaterThan(0)
  }
})

test('even slot counts put nothing on the avatar bearing at all', () => {
  expect(centreOccluderElevationDeg(4, MIN_DESIGN_EYE_Y)).toBe(-Infinity)
  expect(centreOccluderElevationDeg(3, MIN_DESIGN_EYE_Y)).toBeGreaterThan(0)
  expect(centreOccluderElevationDeg(5, MIN_DESIGN_EYE_Y)).toBeGreaterThan(0)
})

test('the occluder rises as the child gets shorter', () => {
  // the whole reason the authored 1.7m camera never showed this
  expect(centreOccluderElevationDeg(5, 0.95)).toBeGreaterThan(centreOccluderElevationDeg(5, 1.15))
  expect(centreOccluderElevationDeg(5, 1.15)).toBeGreaterThan(centreOccluderElevationDeg(5, 1.7))
})

/* ---- comfort: how far a child has to look UP at the helper ---------------
 * The gaze rung asks them to HOLD that look while the avatar bids and shifts,
 * so it is a sustained posture rather than a glance. Play found the first
 * version too steep at 17-19 degrees. Lowering the avatar relieves this and
 * costs hand clearance, so the two are pinned together: neither can be tuned
 * without the other failing.
 */
test('a child does not have to crane up at the helper', () => {
  for (const eyeY of [0.95, 1.05, 1.15, 1.35]) {
    expect(avatarEyeElevationDeg(eyeY)).toBeLessThanOrEqual(16)
  }
  // and not so low that the face sinks toward the exhibit row behind it
  expect(avatarEyeElevationDeg(1.35)).toBeGreaterThan(8)
})

test('the helper still clears the row it had to be raised above', () => {
  // the other half of the same trade: this is what stopped the avatar simply
  // being lowered until the gaze was comfortable
  for (const n of [3, 4, 5]) {
    for (let i = 0; i < n; i++) {
      expect(handClearanceDeg(i, n, MIN_DESIGN_EYE_Y)).toBeGreaterThan(1)
    }
  }
})

test('the exhibits sit below a child\'s eye line, not above it', () => {
  // down is the restful direction to look; the row used to sit ON the eye line
  // of the shortest players
  expect(EXHIBIT_Y).toBeLessThan(1.05)
  expect(EXHIBIT_Y).toBeGreaterThan(0.7)
})

test('the arm keeps enough pitch to read as a gesture, not a dot', () => {
  // On odd counts the avatar, the centre exhibit and the child are collinear,
  // so a perfectly level arm would point straight down the line of sight.
  expect(MAX_POINT_DEPRESSION_DEG).toBeGreaterThan(8)
  // ...but not so much that it drops back behind the row
  for (const n of [3, 5]) {
    const centre = (n - 1) / 2
    expect(handClearanceDeg(centre, n, MIN_DESIGN_EYE_Y)).toBeGreaterThan(0)
  }
})
