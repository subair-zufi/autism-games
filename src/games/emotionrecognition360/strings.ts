import type { Lang } from '../../i18n/strings'

/**
 * Emotion Recognition 360 is bilingual (Kerala deployment): every 360-specific
 * line is authored in English and Malayalam, and one chosen language (Profile →
 * Language) is rendered and spoken per play.
 *
 * The *question* itself ("Who feels happy?") is not here — it is shared with the
 * flat game via `whoFeelsQuestion` in i18n/strings, so the 2D↔360 comparison
 * keeps identical wording. Only the scaffolding around it lives here.
 */
type Entry = Record<Lang, string>

const MESSAGES = {
  // Spoken/shown reactions to a tap.
  sayCorrect: { en: 'Yes! Well done!', ml: 'അതെ! കൊള്ളാം!' },
  sayTryAgain: { en: "Let's look again together.", ml: 'നമുക്ക് ഒന്നുകൂടി നോക്കാം.' },
  // The gentle "look around" hint (easy/medium only).
  hintLook: { en: 'Look around — find the face.', ml: 'ചുറ്റും നോക്കൂ — ആ മുഖം കണ്ടെത്തൂ.' },
  sayWin: {
    en: 'You found every feeling! Wonderful looking!',
    ml: 'എല്ലാ ഭാവങ്ങളും കണ്ടെത്തി! മിടുക്കൻ/മിടുക്കി!',
  },
  // Level-picker captions — surface the fading-scaffold + confusability manipulation.
  noteEasy: { en: 'Two faces, easy to tell apart, gentle hints', ml: 'രണ്ട് മുഖങ്ങൾ, എളുപ്പം, സൂചനകൾ' },
  noteMedium: { en: 'Three faces, slower hints', ml: 'മൂന്ന് മുഖങ്ങൾ, പതുക്കെ സൂചന' },
  noteHard: { en: 'Three tricky faces, no hints — all you!', ml: 'മൂന്ന് സമാന മുഖങ്ങൾ, സൂചനയില്ല' },
  // The one-time look-around teaching hint over the canvas.
  dragHint: { en: 'Drag to look left and right', ml: 'ഇടത്തോട്ടും വലത്തോട്ടും വലിച്ചു നോക്കൂ' },
  enterVR: { en: 'Enter VR', ml: 'VR-ൽ കളിക്കൂ' },
} satisfies Record<string, Entry>

export type EmotionRoomKey = keyof typeof MESSAGES

export function roomLine(key: EmotionRoomKey, lang: Lang): string {
  return MESSAGES[key][lang]
}
