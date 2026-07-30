import type { Difficulty } from '../../types'

/**
 * Playroom 360 — cooperative turn-taking around a play table.
 *
 * The immersive first-person copy of Block Buddies (see blocks/logic.ts):
 * identical rules, scoring, rounds and difficulty ladder, but the child SITS
 * at the play table inside a cozy playroom and *turns the view* (drag on
 * screen, a real head turn in VR) to watch each friend take their turn — the
 * same lift Museum 360 gives Museum Look and Football 360 gives Roll-Back
 * Buddy.
 *
 * Everything playable lives in the front half-circle (|bearing| <= ~65°): the
 * table, the tower, the child's own block and every friend. The back half is
 * only cozy room decor, so the child never has to crane around to play.
 *
 * The blocks are small (real wooden-block scale next to the kid avatars) and
 * finished towers are parked as minis, so the stack never grows tall enough
 * to hide a friend's face.
 */

/** Visual appearance for the 3D kid avatars (skin/hair/clothes). */
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
  name: string
  emoji: string
  look: Look
}

export interface BlockConfig {
  /** total players in the rotation, including the child */
  players: number
  /** how many full rounds (the child gets one turn per round) */
  rounds: number
  /** how long a peer "thinks" before placing, in ms */
  peerTurnMs: number
  /**
   * When false, every round uses the same fixed rotation so the child can
   * *anticipate* their turn — the core of turn-taking. When true, the order is
   * reshuffled each round as a harder generalization step.
   */
  shuffle: boolean
}

/**
 * Difficulty ladder — mirrors Block Buddies (more friends, more rounds, then a
 * reshuffled order on hard). Unlike the flat-screen original, every level
 * places blocks with a single tap: the grab-and-drag reach doesn't add to the
 * turn-taking skill here and fights the 360 look-around controls, so it is
 * dropped for a consistent tap across all levels.
 */
export const CONFIG: Record<Difficulty, BlockConfig> = {
  easy: { players: 3, rounds: 5, peerTurnMs: 1300, shuffle: false },
  medium: { players: 4, rounds: 7, peerTurnMs: 1800, shuffle: false },
  hard: { players: 5, rounds: 10, peerTurnMs: 2400, shuffle: true },
}

/**
 * Stars for a finished session, from how well the child WAITED.
 *
 * Blocks placed cannot be the measure: the child gets exactly one turn per
 * round, so it is always `config.rounds` and every session would earn three
 * stars. What varies — and what this game trains — is not grabbing a turn that
 * is not yours, so the ratio is placements over placements-plus-out-of-turn
 * taps. Deliberately the same pair reported to `game_progress` and the same
 * one the server's `_blocks_trials` scores, so the stars the child sees and the
 * accuracy the study records cannot drift apart.
 *
 * 3 stars ≥80% of actions were in turn, 2 ≥50%, else 1 — the same thresholds as
 * the other 360 games, and every finished session earns at least one. The
 * tolerance therefore scales with session length: on Easy (5 rounds) one
 * impatient tap still earns three stars, on Hard (10 rounds) two do. No-fail
 * stands — an impatient tap is coached, never punished; it only means fewer
 * stars, and the game itself never ends early.
 */
export function starsFor(placements: number, actions: number): number {
  const ratio = actions > 0 ? placements / actions : 0
  if (ratio >= 0.8) return 3
  if (ratio >= 0.5) return 2
  return 1
}

/** Blocks per tower before it is set aside and a new one begins — with the
 * small 360 blocks this also caps the stack below every friend's face. */
export const TOWER_MAX = 8

export const BLOCK_COLORS = ['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f', '#b06fd6', '#f08a3c']

/** Friendly peer roster — the same buddies as Block Buddies. */
const PEER_ROSTER: ReadonlyArray<{ name: string; emoji: string; look: Look }> = [
  { name: 'Mia', emoji: '🧒', look: { skin: '#f4c9a3', hair: '#6b3f1d', shirt: '#e2554c', pants: '#3f5aa9', longHair: true } },
  { name: 'Leo', emoji: '👦', look: { skin: '#d9a066', hair: '#2b2118', shirt: '#5aa9e6', pants: '#444c55', longHair: false } },
  { name: 'Ava', emoji: '👧', look: { skin: '#ffe0bd', hair: '#d9a441', shirt: '#7ac74f', pants: '#7a4a8a', longHair: true } },
  { name: 'Sam', emoji: '🧑', look: { skin: '#8d5524', hair: '#171311', shirt: '#f5c542', pants: '#35566b', longHair: false } },
]

export interface TurnSpec {
  playerIndex: number
  kind: 'child' | 'peer'
  color: string
  offset: number
}

/** Build the player list; index 0 is always the child (the camera — never
 * rendered, the child sees the room through their own eyes). */
export function buildPlayers(count: number): Player[] {
  const players: Player[] = [
    { id: 'child', kind: 'child', name: 'You', emoji: '🙂', look: { skin: '#f1c27d', hair: '#3b2b20', shirt: '#f9a84d', pants: '#4a6fa5', longHair: false } },
  ]
  for (let i = 0; i < count - 1; i++) {
    const p = PEER_ROSTER[i % PEER_ROSTER.length]
    players.push({ id: `peer-${i + 1}`, kind: 'peer', name: p.name, emoji: p.emoji, look: p.look })
  }
  return players
}

