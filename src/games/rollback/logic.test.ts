import { describe, it, expect } from 'vitest'
import {
  CONFIG,
  GOAL,
  CUE_LADDER,
  POINTS,
  STREAK_LEN,
  buildInitiateSchedule,
  buildPlayers,
  makeSequence,
  classifyReturn,
  cueFloor,
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

  it('the adaptive cue ladder floors each difficulty on its config cue (R14)', () => {
    expect(CUE_LADDER).toEqual(['verbal', 'gesture', 'orient'])
    expect(cueFloor('easy')).toBe(0)
    expect(cueFloor('medium')).toBe(1)
    expect(cueFloor('hard')).toBe(2)
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(CUE_LADDER[cueFloor(d)]).toBe(CONFIG[d].cue)
    }
  })

  it('only hard mode asks the child to initiate rallies (a fixed count)', () => {
    expect(CONFIG.easy.initiateCount).toBe(0)
    expect(CONFIG.medium.initiateCount).toBe(0)
    expect(CONFIG.hard.initiateCount).toBeGreaterThan(0)
  })

  it('buildInitiateSchedule places exactly count rallies, evenly, never first (R5)', () => {
    const sched = buildInitiateSchedule(3, 10)
    expect(sched).toHaveLength(10)
    expect(sched.filter(Boolean)).toHaveLength(3)
    expect(sched[0]).toBe(false)
    const positions = sched.flatMap((v, i) => (v ? [i] : []))
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i] - positions[i - 1]).toBeGreaterThan(1)
    }
    expect(buildInitiateSchedule(99, 5).filter(Boolean)).toHaveLength(4)
    expect(buildInitiateSchedule(0, 10).some(Boolean)).toBe(false)
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

  it('hard mode has exactly the configured initiate count, never first (from = -1 iff initiate)', () => {
    const cfg = CONFIG.hard
    const players = buildPlayers(cfg.partners)
    const seq = makeSequence(cfg, players, seeded(5))
    expect(seq.filter((r) => r.initiate)).toHaveLength(cfg.initiateCount)
    expect(seq[0].initiate).toBe(false)
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
