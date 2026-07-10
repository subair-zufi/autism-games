import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_COUNT,
  COMPOSITION,
  EASY_CHOICES,
  NAME_CHOICES,
  activityChance,
  buildLevel,
  levelChance,
  scoreLevel,
  type Activity,
} from './logic'
import { ALL_EMOTION_IDS, CONFUSABLE_WITH, type EmotionId } from '../emotionVocab'

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

/** The emotion the learner must identify in an activity. */
function targetOf(a: Activity): EmotionId {
  if (a.kind === 'single') return a.emotion
  if (a.kind === 'whoFeels') return a.targetEmotion
  return a.answer
}

describe('buildLevel', () => {
  it('produces exactly ACTIVITY_COUNT activities per training level', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      expect(buildLevel(d, seeded(1)).length).toBe(ACTIVITY_COUNT)
    }
  })

  it('is deterministic for a given seed', () => {
    expect(buildLevel('hard', seeded(7))).toEqual(buildLevel('hard', seeded(7)))
  })

  it('follows the fixed per-level composition quotas', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      for (let s = 1; s <= 10; s++) {
        const acts = buildLevel(d, seeded(s))
        const counts = { single: 0, two: 0, three: 0 }
        for (const a of acts) {
          if (a.kind === 'single') counts.single++
          else if (a.photo.emotions.length === 2) counts.two++
          else counts.three++
        }
        expect(counts).toEqual(COMPOSITION[d])
      }
    }
  })

  it('covers every emotion as a target in every level attempt', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      for (let s = 1; s <= 10; s++) {
        const targets = new Set(buildLevel(d, seeded(s)).map(targetOf))
        for (const id of ALL_EMOTION_IDS) expect(targets).toContain(id)
      }
    }
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

  it('easy distractors are never confusable with the answer', () => {
    for (const a of buildMany('easy')) {
      if (a.kind === 'single') {
        for (const c of a.choices) {
          if (c !== a.emotion) expect(CONFUSABLE_WITH[a.emotion]).not.toContain(c)
        }
      }
    }
  })

  it('hard single-face choices always include a confusable distractor', () => {
    for (const a of buildMany('hard')) {
      if (a.kind === 'single') {
        const confusable = a.choices.filter((c) => CONFUSABLE_WITH[a.emotion].includes(c))
        expect(confusable.length).toBeGreaterThanOrEqual(1)
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
        expect(new Set(a.choices).size).toBe(a.choices.length)
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

  it('probe pool uses only held-out stimuli', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      for (let s = 1; s <= 10; s++) {
        const acts = buildLevel(d, seeded(s), 'probe')
        expect(acts.length).toBeGreaterThan(0)
        for (const a of acts) {
          if (a.kind === 'single') {
            // Held-out singles exist for happy/sad/angry only (see content.ts).
            expect(['happy', 'sad', 'angry']).toContain(a.emotion)
          } else {
            expect(a.photo.probe).toBe(true)
          }
        }
      }
    }
  })
})

describe('scoring', () => {
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

  it('corrects accuracy for guessing', () => {
    // 7/10 with 2 choices: chance 0.5 → adjusted (0.7 − 0.5)/0.5 = 0.4
    expect(scoreLevel(7, 10, 0.5).adjustedAccuracy).toBeCloseTo(0.4)
    // At-chance performance adjusts to 0, and never goes negative.
    expect(scoreLevel(5, 10, 0.5).adjustedAccuracy).toBe(0)
    expect(scoreLevel(3, 10, 0.5).adjustedAccuracy).toBe(0)
  })

  it('activity chance reflects the number of options', () => {
    for (const a of buildMany('hard')) {
      if (a.kind === 'whoFeels') expect(activityChance(a)).toBeCloseTo(1 / a.photo.emotions.length)
      else expect(activityChance(a)).toBeCloseTo(1 / a.choices.length)
    }
    const easy = buildLevel('easy', seeded(3))
    expect(levelChance(easy)).toBeCloseTo(1 / EASY_CHOICES) // all 2-choice items
  })
})
