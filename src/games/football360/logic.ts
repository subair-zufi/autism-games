import type { Difficulty } from '../../types'

/**
 * Football 360 — reciprocal (contingent) turn-taking on a football ground.
 *
 * The immersive first-person copy of Roll-Back Buddy (see rollback/logic.ts):
 * identical rules, scoring, lives and difficulty ladder, but the child stands
 * ON the pitch at the centre spot and must *turn the view* (drag on screen, a
 * real head turn in VR) to find the teammate who is ready — the same lift
 * Museum 360 gives Museum Look.
 *
 * Every turn is a *response*: a teammate passes the ball to the child, and the
 * child must pass it back to whichever teammate is *ready to receive*. The
 * exchange only works if the child reads the teammate and times the return.
 *
 * Two failure modes are the whole point of the measurement:
 *  - passing *before* the teammate signals ready -> a reciprocity/timing slip
 *    (the dyadic analog of Block Buddies' `impatient_tap`).
 *  - passing to the *wrong* teammate            -> an orientation-reading slip
 *    (shares scoring intent with the Museum joint-attention work).
 */

/** Visual appearance for the 3D kid avatars — same Look as Roll-Back Buddy. */
export interface Look {
  skin: string
  hair: string
  shirt: string
  pants: string
  longHair: boolean
}

export interface Player {
  id: string
  kind: 'child' | 'peer'
  /** Malayalam name (shown in the 3D scene and the Malayalam prompt line). */
  name: string
  /** Romanized name for the English prompt line. */
  nameEn: string
  emoji: string
  look: Look
}

/**
 * How the "I'm ready to receive" cue is delivered. Fades exactly like
 * Roll-Back Buddy (and the Museum prompt-hierarchy):
 *  - `verbal`  : teammate says "pass it to me!" + a glowing ring at their feet.
 *  - `gesture` : no words; teammate raises/opens hands and leans in.
 *  - `orient`  : subtle body/gaze orientation only — the child must *infer*
 *                who is ready and, in initiate rallies, start the rally.
 */
export type CueMode = 'verbal' | 'gesture' | 'orient'

export interface RollConfig {
  /** teammates on the pitch (the child is always additional). */
  partners: number
  /** number of rallies (one child return per rally). */
  rounds: number
  /** ms the incoming ball takes to travel to the child. */
  rollTravelMs: number
  /**
   * ms after the ball settles before the target teammate shows the ready cue.
   * Return latency is measured from that cue onset, never from ball-settle, so
   * a child who waits calmly is not penalised — matches the "latency from
   * cue_ready, no time pressure" convention.
   */
  readyDelayMs: number
  /**
   * How the ready cue is presented. `cue` and `partners` are independent
   * difficulty axes (review R7): the default ladder fades the cue AND grows the
   * set size together, but either can be set without the other, and both are
   * recorded on every rally event so a failure can be attributed to reading the
   * cue vs handling the set size rather than being confounded.
   */
  cue: CueMode
  /**
   * How many rallies in the session have *no* incoming pass — a teammate signals
   * availability and the child must *initiate* the exchange. Trains the
   * initiate-vs-respond distinction Block Buddies never touches. These are now a
   * fixed, evenly-spread count per level (review R5), not a per-rally coin flip,
   * so the initiate-vs-respond construct is measured on a stable, counterbalanced
   * set of trials rather than a variable handful.
   */
  initiateCount: number
}

/**
 * Difficulty ladder — identical to Roll-Back Buddy. Teammates grow (dyad ->
 * small group, so "who is ready" becomes a real choice), the cue fades
 * verbal -> gesture -> orient, and the hard tier adds child-initiated rallies.
 */
export const CONFIG: Record<Difficulty, RollConfig> = {
  easy:   { partners: 1, rounds: 5,  rollTravelMs: 1100, readyDelayMs: 500, cue: 'verbal',  initiateCount: 0 },
  medium: { partners: 2, rounds: 7,  rollTravelMs: 900,  readyDelayMs: 650, cue: 'gesture', initiateCount: 0 },
  hard:   { partners: 3, rounds: 10, rollTravelMs: 750,  readyDelayMs: 800, cue: 'orient',  initiateCount: 3 },
}

