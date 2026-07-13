import type { Difficulty } from '../../types'

/**
 * Look What I Found! — *initiating* joint attention (IJA).
 *
 * Museum Look trains the responding half of joint attention (following
 * someone else's point). This game trains the other, harder half:
 * spontaneously *sharing* a discovery with a partner. A surprise appears while
 * the friend is looking away and nothing tells the child to act — the round
 * only completes when the child both taps the discovery (the "point") and taps
 * the friend (the "hey, look!"), in either order. That two-tap loop is the
 * tap-interface stand-in for the point-plus-gaze-alternation that defines IJA.
 *
 * Measurement hinges on *initiation*, not selection:
 *  - a share is `spontaneous` iff it completed before any helper nudge fired;
 *  - latency runs from surprise onset to the friend tap (the social move);
 *  - there is no guessing baseline — chance is 0, like Block Buddies.
 *
 * Scaffolding fades in reverse across difficulty (least-to-most prompting):
 * big salient surprises + a half-turned friend + quick nudges on easy, down to
 * tiny quiet surprises, a fully turned-away friend and *no* nudges on hard —
 * so a hard-level success is genuinely self-initiated.
 */

export type DiscoveryId = 'butterfly' | 'bunny' | 'bird' | 'flower' | 'gem' | 'rainbow'

export interface DiscoveryMeta {
  id: DiscoveryId
  /** [x, z] spot where the surprise pops up; y is decided by each model */
  position: [number, number]
}

/** Surprise spots spread over the park, all well away from the friend (right side). */
export const DISCOVERIES: DiscoveryMeta[] = [
  { id: 'butterfly', position: [-2.6, 0.2] },
  { id: 'bunny', position: [-1.2, -1.9] },
  { id: 'bird', position: [0.4, -2.6] },
  { id: 'flower', position: [-3.3, -1.2] },
  { id: 'gem', position: [1.2, -1.7] },
  { id: 'rainbow', position: [-0.6, -4.5] },
]

export function discoveryMeta(id: DiscoveryId): DiscoveryMeta {
  return DISCOVERIES.find((d) => d.id === id)!
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
