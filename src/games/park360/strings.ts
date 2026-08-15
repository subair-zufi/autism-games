import type { Lang } from '../../i18n/strings'
import type { DiscoveryId } from './logic'

/**
 * Park 360 is bilingual (Kerala deployment): every child-facing line is
 * authored in English and Malayalam, and one chosen language (Profile →
 * Language) is rendered and spoken per play. Same lines as Look What I
 * Found! — the two games differ only in presentation, so keeping the words
 * identical preserves the 2D↔360 comparison.
 *
 * NOTE the deliberate silence: nothing is spoken when a surprise appears or
 * when the child taps it — a prompt there would destroy the spontaneity this
 * game exists to measure. Speech happens only in the friend's *reactions*,
 * the scaffolding nudges (easy/medium), and the win line.
 */
type Entry = Record<Lang, string>

const MESSAGES = {
  prompt: {
    en: 'See something new? Show your friend!',
    ml: 'പുതിയത് എന്തെങ്കിലും കണ്ടോ? ചങ്ങാതിയെ കാണിക്കൂ!',
  },
  // Friend tapped before the discovery — they turn around, curious.
  sayCurious: {
    en: 'What is it? Show me!',
    ml: 'എന്താ? കാണിച്ചു തരൂ!',
  },
  // The shared-affect payoff when the loop completes.
  sayWow: {
    en: 'Wow! A {label}! Thanks for showing me!',
    ml: 'ഹായ്! {label}! കാണിച്ചു തന്നതിന് നന്ദി!',
  },
  // Scaffolding nudges (never fire on hard).
  nudgeFind: {
    en: 'Ooh, look! Something new is here!',
    ml: 'ദേ നോക്കൂ! പുതിയത് എന്തോ വന്നിട്ടുണ്ട്!',
  },
  nudgeShare: {
    en: 'Tap your friend to show them!',
    ml: 'ചങ്ങാതിയെ തൊട്ടു കാണിക്കൂ!',
  },
  // Gaze-dwell wording: with the default gaze input the child *looks* at the
  // friend (and dwells) to bring them in — there is no tap. Chosen at fire time
  // by input method (see Park360Game's `gazeSelect`).
  nudgeShareGaze: {
    en: 'Look at your friend to show them!',
    ml: 'ചങ്ങാതിയെ നോക്കി കാണിക്കൂ!',
  },
  sayWin: {
    en: 'You shared every discovery! What a wonderful friend you are!',
    ml: 'എല്ലാം ചങ്ങാതിയെ കാണിച്ചുകൊടുത്തു! കൊള്ളാം!',
  },
  // Level-picker captions — surface the fading-scaffold manipulation.
  noteEasy: { en: 'Big surprises, quick hints', ml: 'വലിയ അത്ഭുതങ്ങൾ, വേഗം സൂചന' },
  noteMedium: { en: 'Quieter surprises, slower hints', ml: 'ചെറിയ അത്ഭുതങ്ങൾ, പതുക്കെ സൂചന' },
  noteHard: { en: 'Tiny surprises, no hints — all you!', ml: 'വളരെ ചെറിയ അത്ഭുതങ്ങൾ, സൂചനയില്ല' },
  // one-time "you can look around" hint, dismissed on the first drag (same
  // wording as the other 360 games' dragHint key)
  dragHint: { en: 'Drag to look left and right', ml: 'ഇടത്തോട്ടും വലത്തോട്ടും വലിച്ചു നോക്കൂ' },
} satisfies Record<string, Entry>

export type ParkKey = keyof typeof MESSAGES

/** Localized surprise names (spoken in the friend's "wow" reaction). */
const DISCOVERY_LABELS: Record<DiscoveryId, Entry> = {
  butterfly: { en: 'Butterfly', ml: 'പൂമ്പാറ്റ' },
  bunny: { en: 'Bunny', ml: 'മുയൽ' },
  bird: { en: 'Bird', ml: 'പക്ഷി' },
  flower: { en: 'Flower', ml: 'പൂവ്' },
  gem: { en: 'Gem', ml: 'രത്നം' },
  rainbow: { en: 'Rainbow', ml: 'മഴവില്ല്' },
}

export function parkLine(key: ParkKey, lang: Lang, params?: Record<string, string>): string {
  let text = MESSAGES[key][lang]
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v)
  return text
}

export function discoveryLabel(id: DiscoveryId, lang: Lang): string {
  return DISCOVERY_LABELS[id][lang]
}
