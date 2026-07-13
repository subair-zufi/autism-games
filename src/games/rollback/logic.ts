import type { Difficulty } from '../../types'

/**
 * Roll-Back Buddy — reciprocal (contingent) turn-taking.
 *
 * Unlike Block Buddies (a fixed round-robin where each turn is independent),
 * here every turn is a *response*: a peer rolls the ball to the child, and the
 * child must roll it back to whichever partner is *ready to receive*. The
 * exchange only works if the child reads the partner and times the return.
 *
 * Two failure modes are the whole point of the measurement:
 *  - rolling *before* the partner signals ready  -> a reciprocity/timing slip
 *    (the dyadic analog of Block Buddies' `impatient_tap`).
 *  - rolling to the *wrong* partner               -> an orientation-reading slip
 *    (shares scoring intent with the Museum joint-attention work).
 */

/** Visual appearance for the 3D kid avatars — reuse the Block Buddies Look. */
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
 * How the "I'm ready to receive" cue is delivered. Fades exactly like the
 * Museum prompt-hierarchy (CueMode there: pulse -> hover -> distal):
 *  - `verbal`  : partner says "roll it to me!" + a glowing arc to their hands.
 *  - `gesture` : no words; partner raises/opens hands and leans in.
 *  - `orient`  : subtle body/gaze orientation only — the child must *infer*
 *                who is ready and, in `selfInitiate` rounds, start the rally.
 */
export type CueMode = 'verbal' | 'gesture' | 'orient'

export interface RollConfig {
  /** peers seated around the table (the child is always additional). */
  partners: number
  /** number of rallies (one child return per rally). */
  rounds: number
  /** ms the incoming ball takes to travel to the child. */
  rollTravelMs: number
  /**
   * ms after the ball settles before the target partner shows the ready cue.
   * Return latency is measured from that cue onset, never from ball-settle, so
   * a child who waits calmly is not penalised — matches the "latency from
   * cue_ready, no time pressure" convention.
   */
  readyDelayMs: number
  /** how the ready cue is presented (fades with difficulty). */
  cue: CueMode
  /**
   * On some hard rounds there is *no* incoming roll: a partner signals
   * availability and the child must *initiate* the exchange. Trains the
   * initiate-vs-respond distinction Block Buddies never touches.
   */
  selfInitiate: boolean
}

/**
 * Difficulty ladder. Partners grow (dyad -> small group, so "which partner is
 * ready" becomes a real choice), the cue fades verbal -> gesture -> orient,
 * and the hard tier adds child-initiated rallies.
 */
export const CONFIG: Record<Difficulty, RollConfig> = {
  easy:   { partners: 1, rounds: 5,  rollTravelMs: 1100, readyDelayMs: 500, cue: 'verbal',  selfInitiate: false },
  medium: { partners: 2, rounds: 7,  rollTravelMs: 900,  readyDelayMs: 650, cue: 'gesture', selfInitiate: false },
  hard:   { partners: 3, rounds: 10, rollTravelMs: 750,  readyDelayMs: 800, cue: 'orient',  selfInitiate: true },
}

/** correct returns needed to win a session (mirrors Museum's GOAL). */
export const GOAL: Record<Difficulty, number> = { easy: 5, medium: 7, hard: 10 }

/** Friendly Kerala peer roster (sliced to the partner count). Names are in
 * Malayalam script — labels render via DOM overlays, prompts speak them. */
const PEER_ROSTER: ReadonlyArray<{ name: string; nameEn: string; emoji: string; look: Look }> = [
  { name: 'അമ്മു', nameEn: 'Ammu', emoji: '🧒', look: { skin: '#f4c9a3', hair: '#2b2118', shirt: '#e2554c', pants: '#3f5aa9', longHair: true } },
  { name: 'അപ്പു', nameEn: 'Appu', emoji: '👦', look: { skin: '#d9a066', hair: '#171311', shirt: '#5aa9e6', pants: '#444c55', longHair: false } },
  { name: 'മീനു', nameEn: 'Meenu', emoji: '👧', look: { skin: '#c68642', hair: '#1c1713', shirt: '#7ac74f', pants: '#7a4a8a', longHair: true } },
]

const CHILD_LOOK: Look = { skin: '#d9a066', hair: '#2b2118', shirt: '#f9a84d', pants: '#4a6fa5', longHair: false }

/** Build the players; index 0 is always the child, 1..n are the partners. */
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
  /** partner who rolls the ball in; -1 when the child must self-initiate. */
  from: number
  /** partner the child should return to (the one who shows the ready cue). */
  to: number
  /** other partners present but *not* ready this rally (the wrong-partner traps). */
  distractors: number[]
  /** true when there is no incoming roll and the child starts the exchange. */
  initiate: boolean
}

/** pick a random element */
function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

/**
 * Build the full rally sequence. The ready partner (`to`) varies each rally so
 * the child can't fall back on a fixed order — reciprocity has to be read live.
 * With one partner it degenerates to a clean dyadic roll back-and-forth.
 */
export function makeSequence(
  config: RollConfig,
  players: Player[],
  rng: () => number = Math.random,
): Rally[] {
  const partnerIdx = players.map((_, i) => i).filter((i) => i >= 1)
  const seq: Rally[] = []
  let prevTo = -1
  for (let r = 0; r < config.rounds; r++) {
    // avoid the same target twice in a row so the "who's ready" read stays live
    const candidates = partnerIdx.length > 1 ? partnerIdx.filter((i) => i !== prevTo) : partnerIdx
    const to = pick(candidates, rng)
    const distractors = partnerIdx.filter((i) => i !== to)
    // in self-initiate tiers, ~1 in 3 rallies have no incoming roll
    const initiate = config.selfInitiate && rng() < 0.34
    const from = initiate ? -1 : pick(partnerIdx, rng)
    seq.push({ from, to, distractors, initiate })
    prevTo = to
  }
  return seq
}

/**
 * Child-facing points. Independent (first-attempt) returns earn more than
 * corrected ones; retries are still rewarded, never punished. Mirrors Museum.
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
 *  - `wrong-partner`: rolled to a present-but-not-ready partner (orientation read).
 *  - `correct`      : right partner, after the cue.
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
