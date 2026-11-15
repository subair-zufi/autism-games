import type { Difficulty } from '../../types'

/**
 * Park 360 — *initiating* joint attention (IJA), immersive.
 *
 * The exact game design of Look What I Found! (see discovery/logic.ts) lifted
 * into a first-person 360° park: the child stands on the lawn and turns the
 * view (a real head turn in VR) to spot the surprise, taps it (the "point")
 * and taps the friend (the "hey, look!") — the same two-tap IJA loop, same
 * measurement (a share is `spontaneous` iff un-nudged; latency runs from
 * surprise onset to the friend tap), same fading scaffold across difficulty
 * (big surprises + quick nudges on easy → tiny surprises + no nudges on hard).
 *
 * The one deliberate 360 change is ergonomic, not behavioural: every playable
 * thing — surprise spots, the friend, the HUD — lives in the FRONT half-circle
 * (±FRONT_HALF_ARC), so following the game is a comfortable head turn along
 * the lawn, never a body spin to search behind you (Quest pilot feedback on
 * Museum 360). Trees and sky still wrap the full 360° so the park feels real
 * when the child does look around.
 */

/**
 * The ten surprises — every one a living thing a child already knows and likes.
 *
 * They replace a set that mixed animals with abstractions (a gem, a rainbow).
 * The task is to SHOW something to a friend, and a child shows a rabbit or a
 * peacock with far more of the shared delight this game exists to produce than
 * they show a floating crystal. Ten rather than six also means a child playing
 * all three levels in one session meets far fewer repeats.
 *
 * Kerala-familiar on purpose, since that is where this deploys: a parrot, a
 * peacock and a squirrel are everyday garden sights there, not exotica.
 */
export type DiscoveryId =
  | 'butterfly'
  | 'bunny'
  | 'parrot'
  | 'sunflower'
  | 'puppy'
  | 'kitten'
  | 'squirrel'
  | 'duckling'
  | 'ladybird'
  | 'peacock'

export const DISCOVERIES: DiscoveryId[] = [
  'butterfly',
  'bunny',
  'parrot',
  'sunflower',
  'puppy',
  'kitten',
  'squirrel',
  'duckling',
  'ladybird',
  'peacock',
]

/** half-width of the playable arc: nothing interactive sits beyond ±this */
export const FRONT_HALF_ARC_DEG = 55

/** A place on the lawn a surprise can appear. */
export interface Spot {
  /** signed bearing from straight-ahead, degrees left(−)/right(+) */
  bearingDeg: number
  /** distance from the child (the child never moves) */
  radius: number
}

/**
 * Where a surprise can appear — nine spots, held SEPARATELY from what appears
 * in them.
 *
 * They used to be one and the same: each surprise owned a bearing, so the bird
 * was always dead ahead at 6.2 m and the bunny always 18° to the left. A child
 * only has to notice that once and the search stops being a search — they learn
 * where to look from what they heard, and attention-getting turns into recall.
 * Ten surprises across nine spots gives ninety combinations instead of six
 * fixed ones, so where to look can only ever be found by looking.
 *
 * Every spot also has to stay clear of the FRIEND, and by more than it first
 * looks. The friend's widest part is not their body (7.5° at 4.6 m) but the
 * name plate floating over their head, which is 1.1 m across — 13.6°. Add the
 * widest a surprise ever gets (16.4° for a big-saliency one at the nearest
 * spot) and a surprise needs 17° of bearing clearance before it stops
 * overlapping them on screen. A first pass used a flat 10° rule and put a spot
 * at +25°, where the easy-tier butterfly sat squarely across the friend's name
 * tag — findable, but ambiguous with the very person the child is meant to
 * turn and show it to, which is the other half of the two-tap loop.
 *
 * With the friend at +40° that caps the usable right side at about +23°, and
 * the arc only reaches +55°, so there is nothing beyond them either. The spread
 * is therefore still left-leaning — less so than the old set, where five of six
 * surprises sat at negative bearings, but the lawn's right-hand side belongs to
 * the friend and cannot be shared. Balancing it properly means moving or
 * alternating the friend, which changes the turn-to-friend cost the study
 * records, so it is left as a separate decision.
 */
