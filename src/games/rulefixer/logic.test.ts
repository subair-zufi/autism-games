import { expect, test } from 'vitest'
import type { Difficulty } from '../../types'
import {
  ACTIVITY_COUNT,
  buildLevel,
  levelChance,
  OPTION_ROLES,
  tallyByConstruct,
  trialChance,
  CONSTRUCTS,
  SITUATIONS,
} from './logic'
import { situationsFor } from './content'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

// --- item bank ---------------------------------------------------------------

test('situation and option ids are unique', () => {
  expect(new Set(SITUATIONS.map((s) => s.id)).size).toBe(SITUATIONS.length)
  const optionIds = SITUATIONS.flatMap((s) => s.options.map((o) => o.id))
  expect(new Set(optionIds).size).toBe(optionIds.length)
})

test('every situation has exactly one option of each graded role', () => {
  for (const s of SITUATIONS) {
    expect(s.options).toHaveLength(3)
    for (const role of ['kind', 'passive', 'wrong'] as const) {
      expect(s.options.filter((o) => o.role === role)).toHaveLength(1)
    }
  }
})

test('every construct has exactly 8 situations', () => {
  for (const construct of CONSTRUCTS) {
    expect(situationsFor(construct)).toHaveLength(8)
  }
})

test('all child-facing text is present in both languages', () => {
  for (const s of SITUATIONS) {
    expect(s.text.en.length).toBeGreaterThan(0)
    expect(s.text.ml.length).toBeGreaterThan(0)
    for (const o of s.options) {
      expect(o.emoji.length).toBeGreaterThan(0)
      for (const lang of ['en', 'ml'] as const) {
        expect(o.label[lang].length).toBeGreaterThan(0)
        expect(o.result[lang].length).toBeGreaterThan(0)
      }
    }
  }
})

// --- level construction --------------------------------------------------------

test('a level has 10 unique trials, two per construct', () => {
  const trials = buildLevel('medium')
  expect(trials).toHaveLength(ACTIVITY_COUNT)
  const ids = trials.map((t) => t.situation.id)
  expect(new Set(ids).size).toBe(ACTIVITY_COUNT)
  for (const construct of CONSTRUCTS) {
    expect(trials.filter((t) => t.situation.construct === construct)).toHaveLength(2)
  }
})

test('repeated builds rotate through all eight situations of every construct', () => {
  // A level samples 2 of each construct's 8 banked situations. Across many
  // builds every situation must appear, so sessions accumulate per-construct
  // evidence on different items instead of replaying a fixed set.
  const seen = new Set<string>()
  for (let i = 0; i < 200; i++) {
    for (const t of buildLevel('medium')) seen.add(t.situation.id)
  }
  for (const construct of CONSTRUCTS) {
    for (const s of situationsFor(construct)) {
      expect(seen.has(s.id)).toBe(true)
    }
  }
})

test('constructs are stratified: each appears once per half', () => {
  for (let i = 0; i < 20; i++) {
    const trials = buildLevel('easy')
    const half = CONSTRUCTS.length
    const firstHalf = trials.slice(0, half).map((t) => t.situation.construct)
    const secondHalf = trials.slice(half).map((t) => t.situation.construct)
    expect(new Set(firstHalf).size).toBe(half)
    expect(new Set(secondHalf).size).toBe(half)
  }
})

test('each level shows exactly its role subset, always including kind', () => {
  for (const d of DIFFS) {
    const trials = buildLevel(d)
    for (const t of trials) {
      expect(t.choices).toHaveLength(OPTION_ROLES[d].length)
      expect(new Set(t.choices.map((o) => o.role))).toEqual(new Set(OPTION_ROLES[d]))
    }
  }
})

test('hard forces the kind-vs-passive discrimination (no obvious wrong)', () => {
  for (const t of buildLevel('hard')) {
    expect(t.choices.some((o) => o.role === 'wrong')).toBe(false)
  }
})

test('deterministic with a seeded rng', () => {
  const a = buildLevel('medium', rng([0.3, 0.6, 0.1, 0.9, 0.42]))
  const b = buildLevel('medium', rng([0.3, 0.6, 0.1, 0.9, 0.42]))
  expect(a.map((t) => t.situation.id)).toEqual(b.map((t) => t.situation.id))
  expect(a.map((t) => t.choices.map((o) => o.id))).toEqual(
    b.map((t) => t.choices.map((o) => o.id)),
  )
})

// --- chance levels --------------------------------------------------------------

test('chance is 1/2 on easy and hard, 1/3 on medium', () => {
  expect(levelChance(buildLevel('easy'))).toBeCloseTo(1 / 2)
  expect(levelChance(buildLevel('medium'))).toBeCloseTo(1 / 3)
  expect(levelChance(buildLevel('hard'))).toBeCloseTo(1 / 2)
  for (const t of buildLevel('medium')) expect(trialChance(t)).toBeCloseTo(1 / 3)
})

// --- per-construct tally ---------------------------------------------------------

test('tallyByConstruct counts correct/total per construct', () => {
  const tally = tallyByConstruct([
    { construct: 'helping', correct: true },
    { construct: 'helping', correct: false },
    { construct: 'fairness', correct: true },
  ])
  expect(tally.helping).toEqual({ correct: 1, total: 2 })
  expect(tally.fairness).toEqual({ correct: 1, total: 1 })
  expect(tally.inclusion).toEqual({ correct: 0, total: 0 })
})
