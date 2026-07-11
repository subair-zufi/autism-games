import type { Lang } from '../../i18n/strings'
import { displayLangs } from '../../i18n/strings'

/**
 * Roll-Back Buddy is bilingual (Kerala deployment): every child-facing line is
 * authored in English and Malayalam. Each play renders and speaks a single
 * chosen language (Profile → Language), not both at once.
 *
 * The Malayalam is written the way people actually talk to a small child — warm
 * and colloquial ("ആരാ റെഡി?", "ഒന്നൂടെ നോക്ക്", "കൊള്ളാം!"), not a stiff
 * word-for-word rendering of the English. Names stay in the nominative so no
 * template ever has to decline them; the English line uses the romanized name.
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
    en: '{name} is rolling the ball to you…',
    ml: '{name} നിനക്ക് പന്ത് ഉരുട്ടിത്തരുന്നു…',
  },
  promptCaught: {
    en: 'You got it! Now look — who’s ready?',
    ml: 'പന്ത് കിട്ടിയല്ലോ! ഇനി നോക്ക്, ആരാ റെഡി?',
  },
  promptInitiate: {
    en: 'You’ve got the ball. Look at your friends…',
    ml: 'പന്ത് നിന്റെ കയ്യിലുണ്ട്. കൂട്ടുകാരെ ഒന്ന് നോക്ക്…',
  },
  promptVerbal: {
    en: '{name} wants the ball — roll it back!',
    ml: '{name} പന്ത് ചോദിക്കുന്നു — ഉരുട്ടിക്കൊടുക്ക്!',
  },
  promptGesture: {
    en: 'Someone’s got their hands up — roll it to them!',
    ml: 'ആരാ കൈ പൊക്കി കാണിക്കുന്നേ? അവർക്ക് ഉരുട്ടിക്കൊടുക്ക്!',
  },
  promptOrient: {
    en: 'Who’s facing you? Roll the ball to them!',
    ml: 'ആരാ നിന്റെ നേരെ നോക്കി നിൽക്കുന്നേ? അവർക്ക് ഉരുട്ടിക്കൊടുക്ക്!',
  },
  promptReject: {
    en: 'Oops — they weren’t ready. Look again!',
    ml: 'അയ്യോ, അവർ റെഡി ആയിരുന്നില്ല! ഒന്നൂടെ നോക്ക്!',
  },
  promptRolling: { en: 'Nice roll!', ml: 'കൊള്ളാം!' },

  // --- spoken flavour (voice) ------------------------------------------------
  sayIncoming: {
    en: '{name} rolls you the ball. Catch it!',
    ml: '{name} നിനക്ക് പന്ത് ഉരുട്ടിത്തരുന്നു. പിടിച്ചോ!',
  },
  sayInitiate: {
    en: 'You’ve got the ball! Watch your friends.',
    ml: 'പന്ത് നിന്റെ കയ്യിലുണ്ട്! കൂട്ടുകാരെ ഒന്ന് നോക്ക്.',
  },
  sayVerbalCue: {
    en: '{name} says: give it to me!',
    ml: '{name} പറയുന്നു: എനിക്ക് താ!',
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
    en: 'Nice roll! {name} caught it!',
    ml: 'കൊള്ളാം! {name} പിടിച്ചു!',
  },
  sayWin: {
    en: 'You rolled it back every time! That was great playing together!',
    ml: 'എല്ലാ തവണയും നന്നായി ഉരുട്ടിക്കൊടുത്തു! ഒരുമിച്ച് കളിച്ചത് നല്ല രസായി!',
  },
  sayLose: {
    en: 'Good try! Waiting is hard — you did really well.',
    ml: 'കൊള്ളാം, നല്ല ശ്രമം! കാത്തിരിക്കുന്നത് പ്രയാസാ, പക്ഷേ നീ നന്നായി ചെയ്തു!',
  },

  // --- chips & 3D bubble -----------------------------------------------------
  chipCatch: { en: 'Catch…', ml: 'പിടിച്ചോ…' },
  chipWatch: { en: 'Watch…', ml: 'നോക്ക്…' },
  chipRoll: { en: 'Roll it back!', ml: 'ഉരുട്ടിക്കൊടുക്ക്!' },
  chipNice: { en: 'Nice!', ml: 'കൊള്ളാം!' },
  bubbleAsk: { en: 'Give it to me!', ml: 'എനിക്ക് താ!' },

  // --- game-over -------------------------------------------------------------
  overWin: { en: 'Great playing together!', ml: 'നന്നായി കളിച്ചു!' },
  overTry: { en: 'Good try!', ml: 'നല്ല ശ്രമം!' },
} satisfies Record<string, Entry>

export type RollBackMessageKey = keyof typeof MESSAGES

/** One language of a message, with `{token}` params resolved for that language. */
export function rbLine(key: RollBackMessageKey, lang: Lang, params?: Params): string {
  let text = MESSAGES[key][lang]
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, resolve(value, lang))
    }
  }
  return text
}

/** The message in the chosen language, ready for a banner/label. */
export function rbLines(
  key: RollBackMessageKey,
  lang: Lang,
  params?: Params,
): Array<{ lang: Lang; text: string }> {
  return displayLangs(lang).map((l) => ({ lang: l, text: rbLine(key, l, params) }))
}

/** The message in the chosen language, ready for `speakAll`. */
export function rbSpeak(
  key: RollBackMessageKey,
  lang: Lang,
  params?: Params,
): Array<{ lang: Lang; text: string }> {
  return displayLangs(lang).map((l) => ({ lang: l, text: rbLine(key, l, params) }))
}
