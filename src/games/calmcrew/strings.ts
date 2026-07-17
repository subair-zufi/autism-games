import type { Lang } from '../../i18n/strings'
import type { StrategyId, TriggerId } from './logic'

/**
 * Calm Crew is bilingual (Kerala deployment): every child-facing line is
 * authored in English and Malayalam, and the one chosen language (Profile →
 * Language) is rendered and spoken per play. The Malayalam is warm and
 * colloquial to match the other games; a native pass is welcome, especially on
 * the coping-strategy microcopy.
 *
 * Tone rules for this game specifically:
 *  - Situations are stated plainly and briefly — no drama, no scary wording.
 *  - Every reaction to a strategy is validating; there is no "wrong" line.
 */
type Entry = Record<Lang, string>

const MESSAGES = {
  // "Name it" — the appraisal beat. Deliberately first-person ("you").
  feelPrompt: {
    en: 'Something happened. How do you feel?',
    ml: 'എന്തോ സംഭവിച്ചു. നിനക്ക് എങ്ങനെ തോന്നുന്നു?',
  },
  // "Choose it" — open the toolkit.
  choosePrompt: {
    en: 'That is a big feeling. What can we do to feel calm?',
    ml: 'അതൊരു വലിയ വികാരമാണ്. ശാന്തമാകാൻ നമുക്ക് എന്ത് ചെയ്യാം?',
  },
  // The meter's two ends.
  meterBig: { en: 'Big feeling', ml: 'വലിയ വികാരം' },
  meterCalm: { en: 'Calm', ml: 'ശാന്തം' },
  // Feedback after a completed round — 'good' when a fitting tool was used,
  // 'ok' otherwise. Both are warm; 'ok' still celebrates the calming.
  feedbackGood: {
    en: 'You feel calm again — and that was a great choice!',
    ml: 'നീ വീണ്ടും ശാന്തനായി — അത് നല്ലൊരു തിരഞ്ഞെടുപ്പായിരുന്നു!',
  },
  feedbackOk: {
    en: 'You brought the big feeling down. Well done!',
    ml: 'നീ വലിയ വികാരത്തെ താഴെക്കൊണ്ടുവന്നു. കൊള്ളാം!',
  },
  win: {
    en: 'You calmed every big feeling! You are a Calm Crew captain! ⭐',
    ml: 'എല്ലാ വലിയ വികാരങ്ങളെയും നീ ശാന്തമാക്കി! നീ ഒരു കാം ക്രൂ ക്യാപ്റ്റനാണ്! ⭐',
  },
  // Level-picker captions — surface how the support fades across levels.
  noteEasy: { en: 'A tool is suggested, all the time you need', ml: 'ഒരു വഴി നിർദ്ദേശിക്കും, വേണ്ടത്ര സമയം' },
  noteMedium: { en: 'You choose the tool; keep it going', ml: 'നീ വഴി തിരഞ്ഞെടുക്കൂ; തുടർന്നു ചെയ്യൂ' },
  noteHard: { en: 'Trickier feelings, no hints — stay with it', ml: 'വിഷമമുള്ള വികാരങ്ങൾ, സൂചനയില്ല — പിടിച്ചുനിൽക്കൂ' },

  // Breathing coaching (paced to the balloon).
  breatheIn: { en: 'Breathe in…', ml: 'ശ്വാസം ഉള്ളിലേക്ക്…' },
  breatheOut: { en: 'Breathe out…', ml: 'ശ്വാസം പുറത്തേക്ക്…' },
  breatheHold: { en: 'Hold the balloon to breathe in', ml: 'ശ്വാസമെടുക്കാൻ ബലൂൺ പിടിക്കൂ' },
  // Counting coaching.
  countTap: { en: 'Tap each number, nice and slow', ml: 'ഓരോ നമ്പറും പതുക്കെ തൊടൂ' },
  // Quick coping actions: step 1 (do it) and step 2 (notice it worked).
  quickNotice: { en: 'Good. Notice you feel a little better.', ml: 'കൊള്ളാം. കുറച്ച് ആശ്വാസം തോന്നുന്നത് ശ്രദ്ധിക്കൂ.' },
} satisfies Record<string, Entry>

