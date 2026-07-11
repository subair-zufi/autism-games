/**
 * Item bank for Right or Wrong — the social-norms judgment game.
 *
 * Research design (mirrors Good Choice / the emotion battery):
 *  - Binary judgment task: the child watches a frozen social moment and judges
 *    whether the behaviour is okay or not okay. The response set is always the
 *    same two buttons, so guessing chance is 1/2 at every level.
 *  - Difficulty therefore lives in the *stimulus*, not the response set. Every
 *    behaviour is tagged with a tier: `clear` (overtly kind or overtly
 *    antisocial) or `subtle`. Subtle not-okay items are passive omissions —
 *    walking past without greeting, not saying thanks, hogging a turn — the
 *    clinically interesting autistic error. Subtle okay items *look* unusual
 *    but are socially fine (polite refusal, boundary-setting, asking for alone
 *    time), so "unusual = wrong" heuristics score at chance.
 *  - Construct taxonomy: greetings / sharing / turns / space / politeness, so
 *    per-construct accuracy always has a denominator.
 *  - Balanced valence: each construct × pool × tier cell holds exactly one
 *    okay and one not-okay behaviour (5 × 2 × 2 × 2 = 40 items), so every
 *    level is 5 okay / 5 not-okay and response bias is measurable.
 *  - Training vs probe pools: probe behaviours are held out of practice and
 *    only appear in Assessment mode, so generalization is measured on unseen
 *    items.
 *  - Bilingual (Kerala deployment): every child-facing line carries English
 *    and Malayalam, written colloquially (same convention as Good Choice).
 *
 * Scene cues reuse the existing RightWayScene prop vocabulary (turnAway, toy,
 * line, bump, polite, waveBack, pose) plus one addition: `toy: 'hold'` for the
 * passive keep-it-to-yourself items (blocks held close, no tug jitter).
 */
import type { Lang } from '../../i18n/strings'

export type Construct = 'greetings' | 'sharing' | 'turns' | 'space' | 'politeness'
export const CONSTRUCTS: Construct[] = ['greetings', 'sharing', 'turns', 'space', 'politeness']

/** Which item pool a behaviour belongs to (probe = held-out assessment items). */
export type StimulusPool = 'training' | 'probe'

/** Stimulus difficulty tier — what the levels are built from (see logic.ts). */
export type Tier = 'clear' | 'subtle'

/** A child-facing line in both display languages. */
export type BiText = Record<Lang, string>

export interface Pose {
  /** actor raises one arm (waving / reaching) */
  armUp?: boolean
  /** actor leans toward the other character (grabbing / pushing) */
  lean?: number
  /** actor crowds the other character's personal space */
  close?: boolean
}

/** Concrete props the 3D scene draws so the picture matches the sentence. */
export interface SceneCue {
  /** actor is turned away from the friend (ignoring / walking off) */
  turnAway?: boolean
  /** blocks held out kindly ('offer'), snatched ('grab'), or kept close ('hold') */
  toy?: 'offer' | 'grab' | 'hold'
  /** a queue of waiting kids */
  line?: boolean
  /** a little bump star between the two characters */
  bump?: boolean
  /** a polite words heart cue */
  polite?: boolean
  /** the friend is happy and waving back */
  waveBack?: boolean
}

export interface Behavior {
  id: string
  construct: Construct
  pool: StimulusPool
  tier: Tier
  /** true when the behaviour is okay as it is */
  isFine: boolean
  /** what the narrator describes about the frozen moment */
  text: BiText
  /** emoji cue shown in the bubble above the scene */
  bubble: string
  /** spoken after the child answers (practice mode only) */
  explain: BiText
  pose: Pose
  scene: SceneCue
}

