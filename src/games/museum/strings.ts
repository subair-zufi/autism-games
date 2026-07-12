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

const MESSAGES = {
  prompt: {
    en: 'Tap the exhibit the hand is pointing at.',
    ml: 'കൈ ചൂണ്ടുന്ന സാധനം തൊട്ടോളൂ.',
  },
  sayWin: {
    en: 'You followed every point! Wonderful looking!',
    ml: 'എല്ലാ ചൂണ്ടലും നന്നായി പിന്തുടർന്നു! കൊള്ളാം!',
  },
  sayCorrect: {
    en: 'Yes! The hand points at the {label}!',
    ml: 'ശരി! കൈ {label} ചൂണ്ടുന്നു!',
  },
  sayWrong: {
    en: 'Look again. Follow where the hand is pointing.',
    ml: 'ഒന്നൂടെ നോക്ക്. കൈ എവിടെ ചൂണ്ടുന്നു എന്ന് നോക്ക്.',
  },
  // Level-picker captions — surface the cue-fading manipulation.
  noteEasy: { en: 'Glowing point, up close', ml: 'അടുത്ത് തിളങ്ങുന്ന ചൂണ്ടൽ' },
  noteMedium: { en: 'Plain point, up close', ml: 'അടുത്ത് സാധാരണ ചൂണ്ടൽ' },
  noteHard: { en: 'Point from across the room', ml: 'മുറിക്ക് അപ്പുറത്തുനിന്ന് ചൂണ്ടൽ' },
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