export type CalmKey = keyof typeof MESSAGES

export function calmLine(key: CalmKey, lang: Lang, params?: Record<string, string>): string {
  let text = MESSAGES[key][lang]
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v)
  return text
}

// ---- Situations ------------------------------------------------------------

const TRIGGER_LINES: Record<TriggerId, Entry> = {
  tower: { en: 'Your block tower just fell down.', ml: 'നിന്റെ ബ്ലോക്ക് ഗോപുരം വീണുപോയി.' },
  lostGame: { en: 'You lost the game you were playing.', ml: 'നീ കളിച്ചുകൊണ്ടിരുന്ന കളിയിൽ തോറ്റു.' },
  loudNoise: { en: 'A sudden loud noise!', ml: 'പെട്ടെന്ന് ഒരു വലിയ ശബ്ദം!' },
  brokeToy: { en: 'Your favourite toy broke.', ml: 'നിന്റെ ഇഷ്ട കളിപ്പാട്ടം പൊട്ടിപ്പോയി.' },
  waiting: { en: 'You have been waiting a long, long time.', ml: 'നീ വളരെ വളരെ നേരമായി കാത്തിരിക്കുന്നു.' },
  darkRoom: { en: 'The room suddenly went dark.', ml: 'മുറി പെട്ടെന്ന് ഇരുട്ടായി.' },
  spilled: { en: 'Your drink spilled everywhere.', ml: 'നിന്റെ പാനീയം എല്ലായിടത്തും തൂവിപ്പോയി.' },
  crowded: { en: 'The place is very crowded and noisy.', ml: 'സ്ഥലം നല്ല തിരക്കും ബഹളവുമാണ്.' },
  cantFind: { en: 'You cannot find your school bag.', ml: 'നിന്റെ സ്കൂൾ ബാഗ് കണ്ടെത്താൻ കഴിയുന്നില്ല.' },
  teased: { en: 'Someone teased you at play.', ml: 'കളിക്കുന്നതിനിടെ ആരോ നിന്നെ കളിയാക്കി.' },
}

export function triggerLine(id: TriggerId, lang: Lang): string {
  return TRIGGER_LINES[id][lang]
}

// ---- Strategy names + "how to" microcopy -----------------------------------

interface StrategyText {
  /** Card label. */
  label: Entry
  /** One-line instruction shown while the child performs it. */
  action: Entry
}

const STRATEGY_TEXT: Record<StrategyId, StrategyText> = {
  breathe: {
    label: { en: 'Balloon Breathing', ml: 'ബലൂൺ ശ്വാസം' },
    action: { en: 'Hold to breathe in, let go to breathe out', ml: 'പിടിച്ച് ശ്വാസമെടുക്കൂ, വിട്ട് പുറത്തുവിടൂ' },
  },
  count: {
    label: { en: 'Count to Ten', ml: 'പത്ത് വരെ എണ്ണൂ' },
    action: { en: 'Tap each number slowly', ml: 'ഓരോ നമ്പറും പതുക്കെ തൊടൂ' },
  },
  ask: {
    label: { en: 'Ask for Help', ml: 'സഹായം ചോദിക്കൂ' },
    action: { en: 'Ask a grown-up: “Can you help me?”', ml: 'മുതിർന്നവരോട് ചോദിക്കൂ: “എന്നെ സഹായിക്കാമോ?”' },
  },
  walk: {
    label: { en: 'Take a Break', ml: 'ഒരു ഇടവേള എടുക്കൂ' },
    action: { en: 'Walk to your calm spot', ml: 'നിന്റെ ശാന്ത സ്ഥലത്തേക്ക് നടക്കൂ' },
  },
  squeeze: {
    label: { en: 'Squeeze & Let Go', ml: 'അമർത്തി പിടിച്ച് വിടൂ' },
    action: { en: 'Squeeze your hands tight… then let go', ml: 'കൈകൾ മുറുക്കി പിടിക്കൂ… പിന്നെ വിടൂ' },
  },
}

export function strategyLabel(id: StrategyId, lang: Lang): string {
  return STRATEGY_TEXT[id].label[lang]
}

export function strategyAction(id: StrategyId, lang: Lang): string {
  return STRATEGY_TEXT[id].action[lang]
}
