import { describe, it, expect } from 'vitest'
import {
  BLOCK_H,
  CONFIG,
  PEER_STAND_RADIUS,
  TABLE_H,
  TABLE_R,
  TABLE_RADIUS,
  TOWER_BEARING,
  TOWER_MAX,
  blockY,
  buildPlayers,
  starsFor,
  makeSequence,
  peerBearingDeg,
  peerPosition,
} from './logic'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('playroom360 logic (same rotation as Block Buddies)', () => {
  it('buildPlayers puts the child first and fills peers', () => {
    const players = buildPlayers(4)
    expect(players).toHaveLength(4)
    expect(players[0].kind).toBe('child')
    expect(players.slice(1).every((p) => p.kind === 'peer')).toBe(true)
  })

  it('makeSequence has players*rounds turns', () => {
    const cfg = CONFIG.medium
    const seq = makeSequence(cfg, buildPlayers(cfg.players), seeded(1))
    expect(seq).toHaveLength(cfg.players * cfg.rounds)
  })

  it('the child takes exactly one turn per round', () => {
    const cfg = CONFIG.hard
    const players = buildPlayers(cfg.players)
    const seq = makeSequence(cfg, players, seeded(2))
    for (let r = 0; r < cfg.rounds; r++) {
      const round = seq.slice(r * cfg.players, (r + 1) * cfg.players)
      expect(round.filter((t) => t.kind === 'child')).toHaveLength(1)
      // every player appears exactly once per round
      const idxs = round.map((t) => t.playerIndex).sort()
      expect(idxs).toEqual([...Array(cfg.players).keys()])
    }
  })

  it('non-shuffle configs use the same fixed rotation every round', () => {
    const cfg = CONFIG.easy
    expect(cfg.shuffle).toBe(false)
    const players = buildPlayers(cfg.players)
    const seq = makeSequence(cfg, players, seeded(4))
    const firstRound = seq.slice(0, cfg.players).map((t) => t.playerIndex)
    expect(firstRound).toEqual([...Array(cfg.players).keys()])
    for (let r = 1; r < cfg.rounds; r++) {
      const round = seq.slice(r * cfg.players, (r + 1) * cfg.players).map((t) => t.playerIndex)
      expect(round).toEqual(firstRound)
    }
  })

  it('difficulty ladder matches Block Buddies (players/rounds/shuffle)', () => {
    expect(CONFIG.easy).toMatchObject({ players: 3, rounds: 5, shuffle: false })
    expect(CONFIG.medium).toMatchObject({ players: 4, rounds: 7, shuffle: false })
    expect(CONFIG.hard).toMatchObject({ players: 5, rounds: 10, shuffle: true })
    // every level places blocks with a single tap — no grab-and-drag anywhere
    expect(Object.values(CONFIG).some((c) => 'grab' in c)).toBe(false)
  })

  it('blocks stack on the table top by BLOCK_H', () => {
    expect(blockY(0)).toBeCloseTo(TABLE_H + BLOCK_H / 2)
    expect(blockY(2)).toBeCloseTo(TABLE_H + BLOCK_H / 2 + 2 * BLOCK_H)
  })

  it('every friend gathers at the table, in the front half-circle, clear of the tower', () => {
    for (const players of [3, 4, 5]) {
      for (let i = 1; i < players; i++) {
        const [x, z] = peerPosition(i, players)
        // stands at the table rim: their distance to the table centre is the
        // stand radius, so they never drift far out to the sides
        const distToTableCentre = Math.hypot(x - 0, z - -TABLE_RADIUS)
        expect(distToTableCentre).toBeCloseTo(PEER_STAND_RADIUS)
        expect(distToTableCentre - TABLE_R).toBeLessThan(0.7) // close to the edge
        // and stays in the child's front view, not aligned behind the tower
        const bearing = peerBearingDeg(i, players)
        expect(Math.abs(bearing)).toBeLessThanOrEqual(45)
        expect(Math.abs(bearing - TOWER_BEARING)).toBeGreaterThanOrEqual(5)
      }
    }
  })

  it('a full tower stays below a friend’s face height', () => {
    const towerTop = blockY(TOWER_MAX - 1) + BLOCK_H / 2
    expect(towerTop).toBeLessThan(1.45) // kid head top in the scene
  })

  it('peerPosition puts the middle friend straight ahead, child at the origin', () => {
    expect(peerPosition(0, 4)).toEqual([0, 0])
    const [x, z] = peerPosition(2, 4) // middle friend of 3, straight ahead
    expect(peerBearingDeg(2, 4)).toBe(0)
    expect(x).toBeCloseTo(0)
    expect(z).toBeLessThan(0) // in front of the child
  })
})

describe('stars reward waiting, not placing', () => {
  it('gives three stars for a session with no out-of-turn taps', () => {
    // 10 rounds on Hard, every action in turn
    expect(starsFor(10, 10)).toBe(3)
  })

  it('scales tolerance with session length', () => {
    // Easy is 5 rounds: one slip still clears 80%, two does not
    expect(starsFor(5, 6)).toBe(3)
    expect(starsFor(5, 7)).toBe(2)
    // Hard is 10 rounds: two slips clear it, three do not
    expect(starsFor(10, 12)).toBe(3)
    expect(starsFor(10, 13)).toBe(2)
  })

  it('never drops below one star, however impatient the child was', () => {
    expect(starsFor(5, 50)).toBe(1)
    expect(starsFor(0, 0)).toBe(1) // degenerate: no actions at all
  })

  /**
   * The point of the measure: placements alone are fixed by the rotation, so
   * every session would look identical. Only the impatient taps separate them.
   */
  it('does not vary with rounds played when nothing was rushed', () => {
    expect(starsFor(5, 5)).toBe(starsFor(10, 10))
  })
})
