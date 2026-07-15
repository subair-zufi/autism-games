import type { Lang } from '../../i18n/strings'

/**
 * Emotion Clips 360 is bilingual (Kerala deployment): every 360-specific line is
 * authored in English and Malayalam, one chosen language rendered/spoken per
 * play. The freeze prompt ("How does he/she feel?") and the "why …?" question
 * are NOT here — they are shared with the flat game via `videoFreezeQuestion` /
 * `whyQuestion` in i18n/strings, so the 2D↔360 comparison keeps identical
 * wording. Only the scaffolding around them lives here.
 */
type Entry = Record<Lang, string>

const MESSAGES = {
  watch: { en: 'Watch the screen…', ml: 'സ്ക്രീനിലേക്ക് നോക്കൂ…' },
  sayGreat: { en: 'Great job!', ml: 'കൊള്ളാം!' },
  sayLookAgain: { en: "Let's look again.", ml: 'നമുക്ക് ഒന്നുകൂടി നോക്കാം.' },
  sayWin: { en: 'You named every feeling! Wonderful!', ml: 'എല്ലാ ഭാവങ്ങളും പറഞ്ഞു! മിടുക്കൻ/മിടുക്കി!' },
  // Level-picker captions — surface the intensity + confusability manipulation.
  noteEasy: { en: 'Clear peak faces, two choices', ml: 'വ്യക്തമായ ഭാവങ്ങൾ, രണ്ട് ഉത്തരം' },
  noteMedium: { en: 'Peak faces, three choices', ml: 'വ്യക്തമായ ഭാവങ്ങൾ, മൂന്ന് ഉത്തരം' },
  noteHard: { en: 'Half-formed faces + "why?", four choices', ml: 'പാതി ഭാവങ്ങൾ + "എന്തുകൊണ്ട്?", നാല് ഉത്തരം' },
  enterVR: { en: 'Enter VR', ml: 'VR-ൽ കളിക്കൂ' },
} satisfies Record<string, Entry>

export type ClipRoomKey = keyof typeof MESSAGES

export function clipLine(key: ClipRoomKey, lang: Lang): string {
  return MESSAGES[key][lang]
}
