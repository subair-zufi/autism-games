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
  expect(s.difficulty.emotionrecognition).toBe('easy')
})

test('vrPracticeDone starts false and persists once set (review U2)', () => {
  expect(useSettings.getState().vrPracticeDone).toBe(false)
  useSettings.getState().setVrPracticeDone(true)
  expect(useSettings.getState().vrPracticeDone).toBe(true)
  expect(JSON.parse(localStorage.getItem('autism-settings')!).state.vrPracticeDone).toBe(true)
})

test('setDifficulty updates one game only', () => {
  useSettings.getState().setDifficulty('museum', 'hard')
  expect(useSettings.getState().difficulty.museum).toBe('hard')
  expect(useSettings.getState().difficulty.blocks).toBe('easy')
})

test('persists to localStorage', () => {
  useSettings.getState().setVoiceOn(false)
  expect(JSON.parse(localStorage.getItem('autism-settings')!).state.voiceOn).toBe(false)
})

test('a headset still holding the removed "poke" method falls back to gaze', async () => {
  // devices that ran the build with bare-hand poke have it persisted; left
  // as-is it is no longer a valid method and would select nothing at all
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { inputMethod: 'poke' }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  expect(useSettings.getState().inputMethod).toBe('dwell')
})

test('a saved selection method that is still valid is kept', async () => {
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { inputMethod: 'controller' }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  expect(useSettings.getState().inputMethod).toBe('controller')
})

test('stale saved state (missing newer game keys) still gets defaults', async () => {
  // simulate a store saved before the emotionrecognition game existed
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { voiceOn: false, soundOn: true, difficulty: { museum: 'hard' } }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  const s = useSettings.getState()
  expect(s.voiceOn).toBe(false) // saved value kept
  expect(s.difficulty.museum).toBe('hard') // saved value kept
  expect(s.difficulty.emotionrecognition).toBe('easy') // new key filled from defaults
})
