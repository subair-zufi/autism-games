import type { Difficulty } from '../../types'

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
  /**
   * When true, the child's button is replaced by a physical grab-and-place:
   * they drag the 3D block onto the tower, like reaching in VR.
   */
  grab: boolean
}

export const CONFIG: Record<Difficulty, BlockConfig> = {
  easy: { players: 3, rounds: 5, peerTurnMs: 1300, shuffle: false, grab: false },
  medium: { players: 4, rounds: 7, peerTurnMs: 1800, shuffle: false, grab: false },
  hard: { players: 5, rounds: 10, peerTurnMs: 2400, shuffle: true, grab: true },
}

/** Blocks per tower before it is set aside and a new one begins (keeps the
 * camera framing tight so the other children stay visible). */
export const TOWER_MAX = 8

export const BLOCK_COLORS = ['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f', '#b06fd6', '#f08a3c']

/** Friendly peer roster (sliced to the player count). */
const PEER_ROSTER: ReadonlyArray<{ name: string; emoji: string; look: Look }> = [
  { name: 'Mia', emoji: '🧒', look: { skin: '#f4c9a3', hair: '#6b3f1d', shirt: '#e2554c', pants: '#3f5aa9', longHair: true } },
  { name: 'Leo', emoji: '👦', look: { skin: '#d9a066', hair: '#2b2118', shirt: '#5aa9e6', pants: '#444c55', longHair: false } },
  { name: 'Ava', emoji: '👧', look: { skin: '#ffe0bd', hair: '#d9a441', shirt: '#7ac74f', pants: '#7a4a8a', longHair: true } },
  { name: 'Sam', emoji: '🧑', look: { skin: '#8d5524', hair: '#171311', shirt: '#f5c542', pants: '#35566b', longHair: false } },
  { name: 'Zoe', emoji: '👶', look: { skin: '#e8b88a', hair: '#4a2c17', shirt: '#b06fd6', pants: '#2f6f4f', longHair: true } },
]

const CHILD_LOOK: Look = { skin: '#f1c27d', hair: '#3b2b20', shirt: '#f9a84d', pants: '#4a6fa5', longHair: false }

export interface TurnSpec {
  playerIndex: number
  kind: 'child' | 'peer'
  color: string
  offset: number
}

/** Build the player list; index 0 is always the child. */
export function buildPlayers(count: number): Player[] {
  const players: Player[] = [{ id: 'child', kind: 'child', name: 'You', emoji: '🙂', look: CHILD_LOOK }]
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
 * Build the full turn sequence: for each round, a randomized ordering of all
 * players. The child appears exactly once per round, at a varying slot.
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
        offset: (rng() - 0.5) * 0.14,
      })
    }
  }
  return seq
}

export const BLOCK_H = 0.42
export function blockY(index: number): number {
  return BLOCK_H / 2 + index * BLOCK_H
}
