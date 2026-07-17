import { describe, expect, it } from 'vitest'
import {
  CONFIG,
  POINTS,
  STRATEGIES,
  TRIGGERS,
  makeRound,
  meterStep,
  namingOptions,
  pointsFor,
  starsFor,
  strategyFit,
  strategySteps,
  triggerMeta,
} from './logic'

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('triggers', () => {
  it('every trigger names a feeling, distractors and an intensity in range', () => {
    for (const tr of TRIGGERS) {
      expect(tr.intensity).toBeGreaterThan(CONFIG.hard.calmThreshold)
      expect(tr.intensity).toBeLessThanOrEqual(100)
      expect(tr.distractors).not.toContain(tr.feeling)
      expect(tr.distractors.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('bestFit only ever lists coping actions, never the universal tools', () => {
    for (const tr of TRIGGERS) {
      expect(tr.bestFit).not.toContain('breathe')
      expect(tr.bestFit).not.toContain('count')
    }
  })
})

describe('strategyFit', () => {
  const anyTrigger = triggerMeta('waiting') // has no coping fit
  it('breathing and counting always fit', () => {
    for (const tr of TRIGGERS) {
      expect(strategyFit(tr, 'breathe')).toBe('good')
      expect(strategyFit(tr, 'count')).toBe('good')
    }
  })

  it('a coping action fits only when the situation lists it', () => {
    const broke = triggerMeta('brokeToy') // bestFit: ['ask']
    expect(strategyFit(broke, 'ask')).toBe('good')
    expect(strategyFit(broke, 'walk')).toBe('ok')
    expect(strategyFit(anyTrigger, 'squeeze')).toBe('ok')
  })
})

describe('naming options', () => {
  it('always includes the true feeling and matches the level count', () => {
    const rng = seededRng(7)
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const cfg = CONFIG[level]
      for (const tr of TRIGGERS) {
        const opts = namingOptions(tr, cfg, rng)
        expect(opts).toContain(tr.feeling)
        expect(opts.length).toBe(cfg.namingChoices)
        expect(new Set(opts).size).toBe(opts.length) // no duplicates
      }
    }
  })
})

describe('meter pacing', () => {
  it('the authored steps take a full-intensity feeling down to the calm line', () => {
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const cfg = CONFIG[level]
      for (const kind of ['breath', 'count', 'quick'] as const) {
        const steps = strategySteps(kind, cfg)
        const drop = meterStep(100, steps, cfg)
        expect(drop * steps).toBeGreaterThanOrEqual(100 - cfg.calmThreshold)
      }
    }
  })

  it('each step always lowers the meter by at least 1', () => {
    // a low-intensity feeling with many steps still shows visible progress
    expect(meterStep(CONFIG.hard.calmThreshold, 10, CONFIG.hard)).toBeGreaterThanOrEqual(1)
  })
})

describe('scoring', () => {
  it('calming always pays; naming and fit only add', () => {
    expect(pointsFor(false, 'ok')).toBe(POINTS.regulate)
    expect(pointsFor(true, 'ok')).toBe(POINTS.regulate + POINTS.named)
    expect(pointsFor(false, 'good')).toBe(POINTS.regulate + POINTS.fitBonus)
    expect(pointsFor(true, 'good')).toBe(POINTS.regulate + POINTS.named + POINTS.fitBonus)
  })

  it('stars scale with the fraction of clean rounds', () => {
    expect(starsFor(6, 6)).toBe(3)
    expect(starsFor(4, 6)).toBe(2)
    expect(starsFor(1, 6)).toBe(1)
    expect(starsFor(0, 6)).toBe(1)
  })
})

describe('makeRound', () => {
  it('never repeats the previous situation', () => {
    const rng = seededRng(3)
    let prev = makeRound(null, CONFIG.easy, rng)
    for (let i = 0; i < 40; i++) {
      const next = makeRound(prev.trigger.id, CONFIG.easy, rng)
      expect(next.trigger.id).not.toBe(prev.trigger.id)
      prev = next
    }
  })
})

describe('toolkit', () => {
  it('offers exactly the two universal skills plus three coping actions', () => {
    expect(STRATEGIES.map((s) => s.id).sort()).toEqual(['ask', 'breathe', 'count', 'squeeze', 'walk'])
  })
})