export const SPOTS: Spot[] = [
  { bearingDeg: -50, radius: 4.8 },
  { bearingDeg: -42, radius: 6.0 },
  { bearingDeg: -34, radius: 4.5 },
  { bearingDeg: -26, radius: 5.8 },
  { bearingDeg: -18, radius: 4.9 },
  { bearingDeg: -10, radius: 6.4 },
  { bearingDeg: -2, radius: 5.2 },
  { bearingDeg: 6, radius: 6.1 },
  { bearingDeg: 14, radius: 5.5 },
]

/** Widest a surprise ever gets from the child: the normalised half-extent
 *  (`NOMINAL_HALF`) at the largest saliency, seen from the nearest spot. */
export const MAX_SURPRISE_HALF_DEG = 12.2
/** The friend's floating name plate, their widest part, as a half-angle. */
export const FRIEND_HALF_DEG = 6.8

/** the friend plays at the right edge of the arc, absorbed in their flowerbed */
export const FRIEND_BEARING_DEG = 40
export const FRIEND_RADIUS = 4.6

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
export function bearingToXZ(bearingRad: number, radius: number): [number, number] {
  return [Math.sin(bearingRad) * radius, -Math.cos(bearingRad) * radius]
}

/** Floor [x, z] of spot `index`. */
export function spotPosition(index: number): [number, number] {
  const s = SPOTS[index] ?? SPOTS[0]
  return bearingToXZ((s.bearingDeg * Math.PI) / 180, s.radius)
}

/** Floor [x, z] where the friend stands. */
export function friendPosition(): [number, number] {
  return bearingToXZ((FRIEND_BEARING_DEG * Math.PI) / 180, FRIEND_RADIUS)
}

/** The child's head-turn to face spot `index`, in signed degrees — recorded
 *  per round as the attention-shift size (same measure as Museum 360). */
export function spotBearingDeg(index: number): number {
  return (SPOTS[index] ?? SPOTS[0]).bearingDeg
}

/** Distance from the child to spot `index` — recorded alongside the bearing so
 *  analysis can tell a far surprise from a near one. */
export function spotRadius(index: number): number {
  return (SPOTS[index] ?? SPOTS[0]).radius
}

/** How loudly the surprise announces itself when it appears. */
export type Saliency = 'big' | 'medium' | 'subtle'

export interface DiscoveryConfig {
  saliency: Saliency
  /**
   * ms after the surprise appears before a helper nudge fires (and repeats).
   * `null` = no nudges ever — success must be fully self-initiated.
   */
  nudgeAfterMs: number | null
  /** how far the friend has turned away from the play area (radians) */
  awayYaw: number
  /** completed shares needed to win a session */
  goal: number
}

export const CONFIG: Record<Difficulty, DiscoveryConfig> = {
  easy: { saliency: 'big', nudgeAfterMs: 4000, awayYaw: 0.9, goal: 5 },
  medium: { saliency: 'medium', nudgeAfterMs: 8000, awayYaw: 1.7, goal: 6 },
  hard: { saliency: 'subtle', nudgeAfterMs: null, awayYaw: 2.6, goal: 8 },
}

/**
 * On Hard (never nudged — success must be fully self-initiated) a child who
 * never acts produces no telemetry at all for that round, the single most
 * clinically interesting case (a non-initiating child). After this long with
 * no share, the round logs a one-off `no_share` timeout event without ending
 * or resetting the round — the child can still complete it any time after.
 */
export const NO_SHARE_TIMEOUT_MS = 20000

/**
 * Child-facing points. Spontaneous (un-nudged) shares earn more than prompted
 * ones; prompted shares are still rewarded, never punished.
 */
