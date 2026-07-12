import type { Lang } from '../../i18n/strings'

/**
 * Block Buddies is bilingual (Kerala deployment): every child-facing line is
 * authored in English and Malayalam, and one chosen language (Profile →
 * Language) is rendered and spoken per play. Malayalam is warm and colloquial,
 * matching Roll-Back Buddy. Peer names stay romanized in both languages and the
 * wording avoids case-endings on them (e.g. "let Leo play" rather than
 * "Leo-nte turn"). Wording may benefit from a native review.
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
  sayGrabHint: {
    en: 'Use your hand — grab the block and put it on the tower!',
    ml: 'കൈകൊണ്ട് ബ്ലോക്ക് എടുത്ത് ഗോപുരത്തിൽ വെക്ക്!',
  },
  sayHandoff: {
    en: 'Your turn now, {name}!',
    ml: 'ഇനി {name} കളിക്കട്ടെ!',
  },

  // --- banner prompts --------------------------------------------------------
  promptHandoff: {
    en: 'Pass the turn — tap “{name}’s turn!”',
    ml: 'ഊഴം കൈമാറൂ — “{name} കളിക്കട്ടെ!” അമർത്തൂ',
  },
  promptGrab: {
    en: 'Your turn — grab the block and place it on the tower!',
    ml: 'നിന്റെ ഊഴം — ബ്ലോക്ക് എടുത്ത് ഗോപുരത്തിൽ വെക്കൂ!',
  },
  promptPlace: {
    en: 'Your turn — place a block!',
    ml: 'നിന്റെ ഊഴം — ഒരു ബ്ലോക്ക് വെക്കൂ!',
  },
  promptGetReady: {
    en: 'Get ready — you are next!',
    ml: 'റെഡിയായിക്കോ — അടുത്തത് നീയാ!',
  },
  promptWaitPeer: {
    en: '{name} is building. Wait for your turn.',
    ml: '{name} പണിയുന്നു. നിന്റെ ഊഴം വരെ കാത്തിരിക്കൂ.',
  },

  // --- player-button labels --------------------------------------------------
  btnGrab: { en: '🖐 Grab & place', ml: '🖐 എടുത്ത് വെക്കൂ' },
  btnPlace: { en: '🧱 Place', ml: '🧱 വെക്കൂ' },
  btnNext: { en: '⏳ You’re next!', ml: '⏳ അടുത്തത് നീ!' },
  btnWait: { en: '⏳ Wait', ml: '⏳ കാത്തിരിക്കൂ' },
  btnHandoff: { en: 'Your turn, {name}!', ml: '{name} കളിക്കട്ടെ!' },

  // Fallback peer label if the roster is momentarily empty.
  friend: { en: 'A friend', ml: 'ഒരു കൂട്ടുകാരൻ' },
} satisfies Record<string, Entry>

export type BlockKey = keyof typeof MESSAGES

export function blockLine(key: BlockKey, lang: Lang, params?: Record<string, string>): string {
  let text = MESSAGES[key][lang]
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v)
  return text
}
