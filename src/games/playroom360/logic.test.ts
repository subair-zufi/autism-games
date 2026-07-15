import { describe, it, expect } from 'vitest'
import {
  BLOCK_H,
  CONFIG,
  PEER_BEARINGS,
  TABLE_H,
  TOWER_BEARING,
  TOWER_MAX,
  blockY,
  buildPlayers,
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

  it('difficulty ladder matches Block Buddies exactly', () => {
    expect(CONFIG.easy).toMatchObject({ players: 3, rounds: 5, shuffle: false, grab: false })
    expect(CONFIG.medium).toMatchObject({ players: 4, rounds: 7, shuffle: false, grab: false })
    expect(CONFIG.hard).toMatchObject({ players: 5, rounds: 10, shuffle: true, grab: true })
  })

  it('blocks stack on the table top by BLOCK_H', () => {
    expect(blockY(0)).toBeCloseTo(TABLE_H + BLOCK_H / 2)
    expect(blockY(2)).toBeCloseTo(TABLE_H + BLOCK_H / 2 + 2 * BLOCK_H)
  })

  it('every friend stands in the front half-circle, clear of the tower', () => {
    for (const bearings of Object.values(PEER_BEARINGS)) {
      for (const b of bearings) {
        expect(Math.abs(b)).toBeLessThanOrEqual(70) // never behind the child
        expect(Math.abs(b - TOWER_BEARING)).toBeGreaterThanOrEqual(10) // never behind the tower
      }
    }
  })

  it('a full tower stays below a friend’s face height', () => {
    const towerTop = blockY(TOWER_MAX - 1) + BLOCK_H / 2
    expect(towerTop).toBeLessThan(1.45) // kid head top in the scene
  })

  it('peerPosition puts friends at their bearings, child at the origin', () => {
    expect(peerPosition(0, 4)).toEqual([0, 0])
    const [x, z] = peerPosition(2, 4) // middle friend of 3, bearing 0
    expect(peerBearingDeg(2, 4)).toBe(0)
    expect(x).toBeCloseTo(0)
    expect(z).toBeLessThan(0) // straight ahead
  })
})
