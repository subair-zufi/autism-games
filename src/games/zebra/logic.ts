import type { Difficulty } from '../../types'

/**
 * Traffic-light state machine for the Zebra Crossing game.
 *
 * The light cycles continuously through four phases. Cars only move during
 * `cars-go`; during `cars-slow` (yellow) they roll to a stop, and through the
 * two walk phases they wait at the line. It is only safe to cross while the
 * walk signal is lit (`walk` / `walk-ending`). All of this is pure so it can be
 * unit-tested without a 3D scene.
 */
export type LightPhase = 'cars-go' | 'cars-slow' | 'walk' | 'walk-ending'

/** Order the phases cycle in, forever. */
export const PHASE_ORDER: LightPhase[] = ['cars-go', 'cars-slow', 'walk', 'walk-ending']

/** Seconds each phase lasts. */
export interface PhaseDurations {
  'cars-go': number
  'cars-slow': number
  walk: number
  'walk-ending': number
}

export interface LevelConfig {
  durations: PhaseDurations
  /** how many cars circulate on the road */
  carCount: number
  /** car travel speed (world units / second) */
  carSpeed: number
  /** successful crossings needed to finish a session */
  goal: number
}

export const LEVELS: Record<Difficulty, LevelConfig> = {
  easy: {
    durations: { 'cars-go': 6, 'cars-slow': 2.2, walk: 6, 'walk-ending': 2.2 },
    carCount: 3,
    carSpeed: 2.6,
    goal: 5,
  },
  medium: {
    durations: { 'cars-go': 6, 'cars-slow': 1.8, walk: 4.5, 'walk-ending': 1.8 },
    carCount: 4,
    carSpeed: 3.6,
    goal: 6,
  },
  hard: {
    durations: { 'cars-go': 5.5, 'cars-slow': 1.5, walk: 3.2, 'walk-ending': 1.6 },
    carCount: 5,
    carSpeed: 4.6,
    goal: 8,
  },
}

export interface TrafficState {
  phase: LightPhase
  /** seconds elapsed within the current phase */
  t: number
}

export function initialTraffic(): TrafficState {
  return { phase: 'cars-go', t: 0 }
}

export function phaseDuration(phase: LightPhase, d: PhaseDurations): number {
  return d[phase]
}

export function nextPhase(phase: LightPhase): LightPhase {
  const i = PHASE_ORDER.indexOf(phase)
  return PHASE_ORDER[(i + 1) % PHASE_ORDER.length]
}

/**
 * Advance the light by `dt` seconds, rolling over into following phases as
 * needed. Guarded against very large `dt` (e.g. a backgrounded tab) so it can
 * never loop unbounded. Pure: returns a new state, mutates nothing.
 */
export function advanceTraffic(state: TrafficState, dt: number, d: PhaseDurations): TrafficState {
  let phase = state.phase
  let t = state.t + Math.max(0, dt)
  let guard = 0
  while (t >= phaseDuration(phase, d) && guard < 1000) {
    t -= phaseDuration(phase, d)
    phase = nextPhase(phase)
    guard++
  }
  return { phase, t }
}

/** Cars are stopped (and the crossing is clear) only during the walk phases. */
export function carsStopped(phase: LightPhase): boolean {
  return phase === 'walk' || phase === 'walk-ending'
}

/** Safe to step onto the crossing only while the walk signal is lit. */
export function canWalk(phase: LightPhase): boolean {
  return carsStopped(phase)
}
