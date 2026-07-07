import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_COUNT,
  EASY_CHOICES,
  NAME_CHOICES,
  buildLevel,
  scoreLevel,
  type Activity,
} from './logic'

// Deterministic PRNG (mulberry32) so builds are reproducible in tests.
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Aggregate activities across many seeds so probabilistic checks are stable.
function buildMany(difficulty: 'easy' | 'medium' | 'hard'): Activity[] {
  const all: Activity[] = []
  for (let s = 1; s <= 40; s++) all.push(...buildLevel(difficulty, seeded(s)))
  return all
}

describe('buildLevel', () => {
  it('produces at least ACTIVITY_COUNT activities per level', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(buildLevel(d, seeded(1)).length).toBeGreaterThanOrEqual(ACTIVITY_COUNT)
    }
  })

  it('is deterministic for a given seed', () => {
    expect(buildLevel('hard', seeded(7))).toEqual(buildLevel('hard', seeded(7)))
  })

  it('easy uses only single-person faces with exactly EASY_CHOICES options', () => {
    for (const a of buildMany('easy')) {
      expect(a.kind).toBe('single')
      if (a.kind === 'single') {
        expect(a.choices).toHaveLength(EASY_CHOICES)
        expect(a.choices).toContain(a.emotion) // the answer is always present
      }
    }
  })

  it('moderate mixes single + two-person images and both group question types', () => {
    const acts = buildMany('medium')
    expect(acts.some((a) => a.kind === 'single')).toBe(true)
    expect(acts.some((a) => a.kind === 'whoFeels')).toBe(true)
    expect(acts.some((a) => a.kind === 'nameFace')).toBe(true)
    // Never a three-person photo at moderate.
    for (const a of acts) {
      if (a.kind !== 'single') expect(a.photo.emotions.length).toBe(2)
    }
  })

  it('hard includes three-person photos', () => {
    const acts = buildMany('hard')
    expect(acts.some((a) => a.kind !== 'single' && a.photo.emotions.length === 3)).toBe(true)
  })

  it('name questions offer NAME_CHOICES options including the answer', () => {
    for (const a of buildMany('hard')) {
      if (a.kind === 'nameFace') {
        expect(a.choices).toHaveLength(NAME_CHOICES)
        expect(a.choices).toContain(a.answer)
        expect(a.answer).toBe(a.photo.emotions[a.position])
      }
    }
  })

  it('whoFeels answerIndex points at the target emotion', () => {
    for (const a of buildMany('hard')) {
      if (a.kind === 'whoFeels') {
        expect(a.photo.emotions[a.answerIndex]).toBe(a.targetEmotion)
      }
    }
  })
})

describe('scoreLevel', () => {
  it('marks pass at ≥70% and mastery at ≥80%', () => {
    expect(scoreLevel(6, 10)).toMatchObject({ passed: false, mastered: false }) // 60%
    expect(scoreLevel(7, 10)).toMatchObject({ passed: true, mastered: false }) // 70%
    expect(scoreLevel(8, 10)).toMatchObject({ passed: true, mastered: true }) // 80%
  })

  it('reports correct/incorrect/accuracy', () => {
    const s = scoreLevel(7, 10)
    expect(s).toMatchObject({ correct: 7, incorrect: 3, total: 10 })
    expect(s.accuracy).toBeCloseTo(0.7)
  })
})