/**
 * Which rallies are child-initiated (no incoming pass), as a fixed schedule:
 * exactly `count` of them, spread evenly, and never the opening rally (index 0
 * is always a response so the child learns the loop before being asked to
 * start one). Modelled on Museum 360's `cueSchedule` (review R5).
 */
export function buildInitiateSchedule(count: number, rounds: number): boolean[] {
  const out: boolean[] = Array(rounds).fill(false)
  // never the opening rally -> initiate rallies live in indices 1..rounds-1
  const slots = Math.max(0, rounds - 1)
  const n = Math.min(count, slots)
  for (let i = 0; i < n; i++) {
    const pos = 1 + Math.floor(((i + 0.5) * slots) / n)
    out[Math.min(pos, rounds - 1)] = true
  }
  return out
}

/** correct returns needed to win a session (mirrors Roll-Back Buddy's GOAL). */
export const GOAL: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 10 }

/** Friendly Kerala teammate roster (sliced to the partner count). Names are in
 * Malayalam script — labels render via DOM overlays, prompts speak them. */
const PEER_ROSTER: ReadonlyArray<{ name: string; nameEn: string; emoji: string; look: Look }> = [
  { name: 'അമ്മു', nameEn: 'Ammu', emoji: '🧒', look: { skin: '#f4c9a3', hair: '#2b2118', shirt: '#e2554c', pants: '#3f5aa9', longHair: true } },
  { name: 'അപ്പു', nameEn: 'Appu', emoji: '👦', look: { skin: '#d9a066', hair: '#171311', shirt: '#5aa9e6', pants: '#444c55', longHair: false } },
  { name: 'മീനു', nameEn: 'Meenu', emoji: '👧', look: { skin: '#c68642', hair: '#1c1713', shirt: '#7ac74f', pants: '#7a4a8a', longHair: true } },
]

const CHILD_LOOK: Look = { skin: '#d9a066', hair: '#2b2118', shirt: '#f9a84d', pants: '#4a6fa5', longHair: false }

/** Build the players; index 0 is always the child, 1..n are the teammates. */
export function buildPlayers(partners: number): Player[] {
  const players: Player[] = [
    { id: 'child', kind: 'child', name: 'നീ', nameEn: 'You', emoji: '🙂', look: CHILD_LOOK },
  ]
  for (let i = 0; i < partners; i++) {
    const p = PEER_ROSTER[i % PEER_ROSTER.length]
    players.push({ id: `peer-${i + 1}`, kind: 'peer', name: p.name, nameEn: p.nameEn, emoji: p.emoji, look: p.look })
  }
  return players
}

/**
 * One rally. `partnerIndex` values are indices into the players array (>= 1,
 * since 0 is the child).
 */
export interface Rally {
  /** teammate who passes the ball in; -1 when the child must self-initiate. */
  from: number
  /** teammate the child should return to (the one who shows the ready cue). */
  to: number
  /** other teammates present but *not* ready this rally (the wrong-partner traps). */
  distractors: number[]
  /** true when there is no incoming pass and the child starts the exchange. */
  initiate: boolean
}

/** pick a random element */
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * Build the full rally sequence. The ready teammate (`to`) varies each rally so
 * the child can't fall back on a fixed order — reciprocity has to be read live.
 * With one teammate it degenerates to a clean dyadic pass back-and-forth.
 */
export function makeSequence(
  config: RollConfig,
  players: Player[],
  rng: () => number = Math.random,
): Rally[] {
  const partnerIdx = players.map((_, i) => i).filter((i) => i >= 1)
  const seq: Rally[] = []
  // a fixed, evenly-spread set of initiate rallies rather than a per-rally
  // coin flip, so the initiate-vs-respond construct is counterbalanced (R5)
  const initiateSchedule = buildInitiateSchedule(config.initiateCount, config.rounds)
  let prevTo = -1
  for (let r = 0; r < config.rounds; r++) {
    // avoid the same target twice in a row so the "who's ready" read stays live
    const candidates = partnerIdx.length > 1 ? partnerIdx.filter((i) => i !== prevTo) : partnerIdx
    const to = pick(candidates, rng)
    const distractors = partnerIdx.filter((i) => i !== to)
    const initiate = initiateSchedule[r]
    const from = initiate ? -1 : pick(partnerIdx, rng)
    seq.push({ from, to, distractors, initiate })
    prevTo = to
  }
  return seq
}

