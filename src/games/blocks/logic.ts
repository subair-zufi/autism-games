import type { Difficulty } from '../../types'

export interface Player {
  id: string
  kind: 'child' | 'peer'
  name: string
  emoji: string
}

export interface BlockConfig {
  /** total players in the rotation, including the child */
  players: number
  /** how many full rounds (the child gets one turn per round) */
  rounds: number
  /** how long a peer "thinks" before placing, in ms */
  peerTurnMs: number
}

export const CONFIG: Record<Difficulty, BlockConfig> = {
  easy: { players: 3, rounds: 5, peerTurnMs: 1300 },
  medium: { players: 4, rounds: 7, peerTurnMs: 1800 },
  hard: { players: 5, rounds: 10, peerTurnMs: 2400 },
}

export const BLOCK_COLORS = ['#e2554c', '#f5c542', '#5aa9e6', '#7ac74f', '#b06fd6', '#f08a3c']

/** Friendly peer roster (sliced to the player count). */
const PEER_ROSTER: ReadonlyArray<{ name: string; emoji: string }> = [
  { name: 'Mia', emoji: '🧒' },
  { name: 'Leo', emoji: '👦' },
  { name: 'Ava', emoji: '👧' },
  { name: 'Sam', emoji: '🧑' },
  { name: 'Zoe', emoji: '👶' },
]

export interface TurnSpec {
  playerIndex: number
  kind: 'child' | 'peer'
  color: string
  offset: number
}

/** Build the player list; index 0 is always the child. */
export function buildPlayers(count: number): Player[] {
  const players: Player[] = [{ id: 'child', kind: 'child', name: 'You', emoji: '🙂' }]
  for (let i = 0; i < count - 1; i++) {
    const p = PEER_ROSTER[i % PEER_ROSTER.length]
    players.push({ id: `peer-${i + 1}`, kind: 'peer', name: p.name, emoji: p.emoji })
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
  for (let r = 0; r < config.rounds; r++) {
    for (const playerIndex of shuffled(players.length, rng)) {
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
