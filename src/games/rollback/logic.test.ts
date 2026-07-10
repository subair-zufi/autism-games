import { describe, it, expect } from 'vitest'
import {
  CONFIG,
  GOAL,
  POINTS,
  STREAK_LEN,
  buildPlayers,
  makeSequence,
  classifyReturn,
  pointsFor,
  starsFor,
  type Rally,
} from './logic'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('rollback logic (reciprocal turn-taking)', () => {
  it('buildPlayers puts the child first and fills partners', () => {
    const players = buildPlayers(3)
    expect(players).toHaveLength(4)
    expect(players[0].kind).toBe('child')
    expect(players[0].id).toBe('child')
    expect(players.slice(1).every((p) => p.kind === 'peer')).toBe(true)
  })

  it('the cue fades verbal → gesture → orient across the ladder', () => {
    expect(CONFIG.easy.cue).toBe('verbal')
    expect(CONFIG.medium.cue).toBe('gesture')
    expect(CONFIG.hard.cue).toBe('orient')
  })

  it('only hard mode asks the child to initiate rallies', () => {
    expect(CONFIG.easy.selfInitiate).toBe(false)
    expect(CONFIG.medium.selfInitiate).toBe(false)
    expect(CONFIG.hard.selfInitiate).toBe(true)
  })

  it('GOAL matches the rally count per difficulty', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(GOAL[d]).toBe(CONFIG[d].rounds)
    }
  })

  it('makeSequence has one rally per round', () => {
    const cfg = CONFIG.medium
    const seq = makeSequence(cfg, buildPlayers(cfg.partners), seeded(1))
    expect(seq).toHaveLength(cfg.rounds)
  })

  it('every rally targets a partner and lists the rest as distractors', () => {
    const cfg = CONFIG.hard
    const players = buildPlayers(cfg.partners)
    const seq = makeSequence(cfg, players, seeded(2))
    for (const rally of seq) {
      expect(rally.to).toBeGreaterThanOrEqual(1)
      expect(rally.to).toBeLessThan(players.length)
      expect(rally.distractors).not.toContain(rally.to)
      expect([rally.to, ...rally.distractors].sort()).toEqual(
        players.map((_, i) => i).filter((i) => i >= 1),
      )
    }
  })

  it('the ready partner never repeats back-to-back when there is a choice', () => {
    const cfg = CONFIG.hard
    const seq = makeSequence(cfg, buildPlayers(cfg.partners), seeded(3))
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i].to).not.toBe(seq[i - 1].to)
    }
  })

  it('easy mode degenerates to a clean dyad (single partner, no traps)', () => {
    const cfg = CONFIG.easy
    const seq = makeSequence(cfg, buildPlayers(cfg.partners), seeded(4))
    expect(seq.every((r) => r.to === 1)).toBe(true)
    expect(seq.every((r) => r.distractors.length === 0)).toBe(true)
    expect(seq.every((r) => !r.initiate)).toBe(true)
  })

  it('hard mode mixes child-initiated rallies in (from = -1 iff initiate)', () => {
    const cfg = CONFIG.hard
    const players = buildPlayers(cfg.partners)
    const seq = makeSequence(cfg, players, seeded(5))
    expect(seq.some((r) => r.initiate)).toBe(true)
    expect(seq.some((r) => !r.initiate)).toBe(true)
    for (const rally of seq) {
      if (rally.initiate) expect(rally.from).toBe(-1)
      else {
        expect(rally.from).toBeGreaterThanOrEqual(1)
        expect(rally.from).toBeLessThan(players.length)
      }
    }
  })

  it('classifyReturn separates premature, wrong-partner, and correct', () => {
    const rally: Rally = { from: 2, to: 1, distractors: [2, 3], initiate: false }
    // any roll before the ready cue is premature, even to the right partner
    expect(classifyReturn(rally, 1, false)).toBe('premature')
    expect(classifyReturn(rally, 3, false)).toBe('premature')
    expect(classifyReturn(rally, 1, true)).toBe('correct')
    expect(classifyReturn(rally, 2, true)).toBe('wrong-partner')
  })

  it('pointsFor rewards first attempts more, retries a little, streaks extra', () => {
    expect(pointsFor(false, 0)).toBe(POINTS.retry)
    expect(pointsFor(true, 1)).toBe(POINTS.first)
    expect(pointsFor(true, STREAK_LEN)).toBe(POINTS.first + POINTS.streakBonus)
  })

  it('starsFor mirrors the lives-kept convention', () => {
    expect(starsFor(true, 3)).toBe(3)
    expect(starsFor(true, 2)).toBe(2)
    expect(starsFor(true, 1)).toBe(1)
    expect(starsFor(false, 0)).toBe(1)
  })
})