export const POINTS = { spontaneous: 10, prompted: 5, streakBonus: 2 }
/** consecutive spontaneous shares needed before the streak bonus kicks in */
export const STREAK_LEN = 3

export function pointsFor(spontaneous: boolean, streakAfterThis: number): number {
  if (!spontaneous) return POINTS.prompted
  return POINTS.spontaneous + (streakAfterThis >= STREAK_LEN ? POINTS.streakBonus : 0)
}

/**
 * Stars reward *spontaneous* shares (the game never fails — a nudged share
 * still completes the round). 3 stars ≥80% spontaneous, 2 ≥50%, else 1 —
 * every finished session earns at least one.
 */
export function starsFor(spontaneousShares: number, goal: number): number {
  const ratio = goal > 0 ? spontaneousShares / goal : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return 1
}

export interface Round {
  discovery: DiscoveryId
  /** index into `SPOTS` — drawn independently of the surprise itself */
  spot: number
}

/**
 * Deal the next round: a surprise, and somewhere for it to appear.
 *
 * The two are drawn independently, and neither repeats the round before — so
 * the child can never predict where to look from what they just saw, and never
 * sees the same thing twice running. Passing the whole previous round (rather
 * than just the previous surprise) is what lets the spot avoid repeating too.
 */
export function makeRound(prev: Round | null, rng: () => number = Math.random): Round {
  const things = DISCOVERIES.filter((d) => d !== prev?.discovery)
  const spots = SPOTS.map((_, i) => i).filter((i) => i !== prev?.spot)
  return {
    discovery: things[Math.floor(rng() * things.length)],
    spot: spots[Math.floor(rng() * spots.length)],
  }
}

/** ms the calm empty park lingers before the next surprise pops (randomised). */
export function spawnDelayMs(rng: () => number = Math.random): number {
  return 900 + Math.round(rng() * 1600)
}

/** Visual appearance for the 3D friend avatar — same body plan as Roll-Back Buddy. */
export interface Look {
  skin: string
  hair: string
  shirt: string
  pants: string
  longHair: boolean
}

export interface Friend {
  /** Malayalam name (shown when the app language is Malayalam). */
  name: string
  /** Romanized name for English. */
  nameEn: string
  look: Look
}

/** Same trio of Kerala playmates as Roll-Back Buddy, so faces feel familiar. */
export const FRIENDS: Friend[] = [
  { name: 'അമ്മു', nameEn: 'Ammu', look: { skin: '#f4c9a3', hair: '#2b2118', shirt: '#e2554c', pants: '#3f5aa9', longHair: true } },
  { name: 'അപ്പു', nameEn: 'Appu', look: { skin: '#d9a066', hair: '#171311', shirt: '#5aa9e6', pants: '#444c55', longHair: false } },
  { name: 'മീനു', nameEn: 'Meenu', look: { skin: '#c68642', hair: '#1c1713', shirt: '#7ac74f', pants: '#7a4a8a', longHair: true } },
]

export function pickFriend(rng: () => number = Math.random): Friend {
  return FRIENDS[Math.floor(rng() * FRIENDS.length)]
}

/**
 * How far the pointer travelled between press and release, in screen pixels —
 * used to ignore "taps" that were really look-around drags. Screen events
 * (r3f) report this as `delta`; XR controller/hand events (pmndrs/
 * pointer-events) *throw* on accessing it, so those count as clean taps —
 * correct, since in VR the head does the looking and no drag exists.
 */
export function dragDistance(e: { delta?: number }): number {
  try {
    return e.delta ?? 0
  } catch {
    return 0
  }
}

/**
 * The last look-around drag, measured by the scene's own controls. Taps are
 * ignored right after a drag — independent of which event system delivered
 * the click, since the XR layer forwards a second copy of every screen event
 * whose drag distance is unreadable (see dragDistance). Lives here (not in
 * the scene file) so hot reload never duplicates it and the guard is
 * unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}
