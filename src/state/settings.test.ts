import { beforeEach, expect, test } from 'vitest'
import { useSettings } from './settings'

beforeEach(() => {
  localStorage.clear()
  useSettings.setState(useSettings.getInitialState())
})

test('defaults: voice on, sound on, easy difficulty everywhere', () => {
  const s = useSettings.getState()
  expect(s.voiceOn).toBe(true)
  expect(s.soundOn).toBe(true)
  expect(s.difficulty.emotions).toBe('easy')
})

test('setDifficulty updates one game only', () => {
  useSettings.getState().setDifficulty('zebra', 'hard')
  expect(useSettings.getState().difficulty.zebra).toBe('hard')
  expect(useSettings.getState().difficulty.garden).toBe('easy')
})

test('persists to localStorage', () => {
  useSettings.getState().setVoiceOn(false)
  expect(JSON.parse(localStorage.getItem('otist-settings')!).state.voiceOn).toBe(false)
})
