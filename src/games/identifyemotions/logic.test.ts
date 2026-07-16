import { expect, test } from 'vitest'
import { CONFUSABLE_WITH, type EmotionId } from '../emotionVocab'
import { HARD_CLIPS, VIDEO_CLIPS, VIDEO_COUNT, buildQuiz } from './logic'

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

test('both pools have 12 clips, 2 per emotion', () => {
  for (const pool of [VIDEO_CLIPS, HARD_CLIPS]) {
    expect(pool).toHaveLength(12)
    const counts: Record<string, number> = {}
    for (const c of pool) counts[c.emotion] = (counts[c.emotion] ?? 0) + 1
    expect(Object.values(counts)).toEqual([2, 2, 2, 2, 2, 2])
  }
})

test('every clip has a gender; hard clips have early < peak timestamps', () => {
  for (const c of VIDEO_CLIPS) {
    expect(['boy', 'girl']).toContain(c.gender)
    expect(c.peakTime).toBeGreaterThan(0)
  }
  for (const c of HARD_CLIPS) {
    expect(['boy', 'girl']).toContain(c.gender)
    expect(c.peakTime).toBeGreaterThan(0)
    expect(c.earlyTime).toBeGreaterThan(0)
    expect(c.earlyTime!).toBeLessThan(c.peakTime)
  }
})

test('every hard clip has an authored cause with a valid answer index', () => {
  for (const c of HARD_CLIPS) {
    expect(c.cause).toBeDefined()
    expect(c.cause!.options.length).toBeGreaterThanOrEqual(2)
    expect(c.cause!.answerIndex).toBeGreaterThanOrEqual(0)
    expect(c.cause!.answerIndex).toBeLessThan(c.cause!.options.length)
    for (const opt of c.cause!.options) {
      expect(opt.en.length).toBeGreaterThan(0)
      expect(opt.ml.length).toBeGreaterThan(0)
    }
  }
})

test('video counts: easy 6, medium 9, hard 12; no duplicate clips', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    for (let s = 1; s <= 20; s++) {
      const quiz = buildQuiz(d, seeded(s))
      expect(quiz).toHaveLength(VIDEO_COUNT[d])
      expect(new Set(quiz.map((q) => q.clip.slug)).size).toBe(quiz.length)
    }
  }
})

test('sampling is stratified: every emotion appears in every level', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    for (let s = 1; s <= 20; s++) {
      const emotions = new Set(buildQuiz(d, seeded(s)).map((q) => q.answer))
      expect(emotions.size).toBe(6)
    }
  }
})

test('choice counts: easy 2, medium 3, hard 4; answer always present and unique', () => {
  const check = (d: 'easy' | 'medium' | 'hard', n: number) => {
    for (let s = 1; s <= 30; s++) {
      for (const q of buildQuiz(d, seeded(s))) {
        expect(q.choices).toHaveLength(n)
        expect(q.choices).toContain(q.answer)
        expect(q.answer).toBe(q.clip.emotion)
        expect(new Set(q.choices).size).toBe(q.choices.length)
      }
    }
  }
  check('easy', 2)
  check('medium', 3)
  check('hard', 4)
})

test('answer position is counterbalanced across a session, not left to chance (review M4)', () => {
  // VIDEO_COUNT is an exact multiple of CHOICE_COUNT at every difficulty
  // (6/2, 9/3, 12/4), so a fully counterbalanced session lands the answer on
  // every choice slot exactly VIDEO_COUNT/CHOICE_COUNT times — never
  // disproportionately on one slot (e.g. the correct card always on the left).
  const cases: Array<['easy' | 'medium' | 'hard', number, number]> = [
    ['easy', 6, 2],
    ['medium', 9, 3],
    ['hard', 12, 4],
  ]
  for (const [d, videoCount, choiceCount] of cases) {
    for (let s = 1; s <= 10; s++) {
      const quiz = buildQuiz(d, seeded(s))
      const counts = new Array(choiceCount).fill(0)
      for (const q of quiz) counts[q.choices.indexOf(q.answer)]++
      expect(counts).toEqual(new Array(choiceCount).fill(videoCount / choiceCount))
    }
  }
})

test('easy distractors avoid confusable emotions; hard always includes one', () => {
  for (let s = 1; s <= 30; s++) {
    for (const q of buildQuiz('easy', seeded(s))) {
      for (const c of q.choices) {
        if (c !== q.answer) expect(CONFUSABLE_WITH[q.answer]).not.toContain(c)
      }
    }
    for (const q of buildQuiz('hard', seeded(s))) {
      const confusable = q.choices.filter((c: EmotionId) =>
        CONFUSABLE_WITH[q.answer].includes(c),
      )
      expect(confusable.length).toBeGreaterThanOrEqual(1)
    }
  }
})

test('easy/medium freeze at the peak; hard freezes early (lower intensity)', () => {
  for (const q of buildQuiz('easy', seeded(1))) {
    expect(q.freezeKind).toBe('peak')
    expect(q.freezeTime).toBe(q.clip.peakTime)
  }
  for (const q of buildQuiz('medium', seeded(1))) {
    expect(q.freezeKind).toBe('peak')
  }
  for (const q of buildQuiz('hard', seeded(1))) {
    expect(q.freezeKind).toBe('early')
    expect(q.freezeTime).toBe(q.clip.earlyTime)
  }
})

test('authored cause questions are shuffled with the answer tracked', () => {
  const clip = HARD_CLIPS[0]
  const original = clip.cause
  clip.cause = {
    options: [
      { en: 'right', ml: 'ശരി' },
      { en: 'wrong A', ml: 'തെറ്റ് എ' },
      { en: 'wrong B', ml: 'തെറ്റ് ബി' },
    ],
    answerIndex: 0,
  }
  try {
    for (let s = 1; s <= 20; s++) {
      const q = buildQuiz('hard', seeded(s)).find((q) => q.clip.slug === clip.slug)!
      expect(q.cause).toBeDefined()
      expect(q.cause!.options).toHaveLength(3)
      expect(q.cause!.options[q.cause!.answerIndex].en).toBe('right')
    }
  } finally {
    clip.cause = original
  }
})
