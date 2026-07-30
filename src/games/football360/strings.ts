import type { Lang } from '../../i18n/strings'
import { displayLangs } from '../../i18n/strings'

/**
 * Football 360 is bilingual (Kerala deployment) like Roll-Back Buddy: every
 * child-facing line is authored in English and Malayalam. Each play renders
 * and speaks a single chosen language (Profile → Language), not both at once.
 *
 * Same message keys and flow as Roll-Back Buddy, reworded for the pitch: the
 * ball is *passed*, not rolled across a garden. "പാസ്" is the everyday Kerala
 * football word, so the Malayalam stays warm and colloquial ("ആരാ റെഡി?",
 * "ഒന്നൂടെ നോക്ക്", "കൊള്ളാം!"), not a stiff rendering of the English. Names
 * stay in the nominative so no template ever has to decline them; the English
 * line uses the romanized name.
 */

/** A parameter that differs by language (e.g. a name: Malayalam vs romanized). */
type BiValue = string | Record<Lang, string>
type Params = Record<string, BiValue>

function resolve(v: BiValue, lang: Lang): string {
  return typeof v === 'string' ? v : v[lang]
}

type Entry = Record<Lang, string>

const MESSAGES = {
  // --- stage prompts (banner) ------------------------------------------------
  promptIncoming: {
    en: '{name} is passing the ball to you…',
    ml: '{name} നിനക്ക് പന്ത് പാസ് ചെയ്യുന്നു…',
  },
  promptCaught: {
    en: 'You got it! Now look around — who’s ready?',
    ml: 'പന്ത് കിട്ടിയല്ലോ! ഇനി ചുറ്റും നോക്ക്, ആരാ റെഡി?',
  },
  promptInitiate: {
    en: 'You’ve got the ball. Look at your teammates…',
    ml: 'പന്ത് നിന്റെ കയ്യിലുണ്ട്. കൂട്ടുകാരെ ഒന്ന് നോക്ക്…',
  },
  promptVerbal: {
    en: '{name} wants the ball — pass it back!',
    ml: '{name} പന്ത് ചോദിക്കുന്നു — പാസ് ചെയ്ത് കൊടുക്ക്!',
  },
  promptGesture: {
    en: 'Someone’s got their hands up — pass it to them!',
    ml: 'ആരാ കൈ പൊക്കി കാണിക്കുന്നേ? അവർക്ക് പാസ് ചെയ്ത് കൊടുക്ക്!',
  },
  promptOrient: {
    en: 'Who’s facing you? Pass the ball to them!',
    ml: 'ആരാ നിന്റെ നേരെ നോക്കി നിൽക്കുന്നേ? അവർക്ക് പാസ് ചെയ്ത് കൊടുക്ക്!',
  },
  promptReject: {
    en: 'Oops — they weren’t ready. Look again!',
    ml: 'അയ്യോ, അവർ റെഡി ആയിരുന്നില്ല! ഒന്നൂടെ നോക്ക്!',
  },
  promptRolling: { en: 'Nice pass!', ml: 'കൊള്ളാം, നല്ല പാസ്!' },

  // --- spoken flavour (voice) ------------------------------------------------
  sayIncoming: {
    en: '{name} passes you the ball. Trap it!',
    ml: '{name} നിനക്ക് പന്ത് പാസ് ചെയ്യുന്നു. പിടിച്ചോ!',
  },
  sayInitiate: {
    en: 'You’ve got the ball! Watch your teammates.',
    ml: 'പന്ത് നിന്റെ കയ്യിലുണ്ട്! കൂട്ടുകാരെ ഒന്ന് നോക്ക്.',
  },
  sayVerbalCue: {
    en: '{name} says: pass it to me!',
    ml: '{name} പറയുന്നു: എനിക്ക് പാസ് താ!',
  },
  sayGestureCue: { en: 'Who’s ready for the ball?', ml: 'ആരാ പന്ത് വാങ്ങാൻ റെഡി?' },
  sayOrientCue: {
    en: 'Look carefully. Who’s facing you?',
    ml: 'സൂക്ഷിച്ചു നോക്ക്. ആരാ നിന്റെ നേരെ നോക്കുന്നേ?',
  },
  sayPremature: {
    en: 'Wait! First see who’s ready.',
    ml: 'ഒന്ന് നിൽക്ക്! ആദ്യം ആരാ റെഡീന്ന് നോക്ക്.',
  },
  sayReject: {
    en: 'Oops — {name} wasn’t ready. Look again!',
    ml: 'അയ്യോ, {name} റെഡി ആയിരുന്നില്ല! ഒന്നൂടെ നോക്ക്!',
  },
  sayCorrect: {
    en: 'Great pass! {name} got it!',
    ml: 'കൊള്ളാം, നല്ല പാസ്! {name} പിടിച്ചു!',
  },
  sayWin: {
    en: 'You passed it back every time! What great teamwork!',
    ml: 'എല്ലാ തവണയും നന്നായി പാസ് ചെയ്തു! ഒരുമിച്ച് കളിച്ചത് നല്ല രസായി!',
  },
  sayLose: {
    en: 'Good try! Waiting is hard — you did really well.',
    ml: 'കൊള്ളാം, നല്ല ശ്രമം! കാത്തിരിക്കുന്നത് പ്രയാസാ, പക്ഷേ നീ നന്നായി ചെയ്തു!',
  },

  // --- level-picker captions ---------------------------------------------------
  // Surface the cue-fading ladder on the picker, like the other 360 games:
  // how many teammates there are, and how the ready teammate signals.
  noteEasy: { en: 'One teammate, asks out loud', ml: 'ഒരു കൂട്ടുകാരൻ, ഉറക്കെ ചോദിക്കും' },
  noteMedium: { en: 'Two teammates, hands up — no words', ml: 'രണ്ട് കൂട്ടുകാർ, കൈ ഉയർത്തും, വാക്കില്ല' },
  noteHard: { en: 'Three teammates, just body and look', ml: 'മൂന്ന് കൂട്ടുകാർ, നോട്ടം മാത്രം' },

  // --- 3D bubble & overlays ----------------------------------------------------
  bubbleAsk: { en: 'Pass it to me!', ml: 'എനിക്ക് പാസ് താ!' },
  hintLook: { en: 'Drag to look around the ground', ml: 'ഗ്രൗണ്ട് ചുറ്റും കാണാൻ വലിച്ചു നോക്കൂ' },
  enterVR: { en: 'Enter VR', ml: 'VR-ൽ കളിക്കൂ' },

  // --- game-over -------------------------------------------------------------
  overWin: { en: 'Great teamwork!', ml: 'നന്നായി കളിച്ചു!' },
  overTry: { en: 'Good try!', ml: 'നല്ല ശ്രമം!' },
} satisfies Record<string, Entry>

export type Football360MessageKey = keyof typeof MESSAGES

/** One language of a message, with `{token}` params resolved for that language. */
export function fbLine(key: Football360MessageKey, lang: Lang, params?: Params): string {
  let text = MESSAGES[key][lang]
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, resolve(value, lang))
    }
  }
  return text
}

/** The message in the chosen language, ready for a banner/label. */
export function fbLines(
  key: Football360MessageKey,
  lang: Lang,
  params?: Params,
): Array<{ lang: Lang; text: string }> {
  return displayLangs(lang).map((l) => ({ lang: l, text: fbLine(key, l, params) }))
}

/** The message in the chosen language, ready for `speakAll`. */
export function fbSpeak(
  key: Football360MessageKey,
  lang: Lang,
  params?: Params,
): Array<{ lang: Lang; text: string }> {
  return displayLangs(lang).map((l) => ({ lang: l, text: fbLine(key, l, params) }))
}
