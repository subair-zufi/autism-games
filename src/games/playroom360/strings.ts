import type { Lang } from '../../i18n/strings'
import { displayLangs } from '../../i18n/strings'

/**
 * Playroom 360 is bilingual (Kerala deployment) like Block Buddies: every
 * child-facing line is authored in English and Malayalam, and one chosen
 * language (Profile → Language) is rendered and spoken per play.
 *
 * Same message keys and flow as Block Buddies, reworded for the first-person
 * playroom: there are no on-screen buttons — the child taps their own block on
 * the table (or grabs it, on hard) and passes the turn by tapping the friend
 * whose turn is next. Peer names stay romanized in both languages and the
 * wording avoids case-endings on them (e.g. "let Leo play").
 */
type Entry = Record<Lang, string>

const MESSAGES = {
  // --- spoken flavour --------------------------------------------------------
  sayWin: {
    en: 'You built the whole tower together! Great team work!',
    ml: 'ഒരുമിച്ച് ഗോപുരം മുഴുവൻ പണിതു! നല്ല ടീം വർക്ക്!',
  },
  sayPeerNext: {
    en: '{name} is building. Get ready — you are next!',
    ml: '{name} പണിയുന്നു. റെഡിയായിക്കോ — അടുത്തത് നീയാ!',
  },
  sayPeerWait: {
    en: '{name} is building. Wait for your turn.',
    ml: '{name} പണിയുന്നു. നിന്റെ ഊഴം വരെ കാത്തിരിക്ക്.',
  },
  sayNiceBlock: { en: 'Nice block!', ml: 'കൊള്ളാം!' },
  sayPassFirst: {
    en: 'First let {name} have a turn!',
    ml: 'ആദ്യം {name} കളിക്കട്ടെ!',
  },
  sayWaitTurn: {
    en: 'Almost! Wait a moment for your turn.',
    ml: 'ഒന്ന് നിൽക്ക്! നിന്റെ ഊഴം വരട്ടെ.',
  },
  sayHandoff: {
    en: 'Your turn now, {name}!',
    ml: 'ഇനി {name} കളിക്കട്ടെ!',
  },

  // --- banner prompts --------------------------------------------------------
  promptHandoff: {
    en: 'Pass the turn — tap {name}!',
    ml: 'ഊഴം കൈമാറൂ — {name} തൊടൂ!',
  },
  // Gaze-dwell wording for the hand-off (look at the next friend to pass).
  promptHandoffGaze: {
    en: 'Pass the turn — look at {name}!',
    ml: 'ഊഴം കൈമാറൂ — {name} ഭാഗത്തേക്ക് നോക്കൂ!',
  },
  promptPlace: {
    en: 'Your turn — tap your glowing block!',
    ml: 'നിന്റെ ഊഴം — തിളങ്ങുന്ന ബ്ലോക്ക് തൊടൂ!',
  },
  // Gaze-dwell wording: with the default gaze input the child *looks* at the
  // block and rests their gaze to select — there is no tap, so a "tap" prompt
  // describes a gesture they never make. Chosen at render time by input method.
  promptPlaceGaze: {
    en: 'Your turn — look at your glowing block!',
    ml: 'നിന്റെ ഊഴം — തിളങ്ങുന്ന ബ്ലോക്കിൽ നോക്കൂ!',
  },
  promptGetReady: {
    en: 'Get ready — you are next!',
    ml: 'റെഡിയായിക്കോ — അടുത്തത് നീയാ!',
  },
  promptWaitPeer: {
    en: '{name} is building. Wait for your turn.',
    ml: '{name} പണിയുന്നു. നിന്റെ ഊഴം വരെ കാത്തിരിക്കൂ.',
  },

  // --- level-picker captions ---------------------------------------------------
  // Surface the turn-taking ladder on the picker, like the other 360 games:
  // how many builders share the tower, and whether the order can be anticipated.
  noteEasy: { en: 'Three builders, same turn order', ml: 'മൂന്ന് പേർ, ഒരേ ഊഴക്രമം' },
  noteMedium: { en: 'Four builders, same turn order', ml: 'നാല് പേർ, ഒരേ ഊഴക്രമം' },
  noteHard: { en: 'Five builders, order changes each round', ml: 'അഞ്ച് പേർ, ഊഴക്രമം മാറും' },

  // --- 3D overlays -------------------------------------------------------------
  hintLook: { en: 'Drag to look around the playroom', ml: 'മുറി ചുറ്റും കാണാൻ വലിച്ചു നോക്കൂ' },
  enterVR: { en: 'Enter VR', ml: 'VR-ൽ കളിക്കൂ' },
  bubbleMyTurn: { en: 'Tap me!', ml: 'എന്നെ തൊടൂ!' },
  // Gaze-dwell wording for the hand-off friend's bubble ("Look at me!").
  bubbleMyTurnGaze: { en: 'Look at me!', ml: 'എന്നെ നോക്കൂ!' },

  // Fallback peer label if the roster is momentarily empty.
  friend: { en: 'A friend', ml: 'ഒരു കൂട്ടുകാരൻ' },
} satisfies Record<string, Entry>

export type Playroom360MessageKey = keyof typeof MESSAGES

/** One language of a message, with `{token}` params resolved. */
export function prLine(
  key: Playroom360MessageKey,
  lang: Lang,
  params?: Record<string, string>,
): string {
  let text = MESSAGES[key][lang]
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v)
  return text
}

/** The message in the chosen language, ready for a banner/label. */
export function prLines(
  key: Playroom360MessageKey,
  lang: Lang,
  params?: Record<string, string>,
): Array<{ lang: Lang; text: string }> {
  return displayLangs(lang).map((l) => ({ lang: l, text: prLine(key, l, params) }))
}

/** The message in the chosen language, ready for `speakAll`. */
export function prSpeak(
  key: Playroom360MessageKey,
  lang: Lang,
  params?: Record<string, string>,
): Array<{ lang: Lang; text: string }> {
  return displayLangs(lang).map((l) => ({ lang: l, text: prLine(key, l, params) }))
}
