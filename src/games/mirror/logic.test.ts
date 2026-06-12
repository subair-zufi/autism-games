import { expect, test } from 'vitest'
import { EMOTIONS, emotionMeta, makeRound } from './logic'

const rng = (seq: number[]) => {
  let i = 0
  return () => seq[i++ % seq.length]
}

test('easy has 2 choices, medium 3, hard 4', () => {
  expect(makeRound('easy', null, Math.random).choices).toHaveLength(2)
  expect(makeRound('medium', null, Math.random).choices).toHaveLength(3)
  expect(makeRound('hard', null, Math.random).choices).toHaveLength(4)
})

test('choices always include the target and are unique', () => {
  for (const d of ['easy', 'medium', 'hard'] as const) {
    for (let i = 0; i < 40; i++) {
      const r = makeRound(d, null, Math.random)
      expect(r.choices).toContain(r.target)
      expect(new Set(r.choices).size).toBe(r.choices.length)
    }
  }
})

test('target never repeats the previous round', () => {
  for (let i = 0; i < 40; i++) {
    expect(makeRound('medium', 'happy', Math.random).target).not.toBe('happy')
  }
})

test('deterministic with seeded rng', () => {
  const r = makeRound('easy', null, rng([0]))
  expect(r.choices).toContain(r.target)
})

test('all 6 emotions have complete metadata and a distinct face shape', () => {
  expect(EMOTIONS).toHaveLength(6)
  const curves = new Set<number>()
  for (const e of EMOTIONS) {
    expect(e.label.length).toBeGreaterThan(0)
    expect(e.emoji.length).toBeGreaterThan(0)
    curves.add(e.face.mouthCurve)
  }
  // faces should not all share one mouth shape
  expect(curves.size).toBeGreaterThan(1)
})

test('emotionMeta looks up by id', () => {
  expect(emotionMeta('happy').label).toBe('Happy')
  expect(emotionMeta('disgusted').emoji).toBe('🤢')
})
