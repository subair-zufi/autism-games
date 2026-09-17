import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { playClip, playTap, preloadClips, resetSoundsForTest } from './sounds'
import { useSettings } from '../state/settings'

/** Minimal AudioContext stand-in: records what was played and how. */
class FakeAudioContext {
  static last: FakeAudioContext | undefined
  state: AudioContextState = 'running'
  currentTime = 0
  destination = {}
  resumeCalls = 0
  started: Array<{ kind: 'osc' | 'buffer'; at: number }> = []

  constructor() {
    FakeAudioContext.last = this
  }

  resume() {
    this.resumeCalls++
    this.state = 'running'
    // A resumed context's clock is moving again; a suspended one's is frozen.
    this.currentTime = 10
    return Promise.resolve()
  }

  private node() {
    return { connect: (n: unknown) => n, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, frequency: { value: 0 } }
  }

  createGain() { return this.node() }

  createOscillator() {
    const self = this
    return {
      ...this.node(),
      type: '',
      start(at: number) { self.started.push({ kind: 'osc', at }) },
      stop() {},
    }
  }

  createBufferSource() {
    const self = this
    return {
      ...this.node(),
      buffer: null as AudioBuffer | null,
      start() { self.started.push({ kind: 'buffer', at: self.currentTime }) },
    }
  }

  decodeAudioData(_data: ArrayBuffer) {
    return Promise.resolve({} as AudioBuffer)
  }
}

beforeEach(() => {
  useSettings.setState(useSettings.getInitialState())
  resetSoundsForTest()
  FakeAudioContext.last = undefined
  vi.stubGlobal('AudioContext', FakeAudioContext)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

test('a tap on a suspended context resumes it and plays once the clock is moving', async () => {
  vi.useFakeTimers()
  playTap()
  await vi.runAllTimersAsync() // the first tone builds the context off the click
  const ac = FakeAudioContext.last!
  // the browser suspends audio when the headset sleeps or the tab is hidden
  ac.state = 'suspended'
  ac.currentTime = 4 // frozen while suspended

  playTap()
  await vi.runAllTimersAsync()

  expect(ac.resumeCalls).toBeGreaterThan(0)
  // scheduled against the RESUMED clock, not the frozen one — a note scheduled
  // at the frozen time lands in the past and is silent
  expect(ac.started.at(-1)).toEqual({ kind: 'osc', at: 10 })
})

test('no tone is played while sounds are off', async () => {
  vi.useFakeTimers()
  useSettings.getState().setSoundOn(false)
  playTap()
  await vi.runAllTimersAsync()
  expect(FakeAudioContext.last).toBeUndefined()
})

test('a clip played while its preload is still in flight still sounds', async () => {
  const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }))
  vi.stubGlobal('fetch', fetchMock)

  // praise() warms every clip and then immediately plays one of them
  preloadClips(['./praise/f-super.m4a'])
  playClip('./praise/f-super.m4a')
  await vi.waitFor(() => expect(FakeAudioContext.last!.started.length).toBe(1))

  expect(FakeAudioContext.last!.started[0].kind).toBe('buffer')
  expect(fetchMock).toHaveBeenCalledTimes(1) // one decode shared, not two
})

test('a clip that fails to load is silent rather than throwing', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, arrayBuffer: async () => new ArrayBuffer(0) })))
  playClip('./praise/f-missing.m4a')
  await vi.waitFor(() => expect(FakeAudioContext.last!.started.length).toBe(0))
})
