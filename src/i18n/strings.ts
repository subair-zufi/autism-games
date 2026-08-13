/**
 * Centralized localization ("string table") for player-facing text.
 *
 * Goals (from the product spec):
 *  - Every question is shown in English AND Malayalam, and the system must make
 *    adding a third language trivial.
 *  - No user-facing strings are hardcoded inside game scripts — game/UI code
 *    only ever references keys through the helpers below.
 *
 * To add a language: extend `Lang`, add its entries to every table, and (if it
 * should be shown alongside the others in prompts) add it to `DISPLAY_LANGS`.
 */
import type { EmotionId } from '../games/emotionVocab'

export type Lang = 'en' | 'ml'

/** Whether the child in a picture is a boy or a girl — drives he/she prompts. */
export type Gender = 'boy' | 'girl'

/** All languages the app knows about (order = display order). */
export const LANGS: Lang[] = ['en', 'ml']

/**
 * Every language the app can render a prompt in. Kept as the canonical list
 * (used by tests and by the language switcher). Prompts are now shown in a
 * single chosen language, not side by side — see `displayLangs`.
 */
export const DISPLAY_LANGS: Lang[] = ['en', 'ml']

/**
 * The language(s) a prompt is actually shown/spoken in. The learner picks one
 * language in Settings (Profile → Language), and prompts render only in that
 * language — showing English and Malayalam together was visually busy. Returns
 * a single-element array so callers can keep mapping over it (and so a future
 * "show both" option is a one-line change here).
 */
export function displayLangs(lang: Lang): Lang[] {
  return [lang]
}

type Entry = Record<Lang, string>

/**
 * UI + question strings. `{placeholder}` tokens are filled by `t(...)`.
 * Kept flat and key-based so nothing user-facing is inlined in components.
 */