/**
 * Child-facing points — identical to Roll-Back Buddy. Independent
 * (first-attempt) returns earn more than corrected ones; retries are still
 * rewarded, never punished.
 */
export const POINTS = { first: 10, retry: 5, streakBonus: 2 }
/** consecutive first-attempt returns before the streak bonus kicks in */
export const STREAK_LEN = 3

export function pointsFor(firstAttempt: boolean, streakAfterThis: number): number {
  if (!firstAttempt) return POINTS.retry
  return POINTS.first + (streakAfterThis >= STREAK_LEN ? POINTS.streakBonus : 0)
}

/**
 * Researcher-facing error classification for a child's return:
 *  - `premature`    : released before the ready cue (reciprocity/timing failure).
 *  - `wrong-partner`: passed to a present-but-not-ready teammate (orientation read).
 *  - `correct`      : right teammate, after the cue.
 */
export type ReturnResult = 'correct' | 'premature' | 'wrong-partner'

export function classifyReturn(
  rally: Rally,
  rolledTo: number,
  cueShown: boolean,
): ReturnResult {
  if (!cueShown) return 'premature'
  return rolledTo === rally.to ? 'correct' : 'wrong-partner'
}

/** 3 stars = all lives kept, 2 = one slip, 1 = finished (or kept trying). */
export function starsFor(completed: boolean, livesLeft: number): number {
  if (!completed) return 1
  if (livesLeft >= 3) return 3
  if (livesLeft === 2) return 2
  return 1
}

/* ---- 360° pitch layout ------------------------------------------------------
 * The child stands at the centre spot (the camera, at the origin) and the
 * teammates stand on an arc in front, all one radius away. Wider partner
 * counts fan wider, so on hard the "who is ready" read needs a real head
 * turn along the arc — the ergonomic, headset-friendly version of scanning
 * your teammates on a pitch (nothing is ever behind the child).
 * Bearing 0 is straight ahead (-z); positive bearings are to the right.
 */

/** distance from the child (centre spot) to each teammate */
export const PARTNER_RADIUS = 5.2

/** teammate bearings (degrees off straight-ahead) by partner count */
export const PARTNER_BEARINGS: Record<number, ReadonlyArray<number>> = {
  1: [0],
  2: [-28, 28],
  3: [-50, 0, 50],
}

/** Bearing (degrees) of player `index` (>= 1) among `partners` teammates. */
export function partnerBearingDeg(index: number, partners: number): number {
  const slots = PARTNER_BEARINGS[Math.min(Math.max(partners, 1), 3)]
  return slots[Math.min(index - 1, slots.length - 1)] ?? 0
}

/** Convert a bearing to floor coordinates (bearing 0 = forward, toward -z). */
export function bearingToXZ(bearing: number, radius: number): [number, number] {
  return [Math.sin(bearing) * radius, -Math.cos(bearing) * radius]
}

/** Floor [x, z] where player `index` stands (index 0, the child, is at the origin). */
export function playerPosition(index: number, partners: number): [number, number] {
  if (index <= 0) return [0, 0]
  const a = (partnerBearingDeg(index, partners) * Math.PI) / 180
  return bearingToXZ(a, PARTNER_RADIUS)
}

/** The child's head-turn to face player `index`, in degrees left(−)/right(+)
 *  of straight-ahead — recorded per rally as the attention-shift size. */
export function playerHeadingDeg(index: number, partners: number): number {
  return index <= 0 ? 0 : Math.round(partnerBearingDeg(index, partners))
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
 * The last look-around drag, measured by the scene's own controls. Teammate
 * taps are ignored right after a drag — independent of which event system
 * delivered the click, since the XR layer forwards a second copy of every
 * screen event whose drag distance is unreadable (see dragDistance).
 * Lives here (not in the scene file) so hot reload never duplicates it and
 * the guard is unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}
