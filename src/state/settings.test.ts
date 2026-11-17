import { beforeEach, expect, test } from 'vitest'
import { nextVolumeStep, useSettings } from './settings'

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

test('a saved steadiness setting this build does not know falls back to standard', async () => {
  // an unknown value would index DWELL_PROFILES to undefined, leaving the child
  // with no working dwell at all — worse than the setting simply being wrong
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { dwellProfile: 'featherweight' }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  expect(useSettings.getState().dwellProfile).toBe('standard')
})

test('a saved steadiness setting that is still valid is kept', async () => {
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { dwellProfile: 'high-support' }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  expect(useSettings.getState().dwellProfile).toBe('high-support')
})

test('a store saved before the steadiness setting existed gets the standard one', async () => {
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { inputMethod: 'dwell' }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  expect(useSettings.getState().dwellProfile).toBe('standard')
})


test('volume keeps itself inside 0..1 however it is set', () => {
  const { setVolume } = useSettings.getState()
  setVolume(0.4)
  expect(useSettings.getState().volume).toBe(0.4)
  setVolume(5)
  expect(useSettings.getState().volume).toBe(1)
  setVolume(-2)
  expect(useSettings.getState().volume).toBe(0)
})

test('a junk volume never silences the session — it falls back to what was set', () => {
  const { setVolume } = useSettings.getState()
  setVolume(0.8)
  setVolume(Number.NaN)
  // NaN would otherwise multiply every gain in the app to NaN, i.e. silence,
  // and persist onto the headset for the next session too
  expect(useSettings.getState().volume).toBe(1)
})

test('a store saved before the volume setting existed plays at full', async () => {
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { soundOn: true }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  expect(useSettings.getState().volume).toBe(1)
})

test('a saved volume is kept', async () => {
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { volume: 0.25 }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  expect(useSettings.getState().volume).toBe(0.25)
})

test('a corrupt saved volume leaves the level alone rather than silencing it', async () => {
  useSettings.getState().setVolume(0.6)
  localStorage.setItem(
    'autism-settings',
    JSON.stringify({ state: { volume: 'loud' }, version: 0 }),
  )
  await useSettings.persist.rehydrate()
  // not 0, and not NaN — a bad value from an older or newer build must never
  // be the reason a child's session has no sound
  expect(useSettings.getState().volume).toBe(0.6)
})


test('the trainer’s volume chip steps down and wraps back to full', () => {
  // a chip has no "direction", so getting stuck at 0 would leave the trainer
  // no way back to sound without taking the headset off the child
  expect(nextVolumeStep(1)).toBe(0.75)
  expect(nextVolumeStep(0.75)).toBe(0.5)
  expect(nextVolumeStep(0.5)).toBe(0.25)
  expect(nextVolumeStep(0.25)).toBe(0)
  expect(nextVolumeStep(0)).toBe(1)
})

test('the volume chip copes with a level that is not one of its steps', () => {
  // Profile's slider moves in 5% steps, so the console is routinely handed a
  // level that is between two chips
  expect(nextVolumeStep(0.9)).toBe(0.75)
  expect(nextVolumeStep(0.05)).toBe(0)
  expect(nextVolumeStep(undefined)).toBe(0.75)
  expect(nextVolumeStep(Number.NaN)).toBe(0.75)
})
