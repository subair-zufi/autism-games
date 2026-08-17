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

// --- Reinforcing praise after a correct answer ----------------------------
//
// A short, varied word of encouragement ("Great job!", "Well done!") spoken
// after every correct response, in a voice whose gender is randomised each
// time. English only, by product decision — kept deliberately separate from
// the bilingual game prompts.

const PRAISE_LINES = [
  'Great job!',
  'Well done!',
  'Awesome!',
  'Nice work!',
  'You did it!',
  'Fantastic!',
  'Way to go!',
  'Super!',
  'Brilliant!',
  'Excellent!',
  'Amazing!',
  "That's right!",
]

// Name fragments that reliably flag a system voice's gender across the common
// desktop / mobile / Quest TTS voice sets. Anything unmatched falls through to
// pitch alone, which still gives an audible male/female contrast.
const FEMALE_VOICE_HINTS = [
  'female', 'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona', 'susan',
  'zira', 'serena', 'allison', 'ava', 'catherine', 'kate', 'veena', 'joana',
  'amelie', 'anna', 'nicky', 'aria', 'jenny', 'sonia',
]
const MALE_VOICE_HINTS = [
  'male', 'daniel', 'alex', 'fred', 'thomas', 'aaron', 'david', 'mark', 'oliver',
  'george', 'rishi', 'gordon', 'arthur', 'guy', 'lee', 'ryan', 'brian',
]

function classifyVoice(v: SpeechSynthesisVoice): 'male' | 'female' | 'unknown' {
  const n = v.name.toLowerCase()
  // "…Male" also contains "…ale" → check female first only via exact fragments.
  if (FEMALE_VOICE_HINTS.some((h) => n.includes(h))) return 'female'
  if (MALE_VOICE_HINTS.some((h) => n.includes(h))) return 'male'
  return 'unknown'
}

/**
 * Speak a short, randomised word of praise after a correct answer.
 *
 * Voice gender is chosen at random each call (male vs female): a gender-matching
 * English system voice is used when the device has one, and the pitch is nudged
 * to reinforce it so the two still sound clearly different on devices that only
 * ship a single TTS voice (e.g. the Quest). English only.
 *
 * Unlike `speak`, this does NOT cancel current speech: a game may say its own
 * localized line first ("Nice block!", "Wow, a butterfly!") and then call
 * `praise()` to add the cheer right after, so the two must queue rather than
 * clobber each other. No-ops when speech is unavailable or voice is muted.
 */
export function praise() {
  if (!speechAvailable() || !useSettings.getState().voiceOn) return
  const text = PRAISE_LINES[Math.floor(Math.random() * PRAISE_LINES.length)]
  const wantFemale = Math.random() < 0.5
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 1
  u.pitch = wantFemale ? 1.3 : 0.75
  const want = wantFemale ? 'female' : 'male'
  const match = window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang.toLowerCase().startsWith('en'))
    .find((v) => classifyVoice(v) === want)
  if (match) u.voice = match
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
