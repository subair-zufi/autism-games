import type { Lang } from '../../i18n/strings'
import type { ExhibitId } from './logic'

/**
 * Museum 360 is bilingual (Kerala deployment) like Museum Look: every
 * child-facing line is authored in English and Malayalam, and one chosen
 * language (Profile → Language) is rendered and spoken per play — never both
 * at once. Malayalam is warm and colloquial, the way you'd talk to a small
 * child. Malayalam wording may benefit from a native review.
 */
type Entry = Record<Lang, string>

// Lines stay cue-agnostic ("what they show you", not "the hand") because the
// prompt fades within a session and the top rung has no hand at all — only a
// face turning to look at the target. The 360 twist is surfaced in the prompt:
// the child must *turn around* to find what is shown.
const MESSAGES = {
  // Two cue kinds, two prompts, so the child knows what to follow this trial.
  promptPoint: {
    en: 'They are pointing — tap what they point to!',
    ml: 'അവർ ചൂണ്ടുന്നു — ചൂണ്ടുന്നത് തൊട്ടോളൂ!',
  },
  promptLook: {
    en: 'They are looking — tap where they look!',
    ml: 'അവർ നോക്കുന്നു — നോക്കുന്നത് തൊട്ടോളൂ!',
  },
  // Gaze-dwell wording: with the default gaze input the child *looks* at the
  // exhibit and rests their gaze to select — there is no tap. Chosen at render
  // time by input method (see Museum360Game's `gazeSelect`).
  promptPointGaze: {
    en: 'They are pointing — look at what they point to!',
    ml: 'അവർ ചൂണ്ടുന്നു — ചൂണ്ടുന്നത് നോക്കൂ!',
  },
  promptLookGaze: {
    en: 'They are looking — look where they look!',
    ml: 'അവർ നോക്കുന്നു — നോക്കുന്നത് നോക്കൂ!',
  },
  sayWin: {
    en: 'You followed every cue! Wonderful looking!',
    ml: 'എല്ലാം നന്നായി പിന്തുടർന്നു! കൊള്ളാം!',
  },
  sayCorrect: {
    en: 'Yes! The {label}!',
    ml: 'ശരി! {label}!',
  },
  sayWrong: {
    en: 'Look again — which one are they showing you?',
    ml: 'ഒന്നൂടെ നോക്ക് — ഏതാ കാണിക്കുന്നത്?',
  },
  // Level-picker captions — surface where the fading ladder starts. All cues
  // come from the helper avatar; support fades from a glowing target down to
  // just their look.
  noteEasy: { en: 'Point + glowing target to start', ml: 'തുടക്കം ചൂണ്ടലും തിളങ്ങുന്ന ലക്ഷ്യവും' },
  noteMedium: { en: 'Point + sparkle trail to start', ml: 'തുടക്കം മിന്നും പൊട്ടുകളോടെ ചൂണ്ടൽ' },
  noteHard: { en: 'Plain point, fading to just a look', ml: 'വെറും ചൂണ്ടൽ, പിന്നെ നോട്ടം മാത്രം' },
  // one-time "you can look around" hint, dismissed on the first drag (same
  // wording as the other 360 games' dragHint key)
  dragHint: { en: 'Drag to look left and right', ml: 'ഇടത്തോട്ടും വലത്തോട്ടും വലിച്ചു നോക്കൂ' },
} satisfies Record<string, Entry>

export type Museum360Key = keyof typeof MESSAGES

/** Localized exhibit names (spoken on a correct find). */
const EXHIBIT_LABELS: Record<ExhibitId, Entry> = {
  gem: { en: 'Gem', ml: 'രത്നം' },
  dino: { en: 'Dino', ml: 'ദിനോ' },
  rocket: { en: 'Rocket', ml: 'റോക്കറ്റ്' },
  vase: { en: 'Vase', ml: 'പൂപ്പാത്രം' },
  mask: { en: 'Mask', ml: 'മുഖംമൂടി' },
  crystal: { en: 'Crystal', ml: 'പളുങ്ക്' },
}

export function museum360Line(key: Museum360Key, lang: Lang, params?: Record<string, string>): string {
  let text = MESSAGES[key][lang]
  if (params) for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, v)
  return text
}

export function exhibitLabel(id: ExhibitId, lang: Lang): string {
  return EXHIBIT_LABELS[id][lang]
}