function shuffled(n: number, rng: () => number): number[] {
  const arr = [...Array(n).keys()]
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Build the full turn sequence — same shape as Block Buddies: for each round
 * every player goes once; easy/medium keep a fixed, anticipatable rotation and
 * hard reshuffles each round. The tiny `offset` keeps the stack looking
 * hand-built (scaled to the small 360 blocks).
 */
export function makeSequence(
  config: BlockConfig,
  players: Player[],
  rng: () => number = Math.random,
): TurnSpec[] {
  const seq: TurnSpec[] = []
  const fixedOrder = [...Array(players.length).keys()]
  for (let r = 0; r < config.rounds; r++) {
    const order = config.shuffle ? shuffled(players.length, rng) : fixedOrder
    for (const playerIndex of order) {
      seq.push({
        playerIndex,
        kind: players[playerIndex].kind,
        color: BLOCK_COLORS[Math.floor(rng() * BLOCK_COLORS.length)],
        offset: (rng() - 0.5) * 0.035,
      })
    }
  }
  return seq
}

/* ---- 360° playroom layout ---------------------------------------------------
 * The child sits at the play table (the camera, at the origin) and everything
 * interactive fans across the front half-circle. Bearing 0 is straight ahead
 * (-z); positive bearings are to the right. Nothing playable ever sits behind
 * the child.
 */

/** Real wooden-block scale next to ~1.4 m kid avatars — small enough that a
 * full TOWER_MAX stack (top ≈ 1.4 m) stays below every friend's face. */
export const BLOCK_H = 0.115
export const BLOCK_W = 0.34

/** play-table top height */
export const TABLE_H = 0.5
/** table centre: straight ahead of the child */
export const TABLE_RADIUS = 2.55
export const TABLE_R = 1.15

/** the shared tower sits on the table, nudged left of centre so no friend is
 * ever directly behind it (medium's middle friend stands at bearing 0) */
export const TOWER_BEARING = -12
export const TOWER_RADIUS = 2.4

/** the child's own block waits on the near table edge, to their right */
export const TRAY_BEARING = 14
export const TRAY_RADIUS = 1.9

/** where finished mini towers get parked, along the right table edge */
export const PARK_BEARING = 32
export const PARK_RADIUS = 2.7

/**
 * The friends gather *around the play table*, not on a wide arc centred on the
 * child — otherwise the outer friends on hard drift far out to the sides and
 * away from the table. Each friend stands just past the table's rim, spread
 * across its far half so they cluster at the table (realistic) and all stay in
 * the child's front view.
 */

/** how far past the table centre a friend stands — the table rim plus a step */
export const PEER_STAND_RADIUS = TABLE_R + 0.5

/**
 * Where each friend stands, as an angle (degrees) *about the table centre*:
 * 0 = the far side straight ahead of the child, positive = to the right. The
 * child sits at the near rim (180°), so the friends fan across the far arc.
 */
export const PEER_TABLE_ANGLES: Record<number, ReadonlyArray<number>> = {
  2: [-52, 52],
  3: [-66, 0, 66],
  4: [-84, -48, 48, 84],
}

/** Convert a bearing (radians) to floor coordinates (bearing 0 = toward -z). */
export function bearingToXZ(bearing: number, radius: number): [number, number] {
  return [Math.sin(bearing) * radius, -Math.cos(bearing) * radius]
}

/** Angle (deg, about the table centre) at which friend `index` (>= 1) stands. */
export function peerTableAngleDeg(index: number, players: number): number {
  const slots = PEER_TABLE_ANGLES[Math.min(Math.max(players - 1, 2), 4)]
  return slots[Math.min(index - 1, slots.length - 1)] ?? 0
}

/** Floor [x, z] where friend `index` stands (index 0, the child, is the camera). */
export function peerPosition(index: number, players: number): [number, number] {
  if (index <= 0) return [0, 0]
  const phi = (peerTableAngleDeg(index, players) * Math.PI) / 180
  const [cx, cz] = bearingToXZ(0, TABLE_RADIUS) // the table centre
  return [cx + Math.sin(phi) * PEER_STAND_RADIUS, cz - Math.cos(phi) * PEER_STAND_RADIUS]
}

/** The child's head-turn (bearing, degrees left(−)/right(+) of straight-ahead)
 *  to face friend `index` — recorded per hand-off as the attention-shift size. */
export function peerBearingDeg(index: number, players: number): number {
  const [x, z] = peerPosition(index, players)
  return Math.round((Math.atan2(x, -z) * 180) / Math.PI)
}

/** [x, z] of a named table landmark. */
export function landmarkXZ(bearingDeg: number, radius: number): [number, number] {
  return bearingToXZ((bearingDeg * Math.PI) / 180, radius)
}

/** Centre-of-block height for stack slot `index` (sitting on the table top). */
export function blockY(index: number): number {
  return TABLE_H + BLOCK_H / 2 + index * BLOCK_H
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
 * The last look-around drag, measured by the scene's own controls. Scene taps
 * are ignored right after a drag — independent of which event system delivered
 * the click (see dragDistance). Lives here (not in the scene file) so hot
 * reload never duplicates it and the guard is unit-testable.
 */
export const lookDrag = { px: 0, endedAt: 0 }

/** whether a click arriving now is just the tail end of a look-around drag */
export function isDragTail(now: number = Date.now()): boolean {
  return lookDrag.px > 8 && now - lookDrag.endedAt < 700
}
