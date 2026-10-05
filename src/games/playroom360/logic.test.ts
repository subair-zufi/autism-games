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
  JITTER_LADDER,
  buildPlayers,
  inTurnRatio,
  jitterFloor,
  sessionAccuracy,
  starsFor,
  starsForAccuracy,
  makeSequence,
  peerBearingDeg,
  peerPosition,
  peerWaitMs,
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

  it('fades peer-wait jitter in with difficulty: none -> some -> more (review R3)', () => {
    expect(CONFIG.easy.jitter).toBe(0)
    expect(CONFIG.easy.jitter).toBeLessThan(CONFIG.medium.jitter)
    expect(CONFIG.medium.jitter).toBeLessThan(CONFIG.hard.jitter)
  })

  it('the adaptive jitter ladder floors each difficulty on its config jitter (R14)', () => {
    expect(JITTER_LADDER).toEqual([0, 0.2, 0.4])
    expect(jitterFloor('easy')).toBe(0)
    expect(jitterFloor('medium')).toBe(1)
    expect(jitterFloor('hard')).toBe(2)
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(JITTER_LADDER[jitterFloor(d)]).toBe(CONFIG[d].jitter)
    }
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

describe('R9 composite score — engagement, not just inhibition', () => {
  it('inTurnRatio is placements over all actions, 0 when none', () => {
    expect(inTurnRatio(10, 0)).toBe(1)
    expect(inTurnRatio(8, 2)).toBeCloseTo(0.8)
    expect(inTurnRatio(0, 0)).toBe(0)
  })

  it('starsForAccuracy uses the same 0.8 / 0.5 thresholds', () => {
    expect(starsForAccuracy(1)).toBe(3)
    expect(starsForAccuracy(0.8)).toBe(3)
    expect(starsForAccuracy(0.5)).toBe(2)
    expect(starsForAccuracy(0.49)).toBe(1)
  })

  it('a passive child (never taps out of turn, never watches) scores materially below an engaged one', () => {
    // passive: perfect inhibition but no attention at all
    const passive = sessionAccuracy({ placements: 10, impatientTaps: 0, peerWatch: 0 })
    // engaged: same inhibition AND watches the peers
    const engaged = sessionAccuracy({ placements: 10, impatientTaps: 0, peerWatch: 0.9 })
    expect(passive).toBeCloseTo(0.5) // was a perfect 1.0 under the old metric
    expect(engaged).toBeGreaterThan(0.9)
    // and that difference is material in the reward the child sees
    expect(starsForAccuracy(passive)).toBe(2)
    expect(starsForAccuracy(engaged)).toBe(3)
  })

  it('a dysregulated child (out-of-turn taps and no watching) scores lowest', () => {
    const acc = sessionAccuracy({ placements: 6, impatientTaps: 6, peerWatch: 0.1 })
    expect(acc).toBeLessThan(0.5)
    expect(starsForAccuracy(acc)).toBe(1)
  })

  it('clamps an out-of-range watch proportion', () => {
    expect(sessionAccuracy({ placements: 10, impatientTaps: 0, peerWatch: 2 })).toBeCloseTo(1)
    expect(sessionAccuracy({ placements: 10, impatientTaps: 0, peerWatch: -1 })).toBeCloseTo(0.5)
  })
})

describe('peerWaitMs jitters the peer think-time (review R3)', () => {
  it('returns the base unchanged when jitter is 0 (easy is predictable)', () => {
    const rng = seeded(1)
    for (let i = 0; i < 20; i++) expect(peerWaitMs(1300, 0, rng)).toBe(1300)
  })

  it('stays within the +/- band for the base', () => {
    const rng = seeded(9)
    for (let i = 0; i < 500; i++) {
      const w = peerWaitMs(2400, 0.4, rng)
      expect(w).toBeGreaterThanOrEqual(Math.round(2400 * 0.6))
      expect(w).toBeLessThanOrEqual(Math.round(2400 * 1.4))
    }
  })

  it('actually varies across draws at hard (not a fixed interval)', () => {
    const rng = seeded(3)
    const draws = new Set(Array.from({ length: 30 }, () => peerWaitMs(2400, 0.4, rng)))
    expect(draws.size).toBeGreaterThan(1)
  })
})
