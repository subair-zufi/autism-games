import { beforeEach, expect, test } from 'vitest'
import { useScores } from './scores'

beforeEach(() => {
  localStorage.clear()
  useScores.setState(useScores.getInitialState())
})

test('best defaults to 0', () => {
  expect(useScores.getState().best.emotionrecognition).toBe(0)
})

test('reportScore keeps the maximum', () => {
  useScores.getState().reportScore('emotionrecognition', 5)
  useScores.getState().reportScore('emotionrecognition', 3)
  expect(useScores.getState().best.emotionrecognition).toBe(5)
})
