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
 *  - Balanced valence: each construct × pool × tier cell holds exactly two
 *    okay and two not-okay behaviours (5 × 2 × 2 × 2 × 2 = 80 items). A level
 *    samples one exemplar per cell it needs, so every level stays 10 trials
 *    (5 okay / 5 not-okay — no fatigue) while repeated sessions rotate
 *    through different exemplars, accumulating enough per-construct evidence
 *    to read one child's strength on a single construct rather than only
 *    group means.
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

  // === second exemplar per cell (per-construct reliability) =====================
  // --- greetings ---------------------------------------------------------------
  {
    id: 'smilehi',
    construct: 'greetings', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: "Ravi sees his classmate and says 'Hi!' with a big smile.",
      ml: "രവി സഹപാഠിയെ കണ്ട് വലിയ ചിരിയോടെ 'ഹായ്!' പറഞ്ഞു.",
    },
    bubble: '😀',
    explain: {
      en: 'Saying hi with a smile is a warm greeting.',
      ml: 'ചിരിച്ചോണ്ട് ഹായ് പറയുന്നത് നല്ല സ്നേഹമാ.',
    },
    pose: { armUp: true }, scene: { waveBack: true },
  },
  {
    id: 'turnback',
    construct: 'greetings', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: 'A friend calls Sam by name to say hi, but Sam turns his back on him.',
      ml: 'കൂട്ടുകാരൻ പേര് വിളിച്ച് ഹായ് പറഞ്ഞു, പക്ഷേ സാം അവന് നേരെ പുറംതിരിഞ്ഞു നിന്നു.',
    },
    bubble: '🙅',
    explain: {
      en: 'Turning your back hurts. Turn around and say hi.',
      ml: 'പുറംതിരിഞ്ഞ് നിന്നാൽ വിഷമമാകും. തിരിഞ്ഞ് ഹായ് പറയ്.',
    },
    pose: {}, scene: { turnAway: true },
  },
  {
    id: 'nodhi',
    construct: 'greetings', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: "Anu's mouth is full of food, so she smiles and nods hello.",
      ml: 'അനുവിന്റെ വായിൽ ഭക്ഷണം ഉണ്ടായിരുന്നു, അതുകൊണ്ട് ചിരിച്ച് തലയാട്ടി ഹലോ പറഞ്ഞു.',
    },
    bubble: '🙂',
    explain: {
      en: 'A smile and a nod is a real hello too.',
      ml: 'ചിരിയും തലയാട്ടലും ഒരു നല്ല ഹലോ ആണ്.',
    },
    pose: {}, scene: { waveBack: true },
  },
  {
    id: 'lookaway',
    construct: 'greetings', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: "Ravi's friend says hi. Ravi hears it but keeps looking at the wall and says nothing.",
      ml: 'രവിയുടെ കൂട്ടുകാരൻ ഹായ് പറഞ്ഞു. രവി കേട്ടിട്ടും ചുമരിലേക്ക് നോക്കിനിന്ന് ഒന്നും മിണ്ടിയില്ല.',
    },
    bubble: '😐',
    explain: {
      en: 'Not answering makes him feel ignored. A quick hi helps.',
      ml: 'മറുപടി പറയാതിരുന്നാൽ അവന് അവഗണിച്ചെന്ന് തോന്നും. ഒരു ചെറിയ ഹായ് മതി.',
    },
    pose: {}, scene: { turnAway: true },
  },
  {
    id: 'welcomehi',
    construct: 'greetings', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: "A new girl joins the class, and Sana says, 'Hi! Welcome!'",
      ml: "പുതിയ കുട്ടി ക്ലാസ്സിൽ വന്നപ്പോൾ സന 'ഹായ്! വെൽക്കം!' എന്ന് പറഞ്ഞു.",
    },
    bubble: '🤗',
    explain: {
      en: 'A warm welcome helps a new friend feel happy.',
      ml: 'സ്നേഹത്തോടെ സ്വീകരിച്ചാൽ പുതിയ കൂട്ടുകാരിക്ക് സന്തോഷമാകും.',
    },
    pose: { armUp: true }, scene: { waveBack: true },
  },
  {
    id: 'tongue',
    construct: 'greetings', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: 'A friend says hello, and Ben sticks out his tongue at him.',
      ml: 'കൂട്ടുകാരൻ ഹലോ പറഞ്ഞപ്പോൾ ബെൻ അവനെ നോക്കി നാക്ക് നീട്ടിക്കാണിച്ചു.',
    },
    bubble: '😝',
    explain: {
      en: 'That is unkind. Say hello back instead.',
      ml: 'അത് മോശമാ. പകരം ഹലോ പറയ്.',
    },
    pose: { lean: 0.3 }, scene: {},
  },
  {
    id: 'washhi',
    construct: 'greetings', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: "Aisha's hands are wet at the tap, so she says, 'Hi! I'll come after I wash up.'",
      ml: "ആയിഷയുടെ കൈ പൈപ്പിന്റെ അടുത്ത് നനഞ്ഞിരുന്നു, അതുകൊണ്ട് 'ഹായ്! കൈ കഴുകിയിട്ട് വരാം' എന്ന് പറഞ്ഞു.",
    },
    bubble: '💧',
    explain: {
      en: 'She greeted her friend and will come soon — that is fine.',
      ml: 'അവൾ ഹായ് പറഞ്ഞല്ലോ, വേഗം വരികയും ചെയ്യും — അത് ശരിയാ.',
    },
    pose: { armUp: true }, scene: { polite: true },
  },
  {
    id: 'headphones',
    construct: 'greetings', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: 'A boy says hi to Meera. Meera sees him but turns back to her drawing without a word.',
      ml: 'ഒരു കുട്ടി മീരയോട് ഹായ് പറഞ്ഞു. മീര അവനെ കണ്ടിട്ടും ഒന്നും മിണ്ടാതെ വരയിലേക്ക് തിരിഞ്ഞു.',
    },
    bubble: '🧍',
    explain: {
      en: 'Ignoring his hello feels unfriendly. A short hi is kind.',
      ml: 'ഹായ് അവഗണിച്ചാൽ അവന് വിഷമമാകും. ഒരു ചെറിയ ഹായ് നല്ലതാ.',
    },
    pose: {}, scene: { turnAway: true, toy: 'hold' },
  },

  // --- sharing -----------------------------------------------------------------
  {
    id: 'sharecrayon',
    construct: 'sharing', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: 'Anu gives a friend some of her crayons to colour with.',
      ml: 'അനു കൂട്ടുകാരിക്ക് കുറച്ച് ക്രയോൺസ് വരയ്ക്കാൻ കൊടുത്തു.',
    },
    bubble: '🖍️',
    explain: {
      en: 'Sharing lets both of you have fun.',
      ml: 'പങ്കുവെച്ചാൽ രണ്ടുപേർക്കും രസമാ.',
    },
    pose: { armUp: true }, scene: { toy: 'offer' },
  },
  {
    id: 'snatchback',
    construct: 'sharing', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: 'Sam snatches the ball back from a friend who was playing with it.',
      ml: 'സാം കളിച്ചുകൊണ്ടിരുന്ന കൂട്ടുകാരന്റെ കയ്യിൽ നിന്ന് പന്ത് പിടിച്ചുവാങ്ങി.',
    },
    bubble: '✋',
    explain: {
      en: 'Snatching starts a fight. Ask for a turn instead.',
      ml: 'പിടിച്ചുവാങ്ങിയാൽ വഴക്കാകും. പകരം ഊഴം ചോദിക്ക്.',
    },
    pose: { lean: 0.4 }, scene: { toy: 'grab' },
  },
  {
    id: 'minutethen',
    construct: 'sharing', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: "Ravi says, 'Let me finish this row, then the blocks are yours.'",
      ml: "'ഈ വരി കെട്ടിത്തീർത്തിട്ട് ബ്ലോക്ക് നിനക്ക് തരാം' എന്ന് രവി പറഞ്ഞു.",
    },
    bubble: '🔁',
    explain: {
      en: 'Finishing first and then sharing is fair.',
      ml: 'തീർത്തിട്ട് കൊടുക്കുന്നത് ന്യായമാ.',
    },
    pose: {}, scene: { toy: 'hold', polite: true },
  },
  {
    id: 'fullplate',
    construct: 'sharing', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: 'Leo takes a big pile of biscuits and leaves none for the friend beside him.',
      ml: 'ലിയോ ഒരു കൂമ്പാരം ബിസ്‌ക്കറ്റ് എടുത്തു, അടുത്തിരുന്ന കൂട്ടുകാരന് ഒന്നും ബാക്കിവെച്ചില്ല.',
    },
    bubble: '🍪',
    explain: {
      en: 'His friend gets none. Leaving some to share is kind.',
      ml: 'കൂട്ടുകാരന് ഒന്നും കിട്ടിയില്ല. കുറച്ച് ബാക്കിവെക്കുന്നതാ നല്ലത്.',
    },
    pose: {}, scene: { toy: 'hold' },
  },
  {
    id: 'givepencil',
    construct: 'sharing', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: 'Sana lends her extra pencil to a friend who has none.',
      ml: 'സന തന്റെ അധിക പെൻസിൽ ഒന്നുമില്ലാത്ത കൂട്ടുകാരിക്ക് കൊടുത്തു.',
    },
    bubble: '✏️',
    explain: {
      en: 'Lending what you have spare is kind.',
      ml: 'ബാക്കിയുള്ളത് കൊടുക്കുന്നത് നല്ല മനസ്സാ.',
    },
    pose: { armUp: true }, scene: { toy: 'offer', waveBack: true },
  },
  {
    id: 'hugtoys',
    construct: 'sharing', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: "Manu piles all the toys into his lap and shouts, 'Nobody else can play!'",
      ml: "മനു എല്ലാ കളിപ്പാട്ടങ്ങളും മടിയിലേക്ക് വാരിക്കൂട്ടി 'വേറെ ആർക്കും കളിക്കാൻ പറ്റില്ല!' എന്ന് ഒച്ചവെച്ചു.",
    },
    bubble: '🧸',
    explain: {
      en: 'Keeping them all is unfair. Share so all can play.',
      ml: 'എല്ലാം സ്വന്തമാക്കുന്നത് ന്യായമല്ല. പങ്കുവെച്ചാൽ എല്ലാവർക്കും കളിക്കാം.',
    },
    pose: { lean: 0.4 }, scene: { toy: 'grab' },
  },
  {
    id: 'takethis',
    construct: 'sharing', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: 'Aisha is using the big drum, so she hands her friend the small one to play.',
      ml: 'ആയിഷ വലിയ ഡ്രം കൊട്ടുകയായിരുന്നു, അതുകൊണ്ട് ചെറിയ ഡ്രം കൂട്ടുകാരിക്ക് കൊട്ടാൻ കൊടുത്തു.',
    },
    bubble: '🥁',
    explain: {
      en: 'Offering the other one is a fair way to share.',
      ml: 'വേറൊന്ന് കൊടുക്കുന്നതും നല്ല പങ്കുവെക്കലാ.',
    },
    pose: { armUp: true }, scene: { toy: 'offer' },
  },
  {
    id: 'turnhold',
    construct: 'sharing', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: 'A friend asks Ben for one crayon. Ben turns away and holds the box tightly.',
      ml: 'ഒരു ക്രയോൺ ചോദിച്ചപ്പോൾ ബെൻ തിരിഞ്ഞ് പെട്ടി മുറുകെ പിടിച്ചു.',
    },
    bubble: '🖍️',
    explain: {
      en: 'Turning away leaves his friend with none. One crayon is easy to share.',
      ml: 'തിരിഞ്ഞുനിന്നാൽ കൂട്ടുകാരന് ഒന്നും കിട്ടില്ല. ഒരു ക്രയോൺ കൊടുക്കാലോ.',
    },
    pose: {}, scene: { toy: 'hold', turnAway: true },
  },

  // --- turns -------------------------------------------------------------------
  {
    id: 'waitswing',
    construct: 'turns', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: 'Sam waits behind his friend for his turn on the swing.',
      ml: 'സാം ഊഞ്ഞാലിനുള്ള ഊഴത്തിനായി കൂട്ടുകാരന്റെ പിന്നിൽ കാത്തുനിന്നു.',
    },
    bubble: '⏳',
    explain: {
      en: 'Waiting your turn is fair to everyone.',
      ml: 'ഊഴം കാത്തുനിൽക്കുന്നത് എല്ലാവരോടും ന്യായമാ.',
    },
    pose: {}, scene: { line: true },
  },
  {
    id: 'cutfront',
    construct: 'turns', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: 'Ravi runs straight to the front of the line without waiting.',
      ml: 'രവി കാത്തുനിൽക്കാതെ വരിയുടെ ഏറ്റവും മുന്നിലേക്ക് ഓടിക്കയറി.',
    },
    bubble: '😠',
    explain: {
      en: 'Cutting in is unfair. Go to the back and wait.',
      ml: 'ഇടയ്ക്ക് കയറുന്നത് അന്യായമാ. പിന്നിൽ പോയി കാത്തുനിൽക്ക്.',
    },
    pose: { lean: 0.4 }, scene: { line: true },
  },
  {
    id: 'yourturn',
    construct: 'turns', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: "Anu has the ball but says, 'It's your turn now,' and passes it on.",
      ml: "അനുവിന്റെ കയ്യിൽ പന്തുണ്ടായിരുന്നു, പക്ഷേ 'ഇനി നിന്റെ ഊഴം' എന്ന് പറഞ്ഞ് കൈമാറി.",
    },
    bubble: '💗',
    explain: {
      en: 'Giving up your turn kindly is a nice choice.',
      ml: 'സ്വന്തം ഊഴം സ്നേഹത്തോടെ കൊടുക്കുന്നത് നല്ലതാ.',
    },
    pose: { armUp: true }, scene: { toy: 'offer', line: true },
  },
  {
    id: 'againagain',
    construct: 'turns', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: "Others are waiting for the ball, but Sam keeps saying 'just one more' and holds on.",
      ml: "മറ്റുള്ളവർ പന്തിനായി കാത്തുനിൽക്കുമ്പോഴും സാം 'ഒന്നൂടെ മാത്രം' എന്ന് പറഞ്ഞ് പന്ത് വിട്ടില്ല.",
    },
    bubble: '⏳',
    explain: {
      en: 'The others wait and wait. Pass it to the next child.',
      ml: 'മറ്റുള്ളവർ കാത്തുനിന്ന് മടുത്തു. അടുത്ത കുട്ടിക്ക് കൈമാറ്.',
    },
    pose: {}, scene: { line: true, toy: 'hold' },
  },
  {
    id: 'passturn',
    construct: 'turns', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: 'When her turn on the slide ends, Sana climbs down so the next child can go.',
      ml: 'സനയുടെ സ്ലൈഡ് ഊഴം കഴിഞ്ഞപ്പോൾ അടുത്ത കുട്ടിക്ക് വേണ്ടി അവൾ താഴെയിറങ്ങി.',
    },
    bubble: '🛝',
    explain: {
      en: 'Stepping aside when your turn ends is fair.',
      ml: 'ഊഴം കഴിഞ്ഞ് മാറിക്കൊടുക്കുന്നത് ന്യായമാ.',
    },
    pose: {}, scene: { line: true, waveBack: true },
  },
  {
    id: 'shovein',
    construct: 'turns', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: 'Ben shoves in front of a smaller child to grab the next turn.',
      ml: 'അടുത്ത ഊഴം തട്ടിയെടുക്കാൻ ബെൻ ചെറിയ കുട്ടിയെ തള്ളിമാറ്റി മുന്നിൽ കയറി.',
    },
    bubble: '😠',
    explain: {
      en: 'Shoving in is unfair to those waiting. Wait your turn.',
      ml: 'തള്ളിക്കയറുന്നത് കാത്തുനിൽക്കുന്നവരോട് അന്യായമാ. ഊഴം കാത്തുനിൽക്ക്.',
    },
    pose: { lean: 0.4 }, scene: { line: true },
  },
  {
    id: 'holdplace',
    construct: 'turns', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: "Meera tells a friend, 'You go first, I'll wait here,' and stays in her place.",
      ml: "മീര കൂട്ടുകാരിയോട് 'നീ ആദ്യം പോ, ഞാൻ ഇവിടെ കാത്തുനിൽക്കാം' എന്ന് പറഞ്ഞ് സ്ഥലത്ത് നിന്നു.",
    },
    bubble: '🙋',
    explain: {
      en: 'Letting a friend go and waiting is exactly how turns work.',
      ml: 'കൂട്ടുകാരിയെ വിട്ടിട്ട് കാത്തുനിൽക്കുന്നതാ ശരിയായ രീതി.',
    },
    pose: {}, scene: { line: true, polite: true },
  },
  {
    id: 'sitlong',
    construct: 'turns', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: 'The class is sharing one book, but Aisha keeps it and reads for a very long time.',
      ml: 'ക്ലാസ് ഒരു പുസ്തകം പങ്കിടുകയാ, പക്ഷേ ആയിഷ അത് കയ്യിൽ വെച്ച് ഒരുപാട് നേരം വായിച്ചു.',
    },
    bubble: '📖',
    explain: {
      en: 'Others want a turn too. Finish and pass the book on.',
      ml: 'മറ്റുള്ളവർക്കും ഊഴം വേണം. വായിച്ചിട്ട് പുസ്തകം കൈമാറ്.',
    },
    pose: {}, scene: { line: true, toy: 'hold' },
  },

  // --- space -------------------------------------------------------------------
  {
    id: 'wavefar',
    construct: 'space', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: "Maya waves from a little way off to get her friend's attention.",
      ml: 'മായ കുറച്ച് അകലെനിന്ന് കൈ വീശി കൂട്ടുകാരിയുടെ ശ്രദ്ധ ക്ഷണിച്ചു.',
    },
    bubble: '🤚',
    explain: {
      en: 'Waving from nearby is a polite way to get attention.',
      ml: 'അടുത്തുനിന്ന് കൈ വീശുന്നത് മര്യാദയുള്ള രീതിയാ.',
    },
    pose: { armUp: true }, scene: { waveBack: true },
  },
  {
    id: 'shovechair',
    construct: 'space', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: 'Tom pushes his chair right up against a friend until they are squashed.',
      ml: 'ടോം തന്റെ കസേര കൂട്ടുകാരന്റെ അടുത്തേക്ക് അമർത്തി നീക്കി, അവന് ഞെരുങ്ങുന്നതുവരെ.',
    },
    bubble: '😬',
    explain: {
      en: 'That is too close and uncomfortable. Give a little space.',
      ml: 'അത് വല്ലാതെ അടുത്താ, ബുദ്ധിമുട്ടാകും. കുറച്ച് അകലം കൊടുക്ക്.',
    },
    pose: { close: true, lean: 0.2 }, scene: {},
  },
  {
    id: 'waveinstead',
    construct: 'space', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: "Ben doesn't like being touched, so he waves instead of shaking hands.",
      ml: 'ബെന്നിന് തൊടുന്നത് ഇഷ്ടമല്ല, അതുകൊണ്ട് ഹസ്തദാനത്തിന് പകരം കൈ വീശി.',
    },
    bubble: '👋',
    explain: {
      en: 'Choosing a wave over a touch is okay — it is still friendly.',
      ml: 'തൊടുന്നതിന് പകരം കൈ വീശുന്നത് തെറ്റല്ല — അതും സ്നേഹമാ.',
    },
    pose: { armUp: true }, scene: { waveBack: true },
  },
  {
    id: 'leanline',
    construct: 'space', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: 'In the line, Sam leans his whole body onto the boy in front of him.',
      ml: 'വരിയിൽ നിൽക്കുമ്പോൾ സാം തന്റെ ദേഹം മുഴുവൻ മുന്നിലുള്ള കുട്ടിയുടെ മേൽ ചാരി.',
    },
    bubble: '💨',
    explain: {
      en: 'Leaning on people feels crowding. Stand with a little gap.',
      ml: 'ആളുകളുടെ മേൽ ചാരുന്നത് ഞെരുക്കമാ. കുറച്ച് അകലം വിട്ട് നിൽക്ക്.',
    },
    pose: { lean: 0.3, close: true }, scene: { line: true },
  },
  {
    id: 'knockdoor',
    construct: 'space', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: 'Sana knocks and waits before going into the room.',
      ml: 'സന വാതിലിൽ മുട്ടി കാത്തുനിന്നിട്ടാ മുറിയിലേക്ക് കയറിയത്.',
    },
    bubble: '🚪',
    explain: {
      en: "Knocking first respects other people's space.",
      ml: 'മുട്ടിയിട്ട് കയറുന്നത് മറ്റുള്ളവരുടെ ഇടത്തോടുള്ള മര്യാദയാ.',
    },
    pose: {}, scene: { polite: true, waveBack: true },
  },
  {
    id: 'grabface',
    construct: 'space', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: "Manu grabs a friend's cheeks hard to turn his face toward him.",
      ml: 'മനു കൂട്ടുകാരന്റെ കവിളിൽ പിടിച്ച് ശക്തിയായി മുഖം തന്റെ നേരെ തിരിച്ചു.',
    },
    bubble: '😣',
    explain: {
      en: 'Grabbing his face hurts. Call his name gently instead.',
      ml: 'മുഖത്ത് പിടിച്ചാൽ വേദനിക്കും. പകരം പതിയെ പേര് വിളിക്ക്.',
    },
    pose: { lean: 0.4, close: true }, scene: {},
  },
  {
    id: 'restnow',
    construct: 'space', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: "Aisha is tired, so she says, 'I want to rest now. Let's play after.'",
      ml: "ആയിഷ ക്ഷീണിച്ചിരുന്നു, അതുകൊണ്ട് 'എനിക്ക് കുറച്ച് വിശ്രമിക്കണം. പിന്നെ കളിക്കാം' എന്ന് പറഞ്ഞു.",
    },
    bubble: '🤫',
    explain: {
      en: "Asking for rest kindly is okay — she'll play later.",
      ml: 'സ്നേഹത്തോടെ വിശ്രമം ചോദിക്കുന്നത് തെറ്റല്ല — പിന്നെ കളിക്കുമല്ലോ.',
    },
    pose: {}, scene: { polite: true },
  },
  {
    id: 'crowdbook',
    construct: 'space', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: "Ben leans in so close over Sana's book that she has to move away.",
      ml: 'ബെൻ സനയുടെ പുസ്തകത്തിന് മീതെ വല്ലാതെ അടുത്ത് കുനിഞ്ഞു, അവൾക്ക് മാറിയിരിക്കേണ്ടി വന്നു.',
    },
    bubble: '📖',
    explain: {
      en: 'Crowding her makes reading hard. Look from beside her.',
      ml: 'അത്ര അടുത്ത് നിന്നാൽ അവൾക്ക് വായിക്കാൻ പറ്റില്ല. അടുത്ത് മാറിനിന്ന് നോക്ക്.',
    },
    pose: { close: true, lean: 0.3 }, scene: {},
  },

  // --- politeness --------------------------------------------------------------
  {
    id: 'pleasepass',
    construct: 'politeness', pool: 'training', tier: 'clear', isFine: true,
    text: {
      en: "Ravi wants the glue and asks, 'Could you pass it, please?'",
      ml: "രവിക്ക് പശ വേണം, 'അത് ഒന്ന് എടുത്തുതരാമോ, പ്ലീസ്?' എന്ന് ചോദിച്ചു.",
    },
    bubble: '🙏',
    explain: {
      en: 'Asking with a please is polite and kind.',
      ml: 'പ്ലീസ് പറഞ്ഞ് ചോദിക്കുന്നത് മര്യാദയാ.',
    },
    pose: { armUp: true }, scene: { polite: true },
  },
  {
    id: 'snaporder',
    construct: 'politeness', pool: 'training', tier: 'clear', isFine: false,
    text: {
      en: "Meera snaps, 'Move! I want to sit there,' at a friend.",
      ml: "മീര കൂട്ടുകാരിയോട് 'മാറ്! എനിക്ക് അവിടെ ഇരിക്കണം' എന്ന് കയർത്തു.",
    },
    bubble: '📢',
    explain: {
      en: 'Snapping orders is rude. Ask nicely instead.',
      ml: 'അങ്ങനെ കയർത്ത് പറയുന്നത് മോശമാ. മര്യാദയോടെ ചോദിക്ക്.',
    },
    pose: { lean: 0.4 }, scene: {},
  },
  {
    id: 'maybelater',
    construct: 'politeness', pool: 'training', tier: 'subtle', isFine: true,
    text: {
      en: "Ravi is busy drawing, so he says, 'Not right now, thanks — maybe later.'",
      ml: "രവി വരയ്ക്കുന്ന തിരക്കിലായിരുന്നു, അതുകൊണ്ട് 'ഇപ്പോ വേണ്ട, താങ്ക്സ് — പിന്നെയാകാം' എന്ന് പറഞ്ഞു.",
    },
    bubble: '🙂',
    explain: {
      en: "Saying no politely is fine — you can't always play.",
      ml: 'മര്യാദയോടെ വേണ്ടെന്ന് പറയുന്നത് തെറ്റല്ല — എപ്പോഴും കളിക്കാൻ പറ്റില്ലല്ലോ.',
    },
    pose: {}, scene: { polite: true },
  },
  {
    id: 'spillgo',
    construct: 'politeness', pool: 'training', tier: 'subtle', isFine: false,
    text: {
      en: "Anu spills water on a friend's book by accident and just walks off.",
      ml: 'അനു അറിയാതെ കൂട്ടുകാരിയുടെ പുസ്തകത്തിൽ വെള്ളം തൂകി, ഒന്നും പറയാതെ നടന്നുപോയി.',
    },
    bubble: '💦',
    explain: {
      en: 'It was an accident, but leaving hurts. Say sorry and help.',
      ml: 'അറിയാതെ പറ്റിയതാ, പക്ഷേ മിണ്ടാതെ പോയാൽ വിഷമമാകും. സോറി പറഞ്ഞ് സഹായിക്ക്.',
    },
    pose: {}, scene: { turnAway: true },
  },
  {
    id: 'thankshare',
    construct: 'politeness', pool: 'probe', tier: 'clear', isFine: true,
    text: {
      en: "A friend shares her snack, and Manu says, 'Thank you so much!'",
      ml: "കൂട്ടുകാരി പലഹാരം പങ്കുവെച്ചപ്പോൾ മനു 'ഒരുപാട് നന്ദി!' എന്ന് പറഞ്ഞു.",
    },
    bubble: '💝',
    explain: {
      en: 'Saying thank you makes people feel good.',
      ml: 'നന്ദി പറഞ്ഞാൽ അവർക്ക് സന്തോഷമാകും.',
    },
    pose: { armUp: true }, scene: { polite: true, waveBack: true },
  },
  {
    id: 'shoutlose',
    construct: 'politeness', pool: 'probe', tier: 'clear', isFine: false,
    text: {
      en: "When his team loses, Ben yells, 'You're all stupid!' at the others.",
      ml: "ടീം തോറ്റപ്പോൾ ബെൻ മറ്റുള്ളവരോട് 'നിങ്ങളെല്ലാം മണ്ടന്മാരാ!' എന്ന് ഒച്ചവെച്ചു.",
    },
    bubble: '😠',
    explain: {
      en: 'Mean words hurt. Losing a game is okay.',
      ml: 'മോശം വാക്കുകൾ വേദനിപ്പിക്കും. കളിയിൽ തോൽക്കുന്നത് കുഴപ്പമില്ല.',
    },
    pose: { lean: 0.4 }, scene: {},
  },
  {
    id: 'waitfinish',
    construct: 'politeness', pool: 'probe', tier: 'subtle', isFine: true,
    text: {
      en: 'Sana wants to ask something while the teacher is busy, so she waits quietly until the teacher is free.',
      ml: 'ടീച്ചർ തിരക്കിലായിരുന്നു, അതുകൊണ്ട് സന ടീച്ചർ ഒഴിവാകുന്നതുവരെ മിണ്ടാതെ കാത്തുനിന്നു.',
    },
    bubble: '🙋',
    explain: {
      en: 'Waiting quietly for a free moment is polite.',
      ml: 'ഒഴിവാകുന്നതുവരെ മിണ്ടാതെ കാത്തുനിൽക്കുന്നത് മര്യാദയാ.',
    },
    pose: {}, scene: { polite: true },
  },
  {
    id: 'helpquiet',
    construct: 'politeness', pool: 'probe', tier: 'subtle', isFine: false,
    text: {
      en: 'A friend helps Ravi find his lost shoe. Ravi takes it and says nothing.',
      ml: 'കൂട്ടുകാരൻ രവിയുടെ കാണാതായ ഷൂ കണ്ടുപിടിച്ചു കൊടുത്തു. രവി അത് വാങ്ങി ഒന്നും പറഞ്ഞില്ല.',
    },
    bubble: '👟',
    explain: {
      en: 'He helped you. A thank you makes him feel good.',
      ml: 'അവൻ സഹായിച്ചല്ലോ. ഒരു നന്ദി പറഞ്ഞാൽ അവന് സന്തോഷമാകും.',
    },
    pose: {}, scene: { toy: 'hold' },
  },
]

/** Behaviours of one construct within one pool (a level draws from these). */
export function behaviorsFor(construct: Construct, pool: StimulusPool): Behavior[] {
  return BEHAVIORS.filter((b) => b.construct === construct && b.pool === pool)
}
