import type { Lang } from '../../i18n/strings'
import type { ObjectId } from './logic'

/**
 * Garden Finder is bilingual (Kerala deployment): every child-facing line is
 * authored in English and Malayalam, and one chosen language (Profile →
 * Language) is rendered and spoken per play. Malayalam is warm and colloquial,
 * matching Roll-Back Buddy; wording may benefit from a native review.
 */
type Entry = Record<Lang, string>

const MESSAGES = {
  prompt: {
    en: 'Tap what the hand is pointing at!',
    ml: 'കൈ ചൂണ്ടുന്നത് തൊട്ടോളൂ!',
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
    en: "Let's look again. Where is the hand pointing?",
    ml: 'ഒന്നൂടെ നോക്കാം. കൈ എവിടെ ചൂണ്ടുന്നു?',
  },
  // Level-picker captions — surface the cue-fading manipulation.
  noteEasy: { en: 'Glowing point, up close', ml: 'അടുത്ത് തിളങ്ങുന്ന ചൂണ്ടൽ' },
  noteMedium: { en: 'Plain point, up close', ml: 'അടുത്ത് സാധാരണ ചൂണ്ടൽ' },
  noteHard: { en: 'Point from across the garden', ml: 'തോട്ടത്തിന് അപ്പുറത്തുനിന്ന് ചൂണ്ടൽ' },
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
