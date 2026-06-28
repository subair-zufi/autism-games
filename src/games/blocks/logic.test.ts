import { describe, it, expect } from 'vitest'
import { CONFIG, buildPlayers, makeSequence, blockY, BLOCK_H } from './logic'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('blocks logic (multi-peer)', () => {
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

  it('the child slot varies across rounds (not always first)', () => {
    const cfg = CONFIG.hard
    const players = buildPlayers(cfg.players)
    const seq = makeSequence(cfg, players, seeded(3))
    const childSlots: number[] = []
    for (let r = 0; r < cfg.rounds; r++) {
      const round = seq.slice(r * cfg.players, (r + 1) * cfg.players)
      childSlots.push(round.findIndex((t) => t.kind === 'child'))
    }
    expect(new Set(childSlots).size).toBeGreaterThan(1)
  })

  it('blockY stacks by BLOCK_H', () => {
    expect(blockY(0)).toBeCloseTo(BLOCK_H / 2)
    expect(blockY(2)).toBeCloseTo(BLOCK_H / 2 + 2 * BLOCK_H)
  })
})
