import { useSettings } from '../state/settings'
import type { Lang } from '../i18n/strings'

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

const SPEECH_LANG: Record<Lang, string> = { en: 'en-US', ml: 'ml-IN' }

function utterance(text: string, lang: Lang): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 0.9 // slightly slow, clearer for students
  u.lang = SPEECH_LANG[lang]
  if (lang !== 'en') {
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(lang))
    if (voice) u.voice = voice
  }
  return u
}

/** Speak text aloud (cancels anything still talking). No-ops when
 *  unavailable or voice is muted, so callers never need to check.
 *  Pass `lang: 'ml'` for Malayalam — a Malayalam voice is used when the
 *  device has one (Android/Google TTS ships ml-IN; desktop often doesn't).
 *  `onEnd` fires when the utterance finishes (or errors); it is called
 *  synchronously when speech is unavailable/muted, so a caller measuring
 *  "time since the prompt finished" gets a sane zero-point either way. */
export function speak(text: string, lang: Lang = 'en', onEnd?: () => void) {
  if (!speechAvailable() || !useSettings.getState().voiceOn) {
    onEnd?.()
    return
  }
  window.speechSynthesis.cancel()
  const u = utterance(text, lang)
  if (onEnd) {
    u.addEventListener('end', onEnd)
    u.addEventListener('error', onEnd)
  }
  window.speechSynthesis.speak(u)
}

/**
 * Speak several localized lines back-to-back (one cancel, then queued) so a
 * bilingual prompt reads e.g. Malayalam first, then English, without the
 * second line cutting off the first. `onEnd` fires after the LAST line ends.
 */
export function speakAll(parts: ReadonlyArray<{ text: string; lang: Lang }>, onEnd?: () => void) {
  if (!speechAvailable() || !useSettings.getState().voiceOn) {
    onEnd?.()
    return
  }
  window.speechSynthesis.cancel()
  const utts = parts.map((p) => utterance(p.text, p.lang))
  const last = utts[utts.length - 1]
  if (onEnd && last) {
    last.addEventListener('end', onEnd)
    last.addEventListener('error', onEnd)
  } else if (onEnd) {
    onEnd()
  }
  for (const u of utts) window.speechSynthesis.speak(u)
}
