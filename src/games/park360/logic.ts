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

export type DiscoveryId = 'butterfly' | 'bunny' | 'bird' | 'flower' | 'gem' | 'rainbow'

export interface DiscoveryMeta {
  id: DiscoveryId
  /** signed bearing from straight-ahead, degrees left(−)/right(+) — all in the front arc */
  bearingDeg: number
  /** distance from the child (the child never moves) */
  radius: number
}

/** half-width of the playable arc: nothing interactive sits beyond ±this */
export const FRONT_HALF_ARC_DEG = 55

/**
 * Surprise spots spread across the front arc, all well away from the friend
 * (who stands on the right edge of the arc, busy with the flowerbed).
 */
export const DISCOVERIES: DiscoveryMeta[] = [
  { id: 'flower', bearingDeg: -52, radius: 4.6 },
  { id: 'butterfly', bearingDeg: -38, radius: 5.0 },
  { id: 'bunny', bearingDeg: -18, radius: 5.6 },
  { id: 'bird', bearingDeg: 0, radius: 6.2 }, // perched on the front fence
  { id: 'rainbow', bearingDeg: -26, radius: 11 }, // up in the sky beyond the fence
  { id: 'gem', bearingDeg: 14, radius: 5.4 },
]

/** the friend plays at the right edge of the arc, absorbed in their flowerbed */
export const FRIEND_BEARING_DEG = 40
export const FRIEND_RADIUS = 4.6

export function discoveryMeta(id: DiscoveryId): DiscoveryMeta {
  return DISCOVERIES.find((d) => d.id === id)!
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
export function bearingToXZ(bearingRad: number, radius: number): [number, number] {
  return [Math.sin(bearingRad) * radius, -Math.cos(bearingRad) * radius]
}

/** Floor [x, z] of a discovery's spot. */
export function discoveryPosition(id: DiscoveryId): [number, number] {
  const m = discoveryMeta(id)
  return bearingToXZ((m.bearingDeg * Math.PI) / 180, m.radius)
}

/** Floor [x, z] where the friend stands. */
export function friendPosition(): [number, number] {
  return bearingToXZ((FRIEND_BEARING_DEG * Math.PI) / 180, FRIEND_RADIUS)
}

/** The child's head-turn to face the surprise, in signed degrees — recorded
 *  per round as the attention-shift size (same measure as Museum 360). */
export function discoveryBearingDeg(id: DiscoveryId): number {
  return discoveryMeta(id).bearingDeg
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
}

export function makeRound(prev: DiscoveryId | null, rng: () => number = Math.random): Round {
  const pool = DISCOVERIES.filter((d) => d.id !== prev)
  return { discovery: pool[Math.floor(rng() * pool.length)].id }
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
