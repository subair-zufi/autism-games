import { describe, expect, it } from 'vitest'
import type { Difficulty } from '../../types'
import { CONFUSABLE_WITH } from '../emotionVocab'
import {
  AVAILABLE_EMOTIONS,
  BEARINGS,
  CONFIG,
  FRONT_HALF_ARC_DEG,
  answerBearingDeg,
  buildAnswerSlots,
  buildTargets,
  isDragTail,
  lookDrag,
  makeRound,
  pointsFor,
  roundChance,
  starsFor,
} from './logic'

function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard']

describe('emotionrecognition360 board placement', () => {
  it('keeps every board inside the front half-circle — nothing behind the child', () => {
    for (const bearings of Object.values(BEARINGS)) {
      for (const deg of bearings) {
        expect(Math.abs(deg)).toBeLessThanOrEqual(FRONT_HALF_ARC_DEG)
      }
    }
  })

  it('gives each difficulty a bearing set matching its board count', () => {
    for (const d of DIFFS) {
      expect(BEARINGS[CONFIG[d].boardCount]).toHaveLength(CONFIG[d].boardCount)
    }
  })
})

describe('makeRound', () => {
  it('builds the configured number of boards with exactly one correct target', () => {
    for (const d of DIFFS) {
      const rng = seededRng(d.length + 3)
      const round = makeRound('happy', d, rng)
      expect(round.boards).toHaveLength(CONFIG[d].boardCount)
      expect(round.target).toBe('happy')
      expect(round.boards[round.answerIndex].emotion).toBe('happy')
      // exactly one board shows the target emotion
      expect(round.boards.filter((b) => b.emotion === 'happy')).toHaveLength(1)
    }
  })

  it('gives every board a distinct emotion and a real photo', () => {
    const round = makeRound('sad', 'hard', seededRng(9))
    const emotions = round.boards.map((b) => b.emotion)
    expect(new Set(emotions).size).toBe(emotions.length)
    for (const b of round.boards) {
      expect(b.imageSrc).toMatch(/emotions\//)
      expect(['boy', 'girl']).toContain(b.gender)
    }
  })

  it('assigns each board one of the level bearings, answer bearing among them', () => {
    const round = makeRound('angry', 'medium', seededRng(4))
    const bearings = BEARINGS[CONFIG.medium.boardCount]
    for (const b of round.boards) expect(bearings).toContain(b.bearingDeg)
    expect(bearings).toContain(answerBearingDeg(round))
  })

  it('forces a confusable distractor on hard', () => {
    // over many draws the hard tier must include a confusable emotion when one
    // exists for the target (the perceptual-difficulty manipulation)
    const rng = seededRng(21)
    let sawConfusable = false
    for (let i = 0; i < 40; i++) {
      const round = makeRound('scared', 'hard', rng)
      const distractors = round.boards.map((b) => b.emotion).filter((e) => e !== 'scared')
      if (distractors.some((e) => CONFUSABLE_WITH.scared.includes(e))) sawConfusable = true
    }
    expect(sawConfusable).toBe(true)
  })
})

describe('buildAnswerSlots', () => {
  it('spreads the correct board evenly across every position, no side bias', () => {
    for (const d of DIFFS) {
      const slots = buildAnswerSlots(d, seededRng(d.length + 5))
      expect(slots).toHaveLength(CONFIG[d].goal)
      const counts = new Array(CONFIG[d].boardCount).fill(0)
      for (const s of slots) counts[s]++
      // every position appears within one of every other — never lopsided
      // (e.g. correct board landing left 5/6 rounds), the M4 review finding
      expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    }
  })

  it('never repeats the same slot across a cycle seam when it can avoid it', () => {
    const slots = buildAnswerSlots('hard', seededRng(11))
    for (let i = 1; i < slots.length; i++) {
      // boardCount for hard is 3, so an immediate repeat is always avoidable
      if (CONFIG.hard.boardCount > 1) expect(slots[i]).not.toBe(slots[i - 1])
    }
  })

  it('makeRound honours an explicit answerSlot', () => {
    const slots = buildAnswerSlots('medium', seededRng(2))
    for (const slot of slots) {
      const round = makeRound('happy', 'medium', seededRng(3), slot)
      expect(round.answerIndex).toBe(slot)
      expect(round.boards[slot].emotion).toBe('happy')
    }
  })
})

describe('buildTargets', () => {
  it('produces exactly `goal` targets with no immediate repeats', () => {
    for (const d of DIFFS) {
      const seq = buildTargets(d, seededRng(d.length + 1))
      expect(seq).toHaveLength(CONFIG[d].goal)
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1])
      for (const e of seq) expect(AVAILABLE_EMOTIONS).toContain(e)
    }
  })

  it('covers the whole vocabulary before repeating (stratified)', () => {
    const seq = buildTargets('hard', seededRng(7))
    // the first full cycle uses every available emotion once
    const firstCycle = seq.slice(0, AVAILABLE_EMOTIONS.length)
    expect(new Set(firstCycle).size).toBe(AVAILABLE_EMOTIONS.length)
  })
})

describe('scoring', () => {
  it('scores a correct tap and nothing for a miss', () => {
    expect(pointsFor(true)).toBeGreaterThan(0)
    expect(pointsFor(false)).toBe(0)
  })

  it('halves a hinted correct, matching Park 360\'s prompted/spontaneous ratio (review M5/P3)', () => {
    expect(pointsFor(true, true)).toBe(pointsFor(true, false) / 2)
    expect(pointsFor(false, true)).toBe(0)
  })

  it('awards stars by accuracy, always at least one', () => {
    expect(starsFor(10, 10)).toBe(3)
    expect(starsFor(5, 10)).toBe(2)
    expect(starsFor(0, 10)).toBe(1)
  })

  it('reports the guessing baseline as 1 / boards', () => {
    expect(roundChance(makeRound('happy', 'easy', seededRng(1)))).toBeCloseTo(0.5)
    expect(roundChance(makeRound('happy', 'hard', seededRng(1)))).toBeCloseTo(1 / 3)
  })
})

describe('drag guard', () => {
  it('ignores a tap that is the tail of a look-around drag', () => {
    lookDrag.px = 20
    lookDrag.endedAt = 1000
    expect(isDragTail(1100)).toBe(true)
    expect(isDragTail(2000)).toBe(false)
    lookDrag.px = 2
    expect(isDragTail(1050)).toBe(false)
  })
})
