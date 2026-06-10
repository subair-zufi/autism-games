import { useSettings } from '../state/settings'

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Speak text aloud (cancels anything still talking). No-ops when
 *  unavailable or voice is muted, so callers never need to check. */
export function speak(text: string) {
  if (!speechAvailable() || !useSettings.getState().voiceOn) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.9 // slightly slow, clearer for students
  u.lang = 'en-US'
  window.speechSynthesis.speak(u)
}
