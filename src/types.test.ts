import { expect, test } from 'vitest'
import { GAME_LIST, SKILLS, skillMeta, type Skill } from './types'

test('skillMeta returns the matching entry', () => {
  for (const s of SKILLS) expect(skillMeta(s.id)).toBe(s)
})

test('skillMeta falls back to a placeholder for unknown server ids', () => {
  const meta = skillMeta('empathy' as Skill)
  expect(meta.label).toBe('empathy')
  expect(meta.icon.length).toBeGreaterThan(0)
  expect(meta.color).toMatch(/^#/)
})

/**
 * Every playable VR game offers a three-level picker, so each one must also be
 * level-tracked: `hasLevels` is what makes GameDetail fetch and show per-level
 * progress, what Home counts toward completion, and — via each game's
 * `useLevelProgress(...).submit()` — what gets a `game_progress` row written at
 * all. They were shipped with the picker but with `hasLevels: false`, which
 * left the difficulty manipulation completely unrecorded.
 */
test('every visible VR game is level-tracked', () => {
  const vr = GAME_LIST.filter((g) => g.mode === 'vr' && !g.hidden)
  expect(vr.length).toBeGreaterThan(0)
  for (const g of vr) expect(g.hasLevels, `${g.id} shows a level picker`).toBe(true)
})