export const BEHAVIORS: Behavior[] = [
  // --- greetings ---------------------------------------------------------------
  {
    id: 'wave',
    construct: 'greetings', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: 'Maya sees her friend and waves hello.',
      ml: 'മായ കൂട്ടുകാരിയെ കണ്ടപ്പോൾ കൈ വീശി ഹലോ പറഞ്ഞു.',
    },
    bubble: '👋',
    explain: {
      en: 'Waving hello is a friendly way to greet.',
      ml: 'കൈ വീശി ഹലോ പറയുന്നത് നല്ല സ്നേഹമുള്ള രീതിയാ.',
    },
    pose: { armUp: true }, scene: { waveBack: true },
  },
  {
    id: 'ignore',
    construct: 'greetings', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: "Ben's friend says hi, but Ben makes a face and turns away.",
      ml: 'ബെന്നിന്റെ കൂട്ടുകാരൻ ഹായ് പറഞ്ഞു, പക്ഷേ ബെൻ മുഖം കോട്ടി തിരിഞ്ഞുനിന്നു.',
    },
    bubble: '🙈',
    explain: {
      en: 'Turning away like that hurts. Say hi back.',
      ml: 'അങ്ങനെ തിരിഞ്ഞുനിന്നാൽ വിഷമമാകും. തിരിച്ച് ഹായ് പറയ്.',
    },
    pose: {}, scene: { turnAway: true },
  },
  {
    id: 'shywave',
    construct: 'greetings', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: 'Anu feels shy, so she smiles and gives a small wave instead of speaking.',
      ml: 'അനുവിന് നാണമായതുകൊണ്ട് ഒന്നും പറയാതെ ചെറുതായി ചിരിച്ച് കൈ വീശി.',
    },
    bubble: '🙂',
    explain: {
      en: "A small wave is a real greeting too — you don't have to talk.",
      ml: 'ചെറിയ കൈവീശലും ഒരു നല്ല ഹലോ ആണ് — സംസാരിക്കണം എന്നില്ല.',
    },
    pose: { armUp: true }, scene: { waveBack: true },
  },
  {
    id: 'walkpast',
    construct: 'greetings', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: 'Ravi walks right past his friend, looking at his shoes, and says nothing.',
      ml: 'രവി കൂട്ടുകാരന്റെ അടുത്തുകൂടെ താഴേക്ക് നോക്കി ഒന്നും പറയാതെ നടന്നുപോയി.',
    },
    bubble: '🚶',
    explain: {
      en: 'His friend feels unseen. A hi or a little wave would be kinder.',
      ml: 'കൂട്ടുകാരന് ആരും കണ്ടില്ലെന്ന് തോന്നി. ഒരു ഹായ് പറഞ്ഞിരുന്നെങ്കിൽ നന്നായേനെ.',
    },
    pose: {}, scene: { turnAway: true },
  },
  {
    id: 'morning',
    construct: 'greetings', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: "Sana smiles and says 'Good morning!' to her teacher.",
      ml: "സന ചിരിച്ചുകൊണ്ട് ടീച്ചറോട് 'ഗുഡ് മോർണിംഗ്!' പറഞ്ഞു.",
    },
    bubble: '🌞',
    explain: {
      en: 'A cheerful greeting starts the day well.',
      ml: 'സന്തോഷത്തോടെ വിഷ് ചെയ്താൽ ദിവസം നന്നാകും.',
    },
    pose: { armUp: true }, scene: { polite: true, waveBack: true },
  },
  {
    id: 'goaway',
    construct: 'greetings', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: "A friend comes to say hi, and Manu shouts, 'Go away!'",
      ml: "കൂട്ടുകാരൻ ഹായ് പറയാൻ വന്നപ്പോൾ മനു 'പോ അവിടുന്ന്!' എന്ന് ഒച്ചവെച്ചു.",
    },
    bubble: '📢',
    explain: {
      en: "Shouting 'go away' hurts a lot. Say hi back instead.",
      ml: 'അങ്ങനെ ഒച്ചവെച്ചാൽ വലിയ വിഷമമാകും. പകരം ഹായ് പറയ്.',
    },
    pose: { lean: 0.4 }, scene: {},
  },
  {
    id: 'busyhi',
    construct: 'greetings', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: "Meera is tying her shoe, so she says, 'Hi! One minute, I'm coming.'",
      ml: "മീര ഷൂ കെട്ടുകയായിരുന്നു, അതുകൊണ്ട് 'ഹായ്! ഒരു മിനിറ്റ്, ഞാൻ വരാം' എന്ന് പറഞ്ഞു.",
    },
    bubble: '👟',
    explain: {
      en: "She still greeted her friend — finishing what you're doing first is okay.",
      ml: 'അവൾ ഹായ് പറഞ്ഞല്ലോ — ചെയ്യുന്ന കാര്യം തീർത്തിട്ട് വരുന്നത് തെറ്റല്ല.',
    },
    pose: { armUp: true }, scene: { polite: true },
  },
  {
    id: 'noanswer',
    construct: 'greetings', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: 'A new boy says hello to Anu. Anu keeps playing and says nothing.',
      ml: 'പുതിയ കുട്ടി അനുവിനോട് ഹലോ പറഞ്ഞു. അനു ഒന്നും മിണ്ടാതെ കളി തുടർന്നു.',
    },
    bubble: '🧍',
    explain: {
      en: 'Saying nothing makes him feel unwelcome. A short hello helps.',
      ml: 'ഒന്നും മിണ്ടാതിരുന്നാൽ അവന് വിഷമമാകും. ഒരു ചെറിയ ഹലോ മതി.',
    },
    pose: {}, scene: { turnAway: true, toy: 'hold' },
  },

  // --- sharing -----------------------------------------------------------------
  {
    id: 'share',
    construct: 'sharing', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: 'Leo shares his blocks with a friend.',
      ml: 'ലിയോ കൂട്ടുകാരന് തന്റെ ബ്ലോക്കുകൾ പങ്കുവെച്ചു.',
    },
    bubble: '🧸',
    explain: {
      en: 'Sharing helps everyone have fun.',
      ml: 'പങ്കുവെച്ചാൽ എല്ലാവർക്കും രസമാ.',
    },
    pose: { armUp: true }, scene: { toy: 'offer' },
  },
  {
    id: 'grab',
    construct: 'sharing', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: "Ravi grabs a toy right out of someone's hands.",
      ml: 'രവി ഒരു കുട്ടിയുടെ കയ്യിൽ നിന്ന് കളിപ്പാട്ടം പിടിച്ചുവാങ്ങി.',
    },
    bubble: '✋',
    explain: {
      en: 'Grabbing hurts and starts fights. Ask for a turn instead.',
      ml: 'പിടിച്ചുവാങ്ങിയാൽ വഴക്കാകും. പകരം ഊഴം ചോദിക്ക്.',
    },
    pose: { lean: 0.4 }, scene: { toy: 'grab' },
  },
  {
    id: 'afterturn',
    construct: 'sharing', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: "Anu says, 'You can have the doll after my turn.'",
      ml: "'എന്റെ ഊഴം കഴിഞ്ഞിട്ട് നിനക്ക് തരാം' എന്ന് അനു പറഞ്ഞു.",
    },
    bubble: '🔁',
    explain: {
      en: 'Finishing your turn first is fair — she promised to share.',
      ml: 'ഊഴം തീർത്തിട്ട് കൊടുക്കുന്നത് ന്യായമാ — പങ്കുവെക്കാമെന്ന് പറഞ്ഞല്ലോ.',
    },
    pose: {}, scene: { toy: 'hold', polite: true },
  },
  {
    id: 'twoboxes',
    construct: 'sharing', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: 'Meera has two boxes of crayons. Her friend has none. Meera keeps both and says nothing.',
      ml: 'മീരയുടെ കയ്യിൽ രണ്ട് പെട്ടി ക്രയോൺസ് ഉണ്ട്. കൂട്ടുകാരിക്ക് ഒന്നുമില്ല. മീര രണ്ടും വെച്ചോണ്ട് ഒന്നും പറഞ്ഞില്ല.',
    },
    bubble: '🎨',
    explain: {
      en: 'Her friend has nothing to draw with. Sharing one box would be kind.',
      ml: 'കൂട്ടുകാരിക്ക് വരയ്ക്കാൻ ഒന്നുമില്ലല്ലോ. ഒരു പെട്ടി കൊടുക്കുന്നതാ നല്ലത്.',
    },
    pose: {}, scene: { toy: 'hold' },
  },
  {
    id: 'snack',
    construct: 'sharing', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: 'Manu gives his friend half of his snack.',
      ml: 'മനു തന്റെ പലഹാരത്തിന്റെ പകുതി കൂട്ടുകാരന് കൊടുത്തു.',
    },
    bubble: '🍪',
    explain: {
      en: 'Sharing your snack like that is very kind.',
      ml: 'അങ്ങനെ പങ്കുവെക്കുന്നത് വലിയ നല്ല കാര്യമാ.',
    },
    pose: { armUp: true }, scene: { toy: 'offer', waveBack: true },
  },
  {
    id: 'allmine',
    construct: 'sharing', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: "Sana pulls all the crayons to herself and says, 'All mine!'",
      ml: "സന എല്ലാ ക്രയോൺസും വലിച്ചെടുത്ത് 'എല്ലാം എന്റേതാ!' എന്ന് പറഞ്ഞു.",
    },
    bubble: '🖍️',
    explain: {
      en: 'Taking everything leaves others with none. Share so all can draw.',
      ml: 'എല്ലാം എടുത്താൽ മറ്റുള്ളവർക്ക് ഒന്നുമില്ലാതാകും. പങ്കുവെച്ചാൽ എല്ലാവർക്കും വരയ്ക്കാം.',
    },
    pose: { lean: 0.4 }, scene: { toy: 'grab' },
  },
  {
    id: 'redone',
    construct: 'sharing', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: "Ravi says, 'I'm still using this car. You can take the red one.'",
      ml: "'ഈ കാർ ഞാൻ കളിക്കുവാ. നിനക്ക് ചുവന്നത് എടുക്കാം' എന്ന് രവി പറഞ്ഞു.",
    },
    bubble: '🚗',
    explain: {
      en: 'Offering another toy is a fair way to share.',
      ml: 'വേറൊരു കളിപ്പാട്ടം കൊടുക്കുന്നതും നല്ല പങ്കുവെക്കലാ.',
    },
    pose: { armUp: true }, scene: { toy: 'offer' },
  },
  {
    id: 'nothear',
    construct: 'sharing', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: 'A friend asks Aisha for one block. Aisha pretends not to hear and keeps building.',
      ml: 'ഒരു ബ്ലോക്ക് ചോദിച്ചപ്പോൾ ആയിഷ കേൾക്കാത്ത പോലെ ഇരുന്ന് കെട്ടിടം പണിതു.',
    },
    bubble: '🧱',
    explain: {
      en: 'Pretending not to hear leaves her friend with nothing. One block is easy to share.',
      ml: 'കേൾക്കാത്ത ഭാവം നടിച്ചാൽ കൂട്ടുകാരന് ഒന്നും കിട്ടില്ല. ഒരു ബ്ലോക്ക് കൊടുക്കാലോ.',
    },
    pose: {}, scene: { toy: 'hold', turnAway: true },
  },

  // --- turns (waiting & turn-taking) ---------------------------------------------
  {
    id: 'waitline',
    construct: 'turns', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: 'Anu stands in the line and waits for her turn on the slide.',
      ml: 'അനു വരിയിൽ നിന്ന് സ്ലൈഡിനുള്ള ഊഴം കാത്തുനിൽക്കുന്നു.',
    },
    bubble: '⏳',
    explain: {
      en: 'Waiting in line is fair to everyone.',
      ml: 'വരിയിൽ കാത്തുനിൽക്കുന്നത് എല്ലാവരോടും ന്യായമാ.',
    },
    pose: {}, scene: { line: true },
  },
  {
    id: 'push',
    construct: 'turns', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: 'Sam pushes the other children to get to the front of the line.',
      ml: 'സാം മറ്റു കുട്ടികളെ തള്ളിമാറ്റി വരിയുടെ മുന്നിലേക്ക് കയറി.',
    },
    bubble: '😠',
    explain: {
      en: 'Pushing is unsafe and unfair. Wait your turn.',
      ml: 'തള്ളുന്നത് അപകടവും അന്യായവുമാ. ഊഴം കാത്തുനിൽക്ക്.',
    },
    pose: { lean: 0.4 }, scene: { line: true },
  },
  {
    id: 'letsmall',
    construct: 'turns', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: 'Meera lets a smaller boy take his turn on the swing before her.',
      ml: 'മീര തന്നെക്കാൾ ചെറിയ കുട്ടിയെ ആദ്യം ഊഞ്ഞാലാടാൻ വിട്ടു.',
    },
    bubble: '💗',
    explain: {
      en: 'Letting someone go first is a kind choice — the turn was hers to give.',
      ml: 'സ്വന്തം ഊഴം മറ്റൊരാൾക്ക് കൊടുക്കുന്നത് നല്ല മനസ്സാ.',
    },
    pose: { armUp: true }, scene: { line: true, waveBack: true },
  },
  {
    id: 'onemore',
    construct: 'turns', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: "Children are waiting, but Ravi keeps saying 'one more go' and stays on the swing.",
      ml: "കുട്ടികൾ കാത്തുനിൽക്കുമ്പോഴും രവി 'ഒന്നൂടെ, ഒന്നൂടെ' എന്ന് പറഞ്ഞ് ഊഞ്ഞാലിൽ തന്നെ ഇരുന്നു.",
    },
    bubble: '⏳',
    explain: {
      en: 'The others keep waiting and waiting. Give the next child a turn.',
      ml: 'മറ്റുള്ളവർ കാത്തുനിന്ന് മടുത്തു. അടുത്ത കുട്ടിക്ക് ഊഴം കൊടുക്ക്.',
    },
    pose: {}, scene: { line: true, toy: 'hold' },
  },
  {
    id: 'handball',
    construct: 'turns', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: 'Sana finishes her turn and hands the ball to the next child.',
      ml: 'സനയുടെ ഊഴം കഴിഞ്ഞപ്പോൾ പന്ത് അടുത്ത കുട്ടിക്ക് കൈമാറി.',
    },
    bubble: '🏀',
    explain: {
      en: 'Passing it on when your turn ends keeps the game fun for everyone.',
      ml: 'ഊഴം കഴിഞ്ഞ് പന്ത് കൈമാറിയാൽ കളി എല്ലാവർക്കും രസമാ.',
    },
    pose: { armUp: true }, scene: { toy: 'offer', line: true },
  },
  {
    id: 'mefirst',
    construct: 'turns', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: "Manu shouts 'Me first!' and squeezes in at the front of the line.",
      ml: "മനു 'ഞാൻ ആദ്യം!' എന്ന് ഒച്ചവെച്ച് വരിയുടെ മുന്നിൽ തിരുകിക്കയറി.",
    },
    bubble: '📢',
    explain: {
      en: 'Cutting the line is unfair to those waiting. Join at the back.',
      ml: 'ഇടയ്ക്ക് കയറുന്നത് കാത്തുനിൽക്കുന്നവരോട് അന്യായമാ. പിന്നിൽ പോയി നിൽക്ക്.',
    },
    pose: { lean: 0.4 }, scene: { line: true },
  },
  {
    id: 'afteryou',
    construct: 'turns', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: "Aisha asks, 'Can I go after you?' and stands behind her friend.",
      ml: "'നിന്റെ കഴിഞ്ഞിട്ട് ഞാൻ പൊയ്ക്കോട്ടെ?' എന്ന് ചോദിച്ച് ആയിഷ കൂട്ടുകാരിയുടെ പിന്നിൽ നിന്നു.",
    },
    bubble: '🙋',
    explain: {
      en: 'Asking and waiting behind is exactly how turns work.',
      ml: 'ചോദിച്ചിട്ട് പിന്നിൽ കാത്തുനിൽക്കുന്നതാ ശരിയായ രീതി.',
    },
    pose: { armUp: true }, scene: { line: true, polite: true },
  },
  {
    id: 'taplong',
    construct: 'turns', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: 'The line is moving, but Ben stays at the water tap a long, long time.',
      ml: 'വരി നീങ്ങുകയാ, പക്ഷേ ബെൻ പൈപ്പിന്റെ അടുത്ത് ഒരുപാട് നേരം നിന്നു.',
    },
    bubble: '🚰',
    explain: {
      en: 'The children behind are thirsty too. Finish and give the next one a turn.',
      ml: 'പിന്നിലുള്ള കുട്ടികൾക്കും ദാഹമുണ്ട്. വേഗം കുടിച്ചിട്ട് അടുത്തയാൾക്ക് കൊടുക്ക്.',
    },
    pose: {}, scene: { line: true },
  },

  // --- space (personal space & gentle body) ----------------------------------------
  {
    id: 'tap',
    construct: 'space', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: 'Maya taps her friend gently on the shoulder to ask something.',
      ml: 'മായ ഒരു കാര്യം ചോദിക്കാൻ കൂട്ടുകാരിയുടെ തോളിൽ പതിയെ തട്ടി.',
    },
    bubble: '🤚',
    explain: {
      en: 'A gentle tap is a polite way to get attention.',
      ml: 'പതിയെ തട്ടി വിളിക്കുന്നത് മര്യാദയുള്ള രീതിയാ.',
    },
    pose: { armUp: true }, scene: { waveBack: true },
  },
  {
    id: 'tooclose',
    construct: 'space', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: "Tom pushes his face very close to someone else's face to talk.",
      ml: 'ടോം സംസാരിക്കാൻ മറ്റൊരാളുടെ മുഖത്തോട് മുഖം ചേർത്ത് നിന്നു.',
    },
    bubble: '😬',
    explain: {
      en: 'Too close feels uncomfortable. Give friends a little space.',
      ml: 'അത്ര അടുത്ത് നിന്നാൽ ബുദ്ധിമുട്ടാകും. കുറച്ച് അകലം കൊടുക്ക്.',
    },
    pose: { close: true, lean: 0.2 }, scene: {},
  },
  {
    id: 'highfive',
    construct: 'space', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: "Anu doesn't like hugs, so she offers a high-five instead.",
      ml: 'അനുവിന് കെട്ടിപ്പിടിക്കുന്നത് ഇഷ്ടമല്ല, അതുകൊണ്ട് പകരം ഹൈ-ഫൈവ് കൊടുത്തു.',
    },
    bubble: '✋',
    explain: {
      en: 'Saying how you like to be greeted is okay — a high-five is friendly too.',
      ml: 'എങ്ങനെ വേണമെന്ന് പറയുന്നത് തെറ്റല്ല — ഹൈ-ഫൈവും സ്നേഹമാ.',
    },
    pose: { armUp: true }, scene: { waveBack: true },
  },
  {
    id: 'squeeze',
    construct: 'space', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: "Manu squeezes between two friends without saying 'excuse me', bumping them.",
      ml: "മനു 'എക്സ്ക്യൂസ് മീ' പറയാതെ രണ്ട് കൂട്ടുകാരുടെ ഇടയിലൂടെ തള്ളിനീങ്ങി, അവരെ തട്ടി.",
    },
    bubble: '💨',
    explain: {
      en: "Bumping through isn't kind. Say excuse me and go around.",
      ml: 'തട്ടിനീങ്ങുന്നത് ശരിയല്ല. എക്സ്ക്യൂസ് മീ പറഞ്ഞ് ചുറ്റി പോകാം.',
    },
    pose: { lean: 0.3 }, scene: { bump: true, line: true },
  },
  {
    id: 'asksit',
    construct: 'space', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: "Sana asks, 'Can I sit next to you?' before sitting down.",
      ml: "'ഞാൻ അടുത്തിരുന്നോട്ടെ?' എന്ന് ചോദിച്ചിട്ടാ സന ഇരുന്നത്.",
    },
    bubble: '🪑',
    explain: {
      en: "Asking first shows respect for other people's space.",
      ml: 'ആദ്യം ചോദിക്കുന്നത് മറ്റുള്ളവരോടുള്ള മര്യാദയാ.',
    },
    pose: {}, scene: { polite: true, waveBack: true },
  },
  {
    id: 'pullbag',
    construct: 'space', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: "Ben pulls his friend's bag hard to make him turn around.",
      ml: 'ബെൻ കൂട്ടുകാരന്റെ ബാഗ് പിടിച്ച് ശക്തിയായി വലിച്ചു.',
    },
    bubble: '🎒',
    explain: {
      en: 'Pulling can hurt. Call his name or tap gently instead.',
      ml: 'വലിച്ചാൽ വേദനിക്കും. പേര് വിളിക്കുകയോ പതിയെ തട്ടുകയോ ചെയ്യ്.',
    },
    pose: { lean: 0.4 }, scene: { toy: 'grab' },
  },
  {
    id: 'alonetime',
    construct: 'space', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: "Manu wants some quiet time, so he says, 'I'll play with you after lunch.'",
      ml: "മനുവിന് കുറച്ച് നേരം ഒറ്റയ്ക്കിരിക്കണം, അതുകൊണ്ട് 'ഊണ് കഴിഞ്ഞ് ഞാൻ കളിക്കാം' എന്ന് പറഞ്ഞു.",
    },
    bubble: '🤫',
    explain: {
      en: 'Asking for quiet time kindly is okay — he promised to play later.',
      ml: 'സ്നേഹത്തോടെ സമയം ചോദിക്കുന്നത് തെറ്റല്ല — പിന്നെ കളിക്കാമെന്ന് പറഞ്ഞല്ലോ.',
    },
    pose: {}, scene: { polite: true },
  },
  {
    id: 'leanover',
    construct: 'space', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: "Aisha leans right over Meera's drawing to watch, almost lying on it.",
      ml: 'ആയിഷ മീരയുടെ വരയുടെ മീതെ കുനിഞ്ഞ് നോക്കി, ഏകദേശം അതിന്റെ പുറത്ത് കിടക്കുന്ന പോലെ.',
    },
    bubble: '🖍️',
    explain: {
      en: "Meera can't draw like that. Watch from beside her.",
      ml: 'അങ്ങനെ നിന്നാൽ മീരയ്ക്ക് വരയ്ക്കാൻ പറ്റില്ല. അടുത്ത് മാറിനിന്ന് നോക്കാം.',
    },
    pose: { close: true, lean: 0.3 }, scene: {},
  },

  // --- politeness --------------------------------------------------------------
  {
    id: 'sorry',
    construct: 'politeness', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: "Ada bumps someone by accident and says, 'Sorry!'",
      ml: "അറിയാതെ തട്ടിയപ്പോൾ ആദ 'സോറി!' പറഞ്ഞു.",
    },
    bubble: '🙏',
    explain: {
      en: 'Saying sorry shows you care.',
      ml: 'സോറി പറയുന്നത് സ്നേഹമുള്ളതുകൊണ്ടാ.',
    },
    pose: { armUp: true }, scene: { bump: true },
  },
  {
    id: 'demand',
    construct: 'politeness', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: "Ravi shouts, 'Give me that NOW!' at his friend.",
      ml: "രവി കൂട്ടുകാരനോട് 'അത് ഇപ്പോ താ!' എന്ന് ഒച്ചവെച്ചു.",
    },
    bubble: '📢',
    explain: {
      en: 'Shouting orders is rude. Ask with a please.',
      ml: 'ഒച്ചവെച്ച് ആജ്ഞാപിക്കുന്നത് മോശമാ. പ്ലീസ് പറഞ്ഞ് ചോദിക്ക്.',
    },
    pose: { lean: 0.4 }, scene: {},
  },
  {
    id: 'nothanks',
    construct: 'politeness', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: "Meera doesn't want to play now, so she says, 'No thank you, maybe later.'",
      ml: "മീരയ്ക്ക് ഇപ്പോ കളിക്കണ്ട, അതുകൊണ്ട് 'വേണ്ട, താങ്ക്സ്. പിന്നെയാകാം' എന്ന് പറഞ്ഞു.",
    },
    bubble: '🙂',
    explain: {
      en: "Saying no politely is okay — you don't have to play every time.",
      ml: 'മര്യാദയോടെ വേണ്ടെന്ന് പറയുന്നത് തെറ്റല്ല — എപ്പോഴും കളിക്കണം എന്നില്ല.',
    },
    pose: {}, scene: { polite: true },
  },
  {
    id: 'nosorry',
    construct: 'politeness', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: "Ben knocks over a friend's tower by accident and walks away without a word.",
      ml: 'ബെൻ അറിയാതെ കൂട്ടുകാരന്റെ ബ്ലോക്ക് ടവർ തട്ടിയിട്ടു, ഒന്നും പറയാതെ നടന്നുപോയി.',
    },
    bubble: '🧱',
    explain: {
      en: 'Accidents happen, but walking away hurts. Say sorry and help rebuild.',
      ml: 'അറിയാതെ പറ്റുന്നത് തെറ്റല്ല, പക്ഷേ മിണ്ടാതെ പോയാൽ വിഷമമാകും. സോറി പറഞ്ഞ് വീണ്ടും കെട്ടാൻ സഹായിക്ക്.',
    },
    pose: {}, scene: { bump: true, turnAway: true },
  },
  {
    id: 'thanks',
    construct: 'politeness', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: "Aisha's friend helps her up, and she says, 'Thank you!'",
      ml: "കൂട്ടുകാരി എഴുന്നേൽക്കാൻ സഹായിച്ചപ്പോൾ ആയിഷ 'താങ്ക്യൂ!' പറഞ്ഞു.",
    },
    bubble: '💝',
    explain: {
      en: 'Thanking people makes them feel appreciated.',
      ml: 'നന്ദി പറഞ്ഞാൽ അവർക്ക് സന്തോഷമാകും.',
    },
    pose: { armUp: true }, scene: { polite: true, waveBack: true },
  },
  {
    id: 'meanname',
    construct: 'politeness', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: 'Manu loses the game and calls his friend a mean name.',
      ml: 'കളിയിൽ തോറ്റപ്പോൾ മനു കൂട്ടുകാരനെ മോശം പേര് വിളിച്ചു.',
    },
    bubble: '😠',
    explain: {
      en: 'Mean names hurt long after the game. Losing is okay.',
      ml: 'മോശം വിളികൾ വലിയ വേദനയാ. തോൽക്കുന്നത് ഒരു കുഴപ്പവുമല്ല.',
    },
    pose: { lean: 0.4 }, scene: {},
  },
  {
    id: 'excuseme',
    construct: 'politeness', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: "Sana needs her teacher, who is talking, so she says 'Excuse me' and waits.",
      ml: "ടീച്ചർ സംസാരിക്കുകയായിരുന്നു, അതുകൊണ്ട് സന 'എക്സ്ക്യൂസ് മീ' പറഞ്ഞ് കാത്തുനിന്നു.",
    },
    bubble: '🙋',
    explain: {
      en: "'Excuse me' and a little wait is the polite way to interrupt.",
      ml: 'എക്സ്ക്യൂസ് മീ പറഞ്ഞ് കാത്തുനിൽക്കുന്നതാ മര്യാദ.',
    },
    pose: { armUp: true }, scene: { polite: true },
  },
  {
    id: 'giftquiet',
    construct: 'politeness', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: 'A friend gives Ravi a birthday gift. Ravi takes it and says nothing.',
      ml: 'കൂട്ടുകാരൻ രവിക്ക് പിറന്നാൾ സമ്മാനം കൊടുത്തു. രവി അത് വാങ്ങി ഒന്നും പറഞ്ഞില്ല.',
    },
    bubble: '🎁',
    explain: {
      en: 'His friend chose it specially. A thank you makes them feel happy.',
      ml: 'കൂട്ടുകാരൻ പ്രത്യേകം എടുത്തതാ. ഒരു താങ്ക്യൂ പറഞ്ഞാൽ അവന് സന്തോഷമാകും.',
    },
    pose: {}, scene: { toy: 'hold' },
  },
]

/** Behaviours of one construct within one pool (a level draws from these). */
export function behaviorsFor(construct: Construct, pool: StimulusPool): Behavior[] {
  return BEHAVIORS.filter((b) => b.construct === construct && b.pool === pool)
}
