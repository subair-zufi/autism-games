import { expect, test } from 'vitest'
import type { Difficulty } from '../../types'
import {
  ACTIVITY_COUNT,
  BEHAVIORS,
  buildLevel,
  CHANCE,
  CONSTRUCTS,
  LEVEL_TIERS,
  tallyByConstruct,
  tallyByValence,
} from './logic'
import { behaviorsFor, type Tier } from './content'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

const TIERS: Tier[] = ['clear', 'subtle']
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

// --- item bank ---------------------------------------------------------------

test('behavior ids are unique', () => {
  expect(new Set(BEHAVIORS.map((b) => b.id)).size).toBe(BEHAVIORS.length)
})

test('every construct × tier cell has exactly four okay and four not-okay items', () => {
  for (const construct of CONSTRUCTS) {
    const items = behaviorsFor(construct)
    expect(items).toHaveLength(16)
    for (const tier of TIERS) {
      expect(items.filter((b) => b.tier === tier && b.isFine)).toHaveLength(4)
      expect(items.filter((b) => b.tier === tier && !b.isFine)).toHaveLength(4)
    }
  }
})

test('all child-facing text is present in both languages', () => {
  for (const b of BEHAVIORS) {
    expect(b.bubble.length).toBeGreaterThan(0)
    for (const lang of ['en', 'ml'] as const) {
      expect(b.text[lang].length).toBeGreaterThan(0)
      expect(b.explain[lang].length).toBeGreaterThan(0)
    }
  }
})

// --- level construction --------------------------------------------------------

test('a level has 10 unique trials', () => {
  for (const d of DIFFS) {
    const trials = buildLevel(d)
    expect(trials).toHaveLength(ACTIVITY_COUNT)
    expect(new Set(trials.map((b) => b.id)).size).toBe(ACTIVITY_COUNT)
  }
})

test('every level is valence-balanced: 5 okay and 5 not-okay', () => {
  for (const d of DIFFS) {
    for (let i = 0; i < 10; i++) {
      const trials = buildLevel(d)
      expect(trials.filter((b) => b.isFine)).toHaveLength(5)
      expect(trials.filter((b) => !b.isFine)).toHaveLength(5)
    }
  }
})

test('easy is all clear, hard is all subtle, medium mixes one of each per construct', () => {
  expect(buildLevel('easy').every((b) => b.tier === 'clear')).toBe(true)
  expect(buildLevel('hard').every((b) => b.tier === 'subtle')).toBe(true)
  for (let i = 0; i < 10; i++) {
    const trials = buildLevel('medium')
    for (const construct of CONSTRUCTS) {
      const tiers = trials.filter((b) => b.construct === construct).map((b) => b.tier)
      expect(tiers.sort()).toEqual(['clear', 'subtle'])
    }
    expect(LEVEL_TIERS.medium).toEqual(['clear', 'subtle'])
  }
})

test('repeated builds rotate through every exemplar of every cell', () => {
  // Each tier×valence cell holds four authored exemplars; the builder samples
  // one per build. Across many builds every item of the bank must appear, so
  // sessions accumulate evidence on different items instead of a fixed set.
  const seen = new Set<string>()
  for (let i = 0; i < 200; i++) {
    for (const d of DIFFS) {
      for (const b of buildLevel(d)) seen.add(b.id)
    }
  }
  for (const construct of CONSTRUCTS) {
    for (const b of behaviorsFor(construct)) {
      expect(seen.has(b.id)).toBe(true)
    }
  }
})

test('medium pairs both valences with the subtle tier across builds', () => {
  // The coin flip must sometimes make the subtle item the okay one — otherwise
  // "subtle = not okay" would be a learnable rule.
  const seen = new Set<string>()
  for (let i = 0; i < 50; i++) {
    for (const b of buildLevel('medium')) {
      if (b.tier === 'subtle') seen.add(b.isFine ? 'fine' : 'notFine')
    }
  }
  expect(seen).toEqual(new Set(['fine', 'notFine']))
})

test('constructs are stratified: each appears once per half', () => {
  for (let i = 0; i < 20; i++) {
    const trials = buildLevel('easy')
    const half = CONSTRUCTS.length
    const firstHalf = trials.slice(0, half).map((b) => b.construct)
    const secondHalf = trials.slice(half).map((b) => b.construct)
    expect(new Set(firstHalf).size).toBe(half)
    expect(new Set(secondHalf).size).toBe(half)
  }
})

test('deterministic with a seeded rng', () => {
  const a = buildLevel('medium', rng([0.3, 0.6, 0.1, 0.9, 0.42]))
  const b = buildLevel('medium', rng([0.3, 0.6, 0.1, 0.9, 0.42]))
  expect(a.map((t) => t.id)).toEqual(b.map((t) => t.id))
})

// --- chance level ---------------------------------------------------------------

test('chance is 1/2 (binary judgment at every level)', () => {
  expect(CHANCE).toBeCloseTo(1 / 2)
})

// --- analytics tallies -----------------------------------------------------------

test('tallyByConstruct counts correct/total per construct', () => {
  const tally = tallyByConstruct([
    { construct: 'greetings', correct: true },
    { construct: 'greetings', correct: false },
    { construct: 'turns', correct: true },
  ])
  expect(tally.greetings).toEqual({ correct: 1, total: 2 })
  expect(tally.turns).toEqual({ correct: 1, total: 1 })
  expect(tally.space).toEqual({ correct: 0, total: 0 })
})

test('tallyByValence exposes response bias', () => {
  // A child who answers "okay" to everything: right on all fine items, wrong
  // on all not-okay items.
  const tally = tallyByValence([
    { isFine: true, correct: true },
    { isFine: true, correct: true },
    { isFine: false, correct: false },
    { isFine: false, correct: false },
  ])
  expect(tally.fine).toEqual({ correct: 2, total: 2 })
  expect(tally.needsFixing).toEqual({ correct: 0, total: 2 })
})