const MESSAGES = {
  // --- Level select / chrome -------------------------------------------------
  gameTitle: { en: 'Emotion Recognition', ml: 'വികാരം തിരിച്ചറിയൽ' },
  chooseLevel: { en: 'Choose a level', ml: 'ഒരു ലെവൽ തിരഞ്ഞെടുക്കൂ' },
  play: { en: '▶ Play', ml: '▶ കളിക്കൂ' },
  levelEasy: { en: 'Easy', ml: 'എളുപ്പം' },
  levelMedium: { en: 'Moderate', ml: 'ഇടത്തരം' },
  levelHard: { en: 'Hard', ml: 'പ്രയാസം' },
  locked: { en: 'Locked', ml: 'പൂട്ടിയത്' },
  clipsTitle: { en: 'Emotion Clips', ml: 'വികാര ക്ലിപ്പുകൾ' },

  // --- In-game HUD -----------------------------------------------------------
  level: { en: 'Level', ml: 'ലെവൽ' },
  activity: { en: 'Activity {n} / {total}', ml: 'പ്രവർത്തനം {n} / {total}' },
  next: { en: 'Next ▶', ml: 'അടുത്തത് ▶' },
  finish: { en: 'Finish ▶', ml: 'പൂർത്തിയാക്കുക ▶' },

  // --- Questions -------------------------------------------------------------
  // Easy: single face. Gendered so the prompt matches the child in the picture
  // (a boy → "he", a girl → "she") instead of the awkward "he/she".
  questionSingleBoy: {
    en: 'How does he feel now?',
    ml: 'ഇപ്പോൾ അവന് എന്ത് വികാരമാണ് തോന്നുന്നത്?',
  },
  questionSingleGirl: {
    en: 'How does she feel now?',
    ml: 'ഇപ്പോൾ അവൾക്ക് എന്ത് വികാരമാണ് തോന്നുന്നത്?',
  },
  // Moderate/Hard "name the highlighted face" (this boy / this girl).
  questionNameBoy: {
    en: 'How does he feel?',
    ml: 'ഇവന് എന്ത് വികാരമാണ് തോന്നുന്നത്?',
  },
  questionNameGirl: {
    en: 'How does she feel?',
    ml: 'ഇവൾക്ക് എന്ത് വികാരമാണ് തോന്നുന്നത്?',
  },
  // Moderate/Hard "find the person". `{emotion}` is the localized "who" phrase.
  questionWho: { en: 'Who feels {emotion}?', ml: 'ആരാണ് {emotion}?' },

  // Emotion Clips — the clip is frozen on the peak expression and the learner is
  // asked to name it. Gendered so the pronoun matches the person on screen.
  questionVideoBoy: {
    en: 'What is he feeling now?',
    ml: 'അവൻ ഇപ്പോൾ എന്താണ് അനുഭവിക്കുന്നത്?',
  },
  questionVideoGirl: {
    en: 'What is she feeling now?',
    ml: 'അവൾ ഇപ്പോൾ എന്താണ് അനുഭവിക്കുന്നത്?',
  },
  // Shown while the clip is still playing, before it freezes on the peak frame.
  watchPrompt: { en: 'Watch carefully…', ml: 'ശ്രദ്ധയോടെ കാണൂ…' },

  // Emotion Clips follow-up: after the emotion is named correctly, ask for the
  // cause ("emotion understanding", not just labeling). `{emotion}` is the
  // localized emotion word.
  questionWhyBoy: {
    en: 'Why does he feel {emotion}?',
    ml: 'എന്തുകൊണ്ടാണ് അവന് {emotion} തോന്നുന്നത്?',
  },
  questionWhyGirl: {
    en: 'Why does she feel {emotion}?',
    ml: 'എന്തുകൊണ്ടാണ് അവൾക്ക് {emotion} തോന്നുന്നത്?',
  },

  // --- Feedback --------------------------------------------------------------
  feedbackCorrect: { en: 'Correct! 🎉', ml: 'ശരി! 🎉' },
  feedbackWrong: { en: 'Not quite — try to remember for next time.', ml: 'ശരിയായില്ല — അടുത്ത തവണ ഓർക്കാൻ ശ്രമിക്കൂ.' },
  // Emotion Clips feedback: warm praise, and a gentle nudge to try again.
  feedbackGreat: { en: 'Great job! 🎉', ml: 'കൊള്ളാം! 🎉' },
  feedbackTryAgain: { en: "Let's look again — try again.", ml: 'വീണ്ടും നോക്കാം — ഒന്നുകൂടി ശ്രമിക്കൂ.' },

  // --- In-world VR-only controls (shared across every 360 game) -------------
  // The DOM Home link is invisible inside an immersive headset session, so
  // this is the in-world equivalent — ends the session, drops back to the
  // flat page right where the game was.
  vrQuit: { en: 'Quit', ml: 'നിർത്തുക' },
  // In-world switch between the two selection methods, so the mode can be
  // changed without taking the headset off (the Profile page is invisible
  // inside a session). Kept short — the panels are small.
  vrInputGaze: { en: '👀 Gaze', ml: '👀 നോട്ടം' },
  vrInputController: { en: '🎮 Controller', ml: '🎮 കൺട്രോളർ' },

  // --- Pre-VR "waiting room" (shared across every 360 game) ------------------
  // Shown after Play is pressed on a headset-capable browser, in place of the
  // game itself, until the child is actually inside the VR session — Enter VR
  // is the only thing that starts the round (cues, timers, spoken prompts).
  vrGetReadyTitle: { en: 'Ready when you are!', ml: 'നിങ്ങൾ തയ്യാറാകുമ്പോൾ!' },
  vrGetReadyHint: {
    en: 'Put on your headset, then press Enter VR to begin.',
    ml: 'നിങ്ങളുടെ ഹെഡ്സെറ്റ് ധരിക്കൂ, എന്നിട്ട് തുടങ്ങാൻ Enter VR അമർത്തൂ.',
  },
  vrEnterPending: { en: 'Starting…', ml: 'തുടങ്ങുന്നു…' },

  // --- Game-over dialog (shared across the arcade-style games) ---------------
  greatPlaying: { en: 'Great playing! 🎉', ml: 'നന്നായി കളിച്ചു! 🎉' },
  greatTrying: { en: 'Great trying! 🌟', ml: 'നല്ല ശ്രമം! 🌟' },
  dialogEarned: { en: 'You earned ⭐ {score}', ml: 'നിനക്ക് ⭐ {score} കിട്ടി' },
  dialogBest: { en: 'Your best: {best}', ml: 'നിന്റെ ബെസ്റ്റ്: {best}' },

  // --- Result screen ---------------------------------------------------------
  resultTitle: { en: 'Level complete!', ml: 'ലെവൽ പൂർത്തിയായി!' },
  score: { en: 'Score', ml: 'സ്കോർ' },
  accuracy: { en: 'Accuracy', ml: 'കൃത്യത' },
  numCorrect: { en: 'Correct', ml: 'ശരി' },
  numIncorrect: { en: 'Incorrect', ml: 'തെറ്റ്' },
  playAgain: { en: 'Play again', ml: 'വീണ്ടും കളിക്കൂ' },
  changeLevel: { en: '🎚️ Choose level', ml: '🎚️ ലെവൽ തിരഞ്ഞെടുക്കൂ' },
  back: { en: '← Back', ml: '← തിരികെ' },
  home: { en: '🏠 Home', ml: '🏠 ഹോം' },
  // Mastery (≥80%): level fully complete.
  resultMastered: {
    en: 'Congratulations! You mastered this level.',
    ml: 'അഭിനന്ദനങ്ങൾ! നിങ്ങൾ ഈ ലെവൽ പൂർത്തിയാക്കി.',
  },
  // Passed (≥70%, <80%): encourage reaching mastery.
  resultPassed: {
    en: 'Well done! Reach 80% to master this level.',
    ml: 'നന്നായി! ഈ ലെവൽ പൂർത്തിയാക്കാൻ 80% എത്തിക്കൂ.',
  },
  // Failed (<70%): stay on this level, retry next session.
  resultFailed: {
    en: 'Keep practicing! You need at least 70% to unlock the next level.',
    ml: 'പരിശീലനം തുടരൂ! അടുത്ത ലെവൽ തുറക്കാൻ കുറഞ്ഞത് 70% വേണം.',
  },
  // --- Shared VR/360 practice warm-up (one-time, unscored — review U2) ------
  practiceIntro: {
    en: "Let's practice first! Look around and tap the star.",
    ml: 'നമുക്ക് ആദ്യം പരിശീലിക്കാം! ചുറ്റും നോക്കി നക്ഷത്രം തൊടൂ.',
  },
  // Inside a headset the child selects with the method set in Profile →
  // Selection, so the warm-up names the act they will actually perform. The
  // generic `practiceIntro` above still covers the flat screen, where the
  // mouse selects and neither method is active.
  practiceIntroController: {
    en: 'Point at the star and press the trigger.',
    ml: 'നക്ഷത്രത്തിലേക്ക് ചൂണ്ടി ട്രിഗർ അമർത്തൂ.',
  },
  practiceIntroDwell: {
    en: 'Look at the star, then look at the ✓ below it.',
    ml: 'നക്ഷത്രത്തിലേക്ക് നോക്കൂ, എന്നിട്ട് അതിനു താഴെയുള്ള ✓ നോക്കൂ.',
  },
  practiceGreat: { en: 'Great tap! 🌟', ml: 'നല്ല തൊടൽ! 🌟' },
  practiceReady: { en: "You're ready to play! 🎉", ml: 'നിനക്ക് ഇപ്പോൾ കളിക്കാം! 🎉' },

  // --- Emotion Clips (desktop) HUD ------------------------------------------
  videoCounter: { en: 'Video {n} / {total}', ml: 'വീഡിയോ {n} / {total}' },
  watchAgain: { en: '↻ Watch again', ml: '↻ വീണ്ടും കാണൂ' },
  sayGreat: { en: 'Great job!', ml: 'കൊള്ളാം!' },
  sayLookAgain: { en: "Let's look again.", ml: 'നമുക്ക് ഒന്നുകൂടി നോക്കാം.' },
  // aria-label on the 🔊 repeat-the-prompt button
  sayAgain: { en: 'Say it again', ml: 'വീണ്ടും പറയൂ' },
} satisfies Record<string, Entry>

