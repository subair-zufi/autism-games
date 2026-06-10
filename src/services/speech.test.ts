import { beforeEach, expect, test, vi } from 'vitest'
import { speak, speechAvailable } from './speech'
import { useSettings } from '../state/settings'

beforeEach(() => {
  useSettings.setState(useSettings.getInitialState())
})

test('speechAvailable false when API missing', () => {
  expect(speechAvailable()).toBe(false)
})

test('speak uses speechSynthesis when available and voice is on', () => {
  const fake = { cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', fake)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  speak('hello')
  expect(fake.speak).toHaveBeenCalled()
  vi.unstubAllGlobals()
})

test('speak does nothing when voice is off', () => {
  const fake = { cancel: vi.fn(), speak: vi.fn() }
  vi.stubGlobal('speechSynthesis', fake)
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} })
  useSettings.getState().setVoiceOn(false)
  speak('hello')
  expect(fake.speak).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
