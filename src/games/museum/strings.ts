import type { Lang } from '../../i18n/strings'
import type { ExhibitId } from './logic'

/**
 * Museum Look is bilingual (Kerala deployment): every child-facing line is
 * authored in English and Malayalam, and one chosen language (Profile →
 * Language) is rendered and spoken per play — never both at once. Malayalam is
 * warm and colloquial, the way you'd talk to a small child, matching the style
 * of Roll-Back Buddy. Malayalam wording may benefit from a native review.
 */
type Entry = Record<Lang, string>

// Lines stay cue-agnostic ("what they show you", not "the hand") because the
// prompt fades within a session and the top rung has no hand at all — only a
// face turning to look at the target.
const MESSAGES = {
  prompt: {
    en: 'Tap what they show you — a point, or just a look!',
    ml: 'ചൂണ്ടിയോ നോക്കിയോ കാണിക്കുന്നത് തൊട്ടോളൂ!',
  },
  sayWin: {
    en: 'You followed every cue! Wonderful looking!',
    ml: 'എല്ലാം നന്നായി പിന്തുടർന്നു! കൊള്ളാം!',
  },
  sayCorrect: {
    en: 'Yes! The {label}!',
    ml: 'ശരി! {label}!',
  },
  sayWrong: {
    en: 'Look again. What are they showing you?',
    ml: 'ഒന്നൂടെ നോക്ക്. എന്താ കാണിക്കുന്നത്?',
  },
  // Level-picker captions — surface where the fading ladder starts.
  noteEasy: { en: 'Glowing point to start', ml: 'തുടക്കം തിളങ്ങുന്ന ചൂണ്ടൽ' },
  noteMedium: { en: 'Plain point to start', ml: 'തുടക്കം സാധാരണ ചൂണ്ടൽ' },
  noteHard: { en: 'Far point, fading to just a look', ml: 'ദൂരെ ചൂണ്ടൽ, പിന്നെ നോട്ടം മാത്രം' },
} satisfies Record<string, Entry>

export type MuseumKey = keyof typeof MESSAGES

/** Localized exhibit names (spoken on a correct find). */
const EXHIBIT_LABELS: Record<ExhibitId, Entry> = {
  gem: { en: 'Gem', ml: 'രത്നം' },
  dino: { en: 'Dino', ml: 'ദിനോ' },
  rocket: { en: 'Rocket', ml: 'റോക്കറ്റ്' },
  vase: { en: 'Vase', ml: 'പൂപ്പാത്രം' },
  mask: { en: 'Mask', ml: 'മുഖംമൂടി' },
  crystal: { en: 'Crystal', ml: 'പളുങ്ക്' },
}

export function museumLine(key: MuseumKey, lang: Lang, params?: Record<string, string>): string {
  let text = MESSAGES[key][lang]
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v)
  return text
}

export function exhibitLabel(id: ExhibitId, lang: Lang): string {
  return EXHIBIT_LABELS[id][lang]
}