export type MessageKey = keyof typeof MESSAGES

/** Emotion names used on the answer buttons. */
const EMOTION_LABELS: Record<EmotionId, Entry> = {
  happy: { en: 'Happy', ml: 'സന്തോഷം' },
  sad: { en: 'Sad', ml: 'ദുഃഖം' },
  angry: { en: 'Angry', ml: 'കോപം' },
  surprised: { en: 'Surprised', ml: 'അത്ഭുതം' },
  scared: { en: 'Scared', ml: 'ഭയം' },
  disgust: { en: 'Disgust', ml: 'വെറുപ്പ്' },
}

/**
 * The "who feels ___" form of each emotion. English reuses the plain label
 * ("Who feels Happy?"); Malayalam needs the possessive "-ഉള്ളത്" form
 * ("ആരാണ് സന്തോഷമുള്ളത്?"), so it is stored separately.
 */
const EMOTION_WHO: Record<EmotionId, Entry> = {
  happy: { en: 'happy', ml: 'സന്തോഷമുള്ളത്' },
  sad: { en: 'sad', ml: 'ദുഃഖമുള്ളത്' },
  angry: { en: 'angry', ml: 'കോപമുള്ളത്' },
  surprised: { en: 'surprised', ml: 'അത്ഭുതമുള്ളത്' },
  scared: { en: 'scared', ml: 'ഭയമുള്ളത്' },
  disgust: { en: 'disgusted', ml: 'വെറുപ്പുള്ളത്' },
}

