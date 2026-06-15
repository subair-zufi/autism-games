import { expect, test } from 'vitest'
import { CONFIG, KID_COLORS, queueColors, YOU_COLOR } from './logic'

test('queue and goal grow with difficulty, and waiting gets longer', () => {
  expect(CONFIG.easy.queue).toBeLessThan(CONFIG.hard.queue)
  expect(CONFIG.easy.goal).toBeLessThan(CONFIG.hard.goal)
  expect(CONFIG.easy.turnMs).toBeLessThan(CONFIG.hard.turnMs)
  expect(CONFIG.easy.goal).toBeGreaterThan(0)
})

test('queueColors returns one colour per kid from the palette', () => {
  const colors = queueColors(CONFIG.hard.queue, Math.random)
  expect(colors).toHaveLength(CONFIG.hard.queue)
  for (const c of colors) expect(KID_COLORS).toContain(c)
})

test("the child's colour is distinct from the queue palette", () => {
  expect(KID_COLORS).not.toContain(YOU_COLOR)
})
