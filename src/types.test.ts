import { expect, test } from 'vitest'
import { SKILLS, skillMeta, type Skill } from './types'

test('skillMeta returns the matching entry', () => {
  for (const s of SKILLS) expect(skillMeta(s.id)).toBe(s)
})

test('skillMeta falls back to a placeholder for unknown server ids', () => {
  const meta = skillMeta('empathy' as Skill)
  expect(meta.label).toBe('empathy')
  expect(meta.icon.length).toBeGreaterThan(0)
  expect(meta.color).toMatch(/^#/)
})
