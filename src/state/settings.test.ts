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
  expect(JSON.parse(localStorage.getItem('autism-settings')!).state.voiceOn).toBe(false)
})

test('stale saved state (missing newer game keys) still gets defaults', async () => {
  // simulate a store saved before the slider game existed
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { voiceOn: false, soundOn: true, difficulty: { emotions: 'hard' } }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  const s = useSettings.getState()
  expect(s.voiceOn).toBe(false) // saved value kept
  expect(s.difficulty.emotions).toBe('hard') // saved value kept
  expect(s.difficulty.slider).toBe('easy') // new key filled from defaults
})
