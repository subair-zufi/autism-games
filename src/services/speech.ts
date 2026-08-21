import { useSettings } from '../state/settings'
import type { Lang } from '../i18n/strings'
import { playClip, preloadClips } from './sounds'

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
// A short, varied word of encouragement ("Great job!", "Well done!") played
// after every correct response, in a voice whose gender is randomised each
// time. English only, by product decision — kept deliberately separate from
// the bilingual game prompts.
//
// These are PRE-RECORDED audio clips (public/praise/, generated with the two
// macOS voices), not `speechSynthesis`: standalone VR browsers such as Wolvic
// ship no TTS voices, so live speech is silent on the headset. WebAudio clips
// play everywhere the success chime does — desktop and headset alike — so the
// praise reaches VR. Female clips are `f-<slug>.m4a`, male are `m-<slug>.m4a`.

const PRAISE_SLUGS = [
  'great-job', 'well-done', 'awesome', 'nice-work', 'you-did-it', 'fantastic',
  'way-to-go', 'super', 'brilliant', 'excellent', 'amazing', 'thats-right',
] as const

const praiseUrl = (gender: 'm' | 'f', slug: string) => `./praise/${gender}-${slug}.m4a`

let praisePreloaded = false

/** Warm every praise clip so the first cheer isn't delayed by a cold decode. */
export function preloadPraise() {
  if (praisePreloaded) return
  praisePreloaded = true
  const urls: string[] = []
  for (const g of ['m', 'f'] as const) for (const s of PRAISE_SLUGS) urls.push(praiseUrl(g, s))
  preloadClips(urls)
}

/**
 * Play a short, randomised word of praise after a correct answer.
 *
 * A male or female clip is chosen at random each call. Plays through the shared
 * WebAudio context (see `playClip`) so it works on the VR headset, where TTS
 * does not. No-op when voice is muted. The first call also warms the rest of
 * the clips so later cheers are instant.
 */
export function praise() {
  if (!useSettings.getState().voiceOn) return
  preloadPraise()
  const gender = Math.random() < 0.5 ? 'm' : 'f'
  const slug = PRAISE_SLUGS[Math.floor(Math.random() * PRAISE_SLUGS.length)]
  playClip(praiseUrl(gender, slug))
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