/** Translate a UI/question key, interpolating `{token}` params. */
export function t(key: MessageKey, lang: Lang, params?: Record<string, string | number>): string {
  let text = MESSAGES[key][lang]
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, String(value))
    }
  }
  return text
}

/** Localized emotion name for answer buttons. */
export function emotionLabel(id: EmotionId, lang: Lang): string {
  return EMOTION_LABELS[id][lang]
}

/** Localized "Who feels ___?" prompt for the find-the-person question. */
export function whoFeelsQuestion(id: EmotionId, lang: Lang): string {
  return t('questionWho', lang, { emotion: EMOTION_WHO[id][lang] })
}

/** Easy-level single-face prompt, using the correct pronoun for the child. */
export function singleFaceQuestion(gender: Gender, lang: Lang): string {
  return t(gender === 'boy' ? 'questionSingleBoy' : 'questionSingleGirl', lang)
}

/** Highlighted-face prompt (Moderate/Hard), using the correct pronoun. */
export function nameFaceQuestion(gender: Gender, lang: Lang): string {
  return t(gender === 'boy' ? 'questionNameBoy' : 'questionNameGirl', lang)
}

/** Emotion Clips freeze prompt ("What is he/she feeling now?"), gendered. */
export function videoFreezeQuestion(gender: Gender, lang: Lang): string {
  return t(gender === 'boy' ? 'questionVideoBoy' : 'questionVideoGirl', lang)
}

/** A piece of authored bilingual text (e.g. cause options for why-questions). */
export type LocalizedText = Entry

/** Emotion Clips "why" follow-up ("Why does he/she feel happy?"), gendered. */
export function whyQuestion(gender: Gender, emotion: EmotionId, lang: Lang): string {
  const label = EMOTION_LABELS[emotion][lang]
  const word = lang === 'en' ? label.toLowerCase() : label
  return t(gender === 'boy' ? 'questionWhyBoy' : 'questionWhyGirl', lang, { emotion: word })
}
