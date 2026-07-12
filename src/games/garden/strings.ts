import type { Lang } from '../../i18n/strings'
import type { ObjectId } from './logic'

/**
 * Garden Finder is bilingual (Kerala deployment): every child-facing line is
 * authored in English and Malayalam, and one chosen language (Profile →
 * Language) is rendered and spoken per play. Malayalam is warm and colloquial,
 * matching Roll-Back Buddy; wording may benefit from a native review.
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
    en: 'You found them all! Wonderful looking!',
    ml: 'എല്ലാം കണ്ടുപിടിച്ചു! കൊള്ളാം!',
  },
  sayCorrect: {
    en: 'Yes! The {label}!',
    ml: 'ശരി! {label}!',
  },
  sayWrong: {
    en: "Let's look again. What are they showing you?",
    ml: 'ഒന്നൂടെ നോക്കാം. എന്താ കാണിക്കുന്നത്?',
  },
  // Level-picker captions — surface where the fading ladder starts.
  noteEasy: { en: 'Glowing point to start', ml: 'തുടക്കം തിളങ്ങുന്ന ചൂണ്ടൽ' },
  noteMedium: { en: 'Plain point to start', ml: 'തുടക്കം സാധാരണ ചൂണ്ടൽ' },
  noteHard: { en: 'Far point, fading to just a look', ml: 'ദൂരെ ചൂണ്ടൽ, പിന്നെ നോട്ടം മാത്രം' },
} satisfies Record<string, Entry>

export type GardenKey = keyof typeof MESSAGES

/** Localized object names (spoken on a correct find). */
const OBJECT_LABELS: Record<ObjectId, Entry> = {
  'flower-red': { en: 'Red Flower', ml: 'ചുവന്ന പൂവ്' },
  'flower-yellow': { en: 'Yellow Flower', ml: 'മഞ്ഞ പൂവ്' },
  'flower-purple': { en: 'Purple Flower', ml: 'വയലറ്റ് പൂവ്' },
  butterfly: { en: 'Butterfly', ml: 'പൂമ്പാറ്റ' },
  tree: { en: 'Tree', ml: 'മരം' },
  bird: { en: 'Bird', ml: 'പക്ഷി' },
  mushroom: { en: 'Mushroom', ml: 'കൂൺ' },
  bee: { en: 'Bee', ml: 'തേനീച്ച' },
}

export function gardenLine(key: GardenKey, lang: Lang, params?: Record<string, string>): string {
  let text = MESSAGES[key][lang]
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v)
  return text
}

export function gardenObjectLabel(id: ObjectId, lang: Lang): string {
  return OBJECT_LABELS[id][lang]
}
