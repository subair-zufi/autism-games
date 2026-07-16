import type { Lang } from '../../i18n/strings'

/**
 * Schoolyard 360 is bilingual (Kerala deployment): every 360-specific line is
 * authored in English and Malayalam, and one chosen language (Profile →
 * Language) is rendered and spoken per play.
 *
 * The behaviour sentences and the spoken explanations are NOT here — they come
 * from the flat game's item bank unchanged, so the 2D↔360 comparison keeps
 * identical wording. Only the scaffolding around them lives here.
 */
type Entry = Record<Lang, string>

/** "Is that okay?" — word-for-word the flat Right or Wrong question, so the
 *  prompt the child hears is identical across the 2D and 360 versions. */
export const IS_IT_OKAY: Entry = {
  en: 'Is that okay?',
  ml: 'അത് ശരിയാണോ?',
}

/** The two judgment cards — deliberately symmetric thumbs (same wording as the
 *  flat game) so neither option carries a "this is the right answer" cue. */
export const JUDGMENTS: Array<{ saidFine: boolean; emoji: string; label: Entry }> = [
  { saidFine: true, emoji: '👍', label: { en: "It's okay", ml: 'അത് ശരിയാ' } },
  { saidFine: false, emoji: '👎', label: { en: 'Not okay', ml: 'അത് ശരിയല്ല' } },
]

const MESSAGES = {
  sayWin: {
    en: 'You judged every one! Wonderful watching!',
    ml: 'എല്ലാം ശരിയായി നോക്കിപ്പറഞ്ഞു! മിടുക്കൻ/മിടുക്കി!',
  },
  // Level-picker captions — surface the stimulus-tier manipulation.
  noteEasy: { en: 'Clear behaviours — easy to judge', ml: 'വ്യക്തമായ പെരുമാറ്റങ്ങൾ' },
  noteMedium: { en: 'A mix of clear and subtle moments', ml: 'വ്യക്തവും സൂക്ഷ്മവും ഇടകലർന്ന്' },
  noteHard: { en: 'Subtle moments — watch closely!', ml: 'സൂക്ഷ്മമായ നിമിഷങ്ങൾ — ശ്രദ്ധിച്ച് നോക്കൂ!' },
  // The one-time look-around teaching hint over the canvas.
  dragHint: { en: 'Drag to look left and right', ml: 'ഇടത്തോട്ടും വലത്തോട്ടും വലിച്ചു നോക്കൂ' },
  enterVR: { en: 'Enter VR', ml: 'VR-ൽ കളിക്കൂ' },
} satisfies Record<string, Entry>

export type YardKey = keyof typeof MESSAGES

export function yardLine(key: YardKey, lang: Lang): string {
  return MESSAGES[key][lang]
}
