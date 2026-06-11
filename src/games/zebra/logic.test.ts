import { expect, test } from 'vitest'
import {
  LEVELS,
  PHASE_ORDER,
  advanceTraffic,
  canWalk,
  carsStopped,
  initialTraffic,
  nextPhase,
  phaseDuration,
  type LightPhase,
} from './logic'

test('the cycle starts on cars-go', () => {
  expect(initialTraffic()).toEqual({ phase: 'cars-go', t: 0 })
})

test('phases cycle in a fixed loop', () => {
  expect(nextPhase('cars-go')).toBe('cars-slow')
  expect(nextPhase('cars-slow')).toBe('walk')
  expect(nextPhase('walk')).toBe('walk-ending')
  expect(nextPhase('walk-ending')).toBe('cars-go')
})

test('it is only safe to walk while the walk signal is lit', () => {
  expect(canWalk('cars-go')).toBe(false)
  expect(canWalk('cars-slow')).toBe(false)
  expect(canWalk('walk')).toBe(true)
  expect(canWalk('walk-ending')).toBe(true)
})

test('cars are stopped exactly when it is safe to walk', () => {
  for (const p of PHASE_ORDER) {
    expect(carsStopped(p)).toBe(canWalk(p))
  }
})

test('advancing within a phase only moves the clock forward', () => {
  const d = LEVELS.easy.durations
  const s = advanceTraffic({ phase: 'cars-go', t: 0 }, 1, d)
  expect(s.phase).toBe('cars-go')
  expect(s.t).toBeCloseTo(1)
})

test('advancing past a phase rolls into the next one', () => {
  const d = LEVELS.easy.durations
  const s = advanceTraffic({ phase: 'cars-go', t: 0 }, d['cars-go'] + 0.5, d)
  expect(s.phase).toBe('cars-slow')
  expect(s.t).toBeCloseTo(0.5)
})

test('a very large dt is handled without looping unbounded', () => {
  const d = LEVELS.medium.durations
  const total = PHASE_ORDER.reduce((sum, p) => sum + phaseDuration(p, d), 0)
  // two full cycles plus a little
  const s = advanceTraffic({ phase: 'cars-go', t: 0 }, total * 2 + 1, d)
  expect(PHASE_ORDER).toContain(s.phase)
  expect(s.t).toBeGreaterThanOrEqual(0)
  expect(s.t).toBeLessThan(phaseDuration(s.phase, d))
})

test('stepping through dt always lands every phase in order', () => {
  const d = LEVELS.hard.durations
  let state = initialTraffic()
  const seen: LightPhase[] = [state.phase]
  // small steps across a couple of cycles
  for (let i = 0; i < 4000; i++) {
    const before = state.phase
    state = advanceTraffic(state, 0.016, d)
    if (state.phase !== before) seen.push(state.phase)
  }
  // the observed transitions follow PHASE_ORDER cyclically
  for (let i = 1; i < seen.length; i++) {
    expect(seen[i]).toBe(nextPhase(seen[i - 1]))
  }
})

test('every level is configured sensibly', () => {
  for (const cfg of Object.values(LEVELS)) {
    expect(cfg.carCount).toBeGreaterThanOrEqual(3)
    expect(cfg.carSpeed).toBeGreaterThan(0)
    expect(cfg.goal).toBeGreaterThan(0)
    for (const p of PHASE_ORDER) {
      expect(cfg.durations[p]).toBeGreaterThan(0)
    }
    // the walk window must comfortably outlast a crossing
    expect(cfg.durations.walk).toBeGreaterThanOrEqual(3)
  }
})
