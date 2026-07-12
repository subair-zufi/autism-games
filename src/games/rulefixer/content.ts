/**
 * Item bank for Good Choice — the social-norms decision game.
 *
 * Research design (mirrors the emotion battery's content architecture):
 *  - Construct taxonomy: every situation is tagged with the social construct
 *    it measures (helping / comforting / inclusion / politeness / fairness),
 *    so per-construct accuracy always has a denominator.
 *  - Graded options: each situation offers exactly one option per role —
 *    `kind` (the prosocial response), `passive` (plausible-but-suboptimal
 *    omission: the clinically interesting error), and `wrong` (clearly
 *    antisocial). Which roles are shown depends on the level (see logic.ts),
 *    so difficulty is a property of the *discrimination required*, not of
 *    round count.
 *  - Training vs probe pools: probe situations are held out of practice and
 *    only appear in Assessment mode, so generalization can be measured on
 *    unseen items. Each construct has 4 training + 4 probe situations; a
 *    level samples 2 of the 4, so sessions stay 10 trials (no fatigue) while
 *    repeated sessions rotate through different items — accumulating enough
 *    per-construct evidence to read one child's strength on a single
 *    construct, not only group means.
 *  - Bilingual (Kerala deployment): every child-facing line carries English
 *    and Malayalam, written colloquially the way adults actually talk to a
 *    small child (same convention as Roll-Back Buddy).
 *
 * Scene cues reuse the existing RuleFixerScene prop vocabulary (mood, books,
 * tall, swing, fallen, watching) so no 3D changes are needed.
 */
import type { Lang } from '../../i18n/strings'

export type Construct = 'helping' | 'comforting' | 'inclusion' | 'politeness' | 'fairness'
export const CONSTRUCTS: Construct[] = ['helping', 'comforting', 'inclusion', 'politeness', 'fairness']

/** Which item pool a situation belongs to (probe = held-out assessment items). */
export type StimulusPool = 'training' | 'probe'

export type PeerMood = 'sad' | 'cry' | 'hurt' | 'neutral'

/** The graded role an option plays within its situation. */
export type Role = 'kind' | 'passive' | 'wrong'

/** A child-facing line in both display languages. */
export type BiText = Record<Lang, string>

export interface Option {
  id: string
  role: Role
  emoji: string
  label: BiText
  /** spoken consequence after the child picks this (practice mode only) */
  result: BiText
}

export interface Situation {
  id: string
  construct: Construct
  pool: StimulusPool
  /** what the narrator describes about the frozen moment */
  text: BiText
  /** emoji cue shown in the bubble */
  bubble: string
  scene: {
    mood: PeerMood
    books?: boolean
    tall?: boolean
    /** show a playground swing the peer is standing beside, waiting */
    swing?: boolean
    /** peer is lying fallen on the ground */
    fallen?: boolean
    /** peer stands off to the side watching a game (ball cue) */
    watching?: boolean
  }
  /** exactly one option per role */
  options: [Option, Option, Option]
}

export const SITUATIONS: Situation[] = [
  // --- helping ---------------------------------------------------------------
  {
    id: 'books',
    construct: 'helping',
    pool: 'training',
    text: {
      en: 'Aisha dropped all her books on the floor.',
      ml: 'ആയിഷയുടെ പുസ്തകങ്ങളെല്ലാം താഴെ വീണു.',
    },
    bubble: '📚',
    scene: { mood: 'sad', books: true },
    options: [
      {
        id: 'help', role: 'kind', emoji: '🤝',
        label: { en: 'Help pick them up', ml: 'പെറുക്കിയെടുക്കാൻ സഹായിക്കുക' },
        result: {
          en: 'You helped! Aisha feels happy and says thank you.',
          ml: 'നീ സഹായിച്ചു! ആയിഷയ്ക്ക് സന്തോഷമായി, നന്ദി പറയുന്നു.',
        },
      },
      {
        id: 'walk', role: 'passive', emoji: '🚶',
        label: { en: 'Walk on to your class', ml: 'ക്ലാസ്സിലേക്ക് നടന്നുപോകുക' },
        result: {
          en: 'Aisha picks them all up alone. Stopping to help would be kinder.',
          ml: 'ആയിഷ ഒറ്റയ്ക്ക് എല്ലാം പെറുക്കി. നിന്ന് സഹായിച്ചിരുന്നെങ്കിൽ കൂടുതൽ നന്നായേനെ.',
        },
      },
      {
        id: 'laugh', role: 'wrong', emoji: '😆',
        label: { en: 'Laugh at her', ml: 'അവളെ നോക്കി ചിരിക്കുക' },
        result: {
          en: "That hurts Aisha's feelings. Helping is the kind choice.",
          ml: 'അത് ആയിഷയ്ക്ക് വിഷമമായി. സഹായിക്കുന്നതാ നല്ലത്.',
        },
      },
    ],
  },
  {
    id: 'fell',
    construct: 'helping',
    pool: 'training',
    text: {
      en: 'A friend trips and falls in the playground.',
      ml: 'കളിസ്ഥലത്ത് ഒരു കൂട്ടുകാരൻ തട്ടി വീണു.',
    },
    bubble: '🤕',
    scene: { mood: 'hurt', fallen: true },
    options: [
      {
        id: 'helpup', role: 'kind', emoji: '🤝',
        label: { en: 'Help them up', ml: 'എഴുന്നേൽക്കാൻ സഹായിക്കുക' },
        result: {
          en: 'You helped them up. They feel safe and thankful.',
          ml: 'നീ എഴുന്നേൽപ്പിച്ചു. അവന് സമാധാനമായി, നന്ദിയുണ്ട്.',
        },
      },
      {
        id: 'keepplay', role: 'passive', emoji: '⚽',
        label: { en: 'Keep playing your game', ml: 'നിന്റെ കളി തുടരുക' },
        result: {
          en: 'They stay on the ground, hurting. Stopping to help is kinder.',
          ml: 'അവൻ വേദനയോടെ അവിടെത്തന്നെ കിടന്നു. നിന്ന് സഹായിക്കുന്നതാ നല്ലത്.',
        },
      },
      {
        id: 'laugh2', role: 'wrong', emoji: '😆',
        label: { en: 'Laugh at them', ml: 'അവനെ നോക്കി ചിരിക്കുക' },
        result: {
          en: 'That is unkind when someone is hurt. Help them instead.',
          ml: 'വേദനിക്കുമ്പോൾ ചിരിക്കുന്നത് മോശമാ. പകരം സഹായിക്ക്.',
        },
      },
    ],
  },
  {
    id: 'papers',
    construct: 'helping',
    pool: 'probe',
    text: {
      en: 'Your teacher drops her papers near the door.',
      ml: 'ടീച്ചറുടെ പേപ്പറുകൾ വാതിലിനടുത്ത് താഴെ വീണു.',
    },
    bubble: '📄',
    scene: { mood: 'neutral', tall: true, books: true },
    options: [
      {
        id: 'gather', role: 'kind', emoji: '🙋',
        label: { en: 'Help gather the papers', ml: 'പേപ്പറുകൾ എടുക്കാൻ സഹായിക്കുക' },
        result: {
          en: 'Teacher smiles and says thank you. That was helpful!',
          ml: 'ടീച്ചർ ചിരിച്ചു, നന്ദി പറഞ്ഞു. നല്ല സഹായമായി!',
        },
      },
      {
        id: 'sit', role: 'passive', emoji: '🪑',
        label: { en: 'Stay quietly in your seat', ml: 'സീറ്റിൽ മിണ്ടാതെ ഇരിക്കുക' },
        result: {
          en: 'Teacher gathers them all alone. Offering help would be kind.',
          ml: 'ടീച്ചർ ഒറ്റയ്ക്ക് എല്ലാം എടുത്തു. സഹായം ചോദിച്ചിരുന്നെങ്കിൽ നന്നായേനെ.',
        },
      },
      {
        id: 'giggle', role: 'wrong', emoji: '👉',
        label: { en: 'Point and giggle', ml: 'ചൂണ്ടിക്കാണിച്ച് കളിയാക്കുക' },
        result: {
          en: 'That is unkind. Helping is the better choice.',
          ml: 'അത് മോശമാ. സഹായിക്കുന്നതാ നല്ലത്.',
        },
      },
    ],
  },
  {
    id: 'heavybag',
    construct: 'helping',
    pool: 'probe',
    text: {
      en: 'Meera is struggling with a very heavy bag.',
      ml: 'മീരയ്ക്ക് ഭാരമുള്ള ബാഗ് ചുമക്കാൻ പറ്റുന്നില്ല.',
    },
    bubble: '🎒',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'offer', role: 'kind', emoji: '💬',
        label: { en: "Ask, 'Can I help you?'", ml: "'ഞാൻ സഹായിക്കട്ടെ?' എന്ന് ചോദിക്കുക" },
        result: {
          en: 'You carried it together. Meera is very thankful.',
          ml: 'രണ്ടുപേരും കൂടി ചുമന്നു. മീരയ്ക്ക് ഒരുപാട് സന്തോഷമായി.',
        },
      },
      {
        id: 'silent', role: 'passive', emoji: '🚶',
        label: { en: 'Walk along saying nothing', ml: 'ഒന്നും പറയാതെ കൂടെ നടക്കുക' },
        result: {
          en: 'Meera keeps struggling alone. Asking to help would be kind.',
          ml: 'മീര ഒറ്റയ്ക്ക് കഷ്ടപ്പെട്ടു. സഹായം ചോദിക്കുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'pushpast', role: 'wrong', emoji: '💨',
        label: { en: 'Push past her', ml: 'അവളെ തള്ളിമാറ്റി പോകുക' },
        result: {
          en: 'That could hurt her. Helping is the kind choice.',
          ml: 'അത് അവളെ വീഴ്ത്തിയേനെ. സഹായിക്കുന്നതാ നല്ലത്.',
        },
      },
    ],
  },

  // --- comforting -------------------------------------------------------------
  {
    id: 'crying',
    construct: 'comforting',
    pool: 'training',
    text: {
      en: 'A new boy is crying all by himself at break.',
      ml: 'ഇടവേളയ്ക്ക് ഒരു പുതിയ കുട്ടി ഒറ്റയ്ക്കിരുന്ന് കരയുന്നു.',
    },
    bubble: '😢',
    scene: { mood: 'cry' },
    options: [
      {
        id: 'ask', role: 'kind', emoji: '💬',
        label: { en: 'Ask if he is okay', ml: "'എന്തുപറ്റി?' എന്ന് ചോദിക്കുക" },
        result: {
          en: 'He feels cared for and stops crying. Well done.',
          ml: 'ആരോ കൂടെയുണ്ടെന്ന് തോന്നി, അവൻ കരച്ചിൽ നിർത്തി. നന്നായി.',
        },
      },
      {
        id: 'leave', role: 'passive', emoji: '🧍',
        label: { en: 'Leave him alone until he stops', ml: 'കരച്ചിൽ നിർത്തുംവരെ വെറുതെ വിടുക' },
        result: {
          en: 'He stays sad and alone. A kind word would help him.',
          ml: 'അവൻ സങ്കടത്തോടെ ഒറ്റയ്ക്കിരുന്നു. ഒരു നല്ല വാക്ക് അവനെ സഹായിച്ചേനെ.',
        },
      },
      {
        id: 'stare', role: 'wrong', emoji: '👀',
        label: { en: 'Point and stare', ml: 'ചൂണ്ടിക്കാണിച്ച് നോക്കിനിൽക്കുക' },
        result: {
          en: 'That makes him feel worse. A kind word helps more.',
          ml: 'അത് അവനെ കൂടുതൽ വിഷമിപ്പിച്ചു. നല്ല വാക്കാ സഹായിക്കുക.',
        },
      },
    ],
  },
  {
    id: 'losttoy',
    construct: 'comforting',
    pool: 'training',
    text: {
      en: 'Ravi looks very sad — his toy car is lost.',
      ml: 'രവിയുടെ കളിപ്പാട്ട കാർ കാണാനില്ല — അവന് നല്ല സങ്കടം.',
    },
    bubble: '🧸',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'look', role: 'kind', emoji: '🔍',
        label: { en: "Say, 'I'll help you look'", ml: "'ഞാനും നോക്കാം' എന്ന് പറയുക" },
        result: {
          en: 'You searched together and found it! Ravi is so happy.',
          ml: 'രണ്ടുപേരും കൂടി തിരഞ്ഞ് കണ്ടുപിടിച്ചു! രവിക്ക് വലിയ സന്തോഷം.',
        },
      },
      {
        id: 'onlytoy', role: 'passive', emoji: '🤷',
        label: { en: "Say, 'It's only a toy'", ml: "'അതൊരു കളിപ്പാട്ടമല്ലേ' എന്ന് പറയുക" },
        result: {
          en: "Ravi feels his sadness doesn't matter. Helping him look is kinder.",
          ml: 'അവന്റെ സങ്കടം ആർക്കും വേണ്ടെന്ന് രവിക്ക് തോന്നി. കൂടെ തിരയുന്നതാ നല്ലത്.',
        },
      },
      {
        id: 'mock', role: 'wrong', emoji: '😆',
        label: { en: "Say, 'Ha ha, you lost it!'", ml: "'ഹ ഹ, കളഞ്ഞുപോയല്ലോ!' എന്ന് പറയുക" },
        result: {
          en: 'That hurts Ravi. Helping or a kind word is better.',
          ml: 'അത് രവിയെ വേദനിപ്പിച്ചു. സഹായമോ നല്ല വാക്കോ ആണ് വേണ്ടത്.',
        },
      },
    ],
  },
  {
    id: 'kneehurt',
    construct: 'comforting',
    pool: 'probe',
    text: {
      en: 'Sana fell off the swing and her knee hurts.',
      ml: 'സന ഊഞ്ഞാലിൽ നിന്ന് വീണു, കാൽമുട്ടിന് വേദന.',
    },
    bubble: '🩹',
    scene: { mood: 'hurt', swing: true },
    options: [
      {
        id: 'stay', role: 'kind', emoji: '🧑‍🏫',
        label: { en: 'Stay with her and call the teacher', ml: 'കൂടെ നിന്ന് ടീച്ചറെ വിളിക്കുക' },
        result: {
          en: 'Sana feels safe with you there. The teacher helps her.',
          ml: 'നീ കൂടെയുള്ളത് സനയ്ക്ക് ധൈര്യമായി. ടീച്ചർ വന്ന് സഹായിച്ചു.',
        },
      },
      {
        id: 'goback', role: 'passive', emoji: '🏃',
        label: { en: 'Go back to your game', ml: 'നിന്റെ കളിക്ക് തിരിച്ചുപോകുക' },
        result: {
          en: 'Sana is hurt and alone. Staying with her would be kind.',
          ml: 'സന വേദനയോടെ ഒറ്റയ്ക്കായി. കൂടെ നിൽക്കുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'copyfall', role: 'wrong', emoji: '😆',
        label: { en: 'Copy her fall and laugh', ml: 'വീണത് അനുകരിച്ച് ചിരിക്കുക' },
        result: {
          en: 'That is very unkind when she is hurt.',
          ml: 'വേദനിക്കുമ്പോൾ അങ്ങനെ ചെയ്യുന്നത് വളരെ മോശമാ.',
        },
      },
    ],
  },
  {
    id: 'missmom',
    construct: 'comforting',
    pool: 'probe',
    text: {
      en: 'Anu is tearful — she misses her mother.',
      ml: 'അനുവിന്റെ കണ്ണ് നിറഞ്ഞിരിക്കുന്നു — അമ്മയെ കാണാൻ തോന്നുന്നു.',
    },
    bubble: '💧',
    scene: { mood: 'cry' },
    options: [
      {
        id: 'invite2', role: 'kind', emoji: '👋',
        label: { en: "Say, 'Come, let's play together'", ml: "'വാ, നമുക്ക് ഒരുമിച്ച് കളിക്കാം' എന്ന് പറയുക" },
        result: {
          en: 'Playing together helps Anu feel better.',
          ml: 'ഒരുമിച്ച് കളിച്ചപ്പോൾ അനുവിന്റെ സങ്കടം കുറഞ്ഞു.',
        },
      },
      {
        id: 'nearby', role: 'passive', emoji: '🧍',
        label: { en: 'Stand nearby, saying nothing', ml: 'ഒന്നും പറയാതെ അടുത്ത് നിൽക്കുക' },
        result: {
          en: 'Anu still feels alone. A kind word would comfort her.',
          ml: 'അനുവിന് അപ്പോഴും ഒറ്റപ്പെടൽ. ഒരു നല്ല വാക്ക് ആശ്വാസമായേനെ.',
        },
      },
      {
        id: 'baby', role: 'wrong', emoji: '🗣️',
        label: { en: "Say, 'Stop crying like a baby'", ml: "'വാവയെപ്പോലെ കരയല്ലേ' എന്ന് പറയുക" },
        result: {
          en: 'That makes her feel worse. Kind words help.',
          ml: 'അത് അവളെ കൂടുതൽ വിഷമിപ്പിച്ചു. നല്ല വാക്കുകളാ സഹായിക്കുക.',
        },
      },
    ],
  },

  // --- inclusion ---------------------------------------------------------------
  {
    id: 'lonely',
    construct: 'inclusion',
    pool: 'training',
    text: {
      en: 'A child stands alone, watching your game.',
      ml: 'ഒരു കുട്ടി ഒറ്റയ്ക്ക് നിന്ന് നിങ്ങളുടെ കളി നോക്കുന്നു.',
    },
    bubble: '🧍',
    scene: { mood: 'sad', watching: true },
    options: [
      {
        id: 'invite', role: 'kind', emoji: '👋',
        label: { en: 'Invite them to play', ml: 'കളിക്കാൻ വിളിക്കുക' },
        result: {
          en: 'They join in and have fun. That was very kind.',
          ml: 'അവനും കൂടി, എല്ലാവരും രസായി കളിച്ചു. അത് വലിയ നല്ല കാര്യമായി.',
        },
      },
      {
        id: 'keepon', role: 'passive', emoji: '⚽',
        label: { en: 'Keep playing with your friends', ml: 'കൂട്ടുകാരോടൊപ്പം കളി തുടരുക' },
        result: {
          en: 'They keep watching from outside. Inviting them is kinder.',
          ml: 'അവൻ പുറത്തുനിന്ന് നോക്കിനിന്നതേയുള്ളൂ. വിളിക്കുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'shoo', role: 'wrong', emoji: '🙅',
        label: { en: 'Tell them to go away', ml: "'പോ അവിടുന്ന്' എന്ന് പറയുക" },
        result: {
          en: 'That hurts their feelings. Including them is better.',
          ml: 'അത് അവനെ വേദനിപ്പിച്ചു. കൂടെ കൂട്ടുന്നതാ നല്ലത്.',
        },
      },
    ],
  },
  {
    id: 'newgirl',
    construct: 'inclusion',
    pool: 'training',
    text: {
      en: 'A new girl sits alone at lunch time.',
      ml: 'ഊണിന്റെ സമയത്ത് പുതിയ കുട്ടി ഒറ്റയ്ക്കിരിക്കുന്നു.',
    },
    bubble: '🍱',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'sitwith', role: 'kind', emoji: '🪑',
        label: { en: 'Sit with her and say hello', ml: "അടുത്തിരുന്ന് 'ഹലോ' പറയുക" },
        result: {
          en: 'She smiles — now she has a friend.',
          ml: 'അവൾ ചിരിച്ചു — ഇപ്പോ അവൾക്കൊരു കൂട്ടുകാരിയായി.',
        },
      },
      {
        id: 'usual', role: 'passive', emoji: '👥',
        label: { en: 'Sit with your usual friends', ml: 'പതിവ് കൂട്ടുകാരുടെ അടുത്ത് ഇരിക്കുക' },
        result: {
          en: 'She eats alone again. Joining her would be kind.',
          ml: 'അവൾ വീണ്ടും ഒറ്റയ്ക്ക് കഴിച്ചു. കൂടെ ഇരിക്കുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'whisper', role: 'wrong', emoji: '🤫',
        label: { en: 'Whisper about her with friends', ml: 'കൂട്ടുകാരോട് അവളെപ്പറ്റി അടക്കം പറയുക' },
        result: {
          en: 'Whispering makes her feel unwelcome. Say hello instead.',
          ml: 'അത് അവളെ വിഷമിപ്പിക്കും. പകരം ചെന്ന് ഹലോ പറയ്.',
        },
      },
    ],
  },
  {
    id: 'team',
    construct: 'inclusion',
    pool: 'probe',
    text: {
      en: 'Everyone is picked for the game except Manu.',
      ml: 'കളിക്ക് എല്ലാവരെയും എടുത്തു, മനുവിനെ മാത്രം എടുത്തില്ല.',
    },
    bubble: '⚽',
    scene: { mood: 'sad', watching: true },
    options: [
      {
        id: 'myteam', role: 'kind', emoji: '🙋',
        label: { en: "Say, 'Manu is on my team!'", ml: "'മനു എന്റെ ടീമിലാ!' എന്ന് പറയുക" },
        result: {
          en: 'Manu beams and plays with you all.',
          ml: 'മനുവിന് വലിയ സന്തോഷം, എല്ലാവരും ഒരുമിച്ച് കളിച്ചു.',
        },
      },
      {
        id: 'startfast', role: 'passive', emoji: '🏃',
        label: { en: 'Start the game quickly', ml: 'വേഗം കളി തുടങ്ങുക' },
        result: {
          en: 'Manu is left standing out. Picking him would be kind.',
          ml: 'മനു പുറത്തുതന്നെ നിന്നു. അവനെ കൂട്ടുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'nowant', role: 'wrong', emoji: '🙅',
        label: { en: "Say, 'We don't want him'", ml: "'അവനെ ഞങ്ങൾക്ക് വേണ്ട' എന്ന് പറയുക" },
        result: {
          en: 'That hurts Manu a lot. Everyone can play together.',
          ml: 'അത് മനുവിനെ വല്ലാതെ വേദനിപ്പിച്ചു. എല്ലാവർക്കും ഒരുമിച്ച് കളിക്കാലോ.',
        },
      },
    ],
  },
  {
    id: 'drawing',
    construct: 'inclusion',
    pool: 'probe',
    text: {
      en: 'Fathima watches you and your friend drawing.',
      ml: 'നീയും കൂട്ടുകാരിയും വരയ്ക്കുന്നത് ഫാത്തിമ നോക്കിനിൽക്കുന്നു.',
    },
    bubble: '🖍️',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'givecrayon', role: 'kind', emoji: '🖍️',
        label: { en: 'Give her crayons to join', ml: 'വരയ്ക്കാൻ ക്രയോൺസ് കൊടുക്കുക' },
        result: {
          en: 'Fathima joins and you all draw together.',
          ml: 'ഫാത്തിമയും കൂടി, എല്ലാവരും ഒരുമിച്ച് വരച്ചു.',
        },
      },
      {
        id: 'keepdraw', role: 'passive', emoji: '🎨',
        label: { en: 'Keep drawing with your friend', ml: 'കൂട്ടുകാരിയോടൊപ്പം വര തുടരുക' },
        result: {
          en: 'Fathima keeps watching, left out. Inviting her is kinder.',
          ml: 'ഫാത്തിമ വെറുതെ നോക്കിനിന്നു. അവളെയും കൂട്ടുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'hide', role: 'wrong', emoji: '🙈',
        label: { en: 'Hide the crayons from her', ml: 'ക്രയോൺസ് അവളിൽ നിന്ന് ഒളിപ്പിക്കുക' },
        result: {
          en: 'That feels mean. Sharing lets everyone have fun.',
          ml: 'അത് മോശമായി. പങ്കുവെച്ചാൽ എല്ലാവർക്കും സന്തോഷമാ.',
        },
      },
    ],
  },

  // --- politeness ----------------------------------------------------------------
  {
    id: 'teacher',
    construct: 'politeness',
    pool: 'training',
    text: {
      en: 'Your teacher walks in to start the class.',
      ml: 'ക്ലാസ് തുടങ്ങാൻ ടീച്ചർ അകത്തേക്ക് വരുന്നു.',
    },
    bubble: '🧑‍🏫',
    scene: { mood: 'neutral', tall: true },
    options: [
      {
        id: 'greet', role: 'kind', emoji: '👋',
        label: { en: 'Say good morning', ml: "'ഗുഡ് മോർണിംഗ്' പറയുക" },
        result: {
          en: 'A friendly greeting! Your teacher smiles back.',
          ml: 'നല്ല അഭിവാദനം! ടീച്ചർ തിരിച്ച് ചിരിച്ചു.',
        },
      },
      {
        id: 'book', role: 'passive', emoji: '📖',
        label: { en: 'Keep looking at your book', ml: 'പുസ്തകത്തിൽ തന്നെ നോക്കിയിരിക്കുക' },
        result: {
          en: 'Quiet is okay, but a greeting shows respect and is friendlier.',
          ml: 'മിണ്ടാതിരിക്കുന്നത് തെറ്റല്ല, പക്ഷേ വിഷ് ചെയ്യുന്നതാ കൂടുതൽ സ്നേഹം.',
        },
      },
      {
        id: 'shout', role: 'wrong', emoji: '📢',
        label: { en: 'Keep talking loudly', ml: 'ഉറക്കെ സംസാരം തുടരുക' },
        result: {
          en: 'It is hard to start class. Greeting calmly is better.',
          ml: 'അപ്പോ ക്ലാസ് തുടങ്ങാൻ പറ്റില്ല. ശാന്തമായി വിഷ് ചെയ്യുന്നതാ നല്ലത്.',
        },
      },
    ],
  },
  {
    id: 'wantball',
    construct: 'politeness',
    pool: 'training',
    text: {
      en: 'Ravi is playing with the ball you want.',
      ml: 'നിനക്ക് വേണ്ട പന്ത് രവിയാ കളിക്കുന്നത്.',
    },
    bubble: '🏀',
    scene: { mood: 'neutral', watching: true },
    options: [
      {
        id: 'askplay', role: 'kind', emoji: '💬',
        label: { en: "Ask, 'Can I play too, please?'", ml: "'എനിക്കും കളിക്കാമോ, പ്ലീസ്?' എന്ന് ചോദിക്കുക" },
        result: {
          en: 'Ravi says yes! Asking politely works.',
          ml: 'രവി സമ്മതിച്ചു! പ്ലീസ് പറഞ്ഞ് ചോദിച്ചാൽ കിട്ടും.',
        },
      },
      {
        id: 'hope', role: 'passive', emoji: '🧍',
        label: { en: 'Wait silently, hoping he gives it', ml: 'തരുമെന്ന് കരുതി മിണ്ടാതെ കാത്തുനിൽക്കുക' },
        result: {
          en: "Ravi doesn't know you want it. Asking with words works better.",
          ml: 'നിനക്ക് വേണമെന്ന് രവിക്ക് അറിയില്ലല്ലോ. വാക്കുകൊണ്ട് ചോദിക്കുന്നതാ നല്ലത്.',
        },
      },
      {
        id: 'grab', role: 'wrong', emoji: '✊',
        label: { en: 'Grab it from his hands', ml: 'അവന്റെ കയ്യിൽ നിന്ന് പിടിച്ചുവാങ്ങുക' },
        result: {
          en: 'Grabbing starts a fight. Ask politely instead.',
          ml: 'പിടിച്ചുവാങ്ങിയാൽ വഴക്കാകും. പകരം പ്ലീസ് പറഞ്ഞ് ചോദിക്ക്.',
        },
      },
    ],
  },
  {
    id: 'visitor',
    construct: 'politeness',
    pool: 'probe',
    text: {
      en: 'Grandma has come to visit your home.',
      ml: 'അമ്മൂമ്മ വീട്ടിൽ വിരുന്നു വന്നിരിക്കുന്നു.',
    },
    bubble: '👵',
    scene: { mood: 'neutral', tall: true },
    options: [
      {
        id: 'welcome', role: 'kind', emoji: '👋',
        label: { en: "Say, 'Hello, come in!'", ml: "'ഹലോ അമ്മൂമ്മേ, വരൂ!' എന്ന് പറയുക" },
        result: {
          en: 'Grandma is delighted with your warm welcome.',
          ml: 'നിന്റെ സ്വീകരണം കണ്ട് അമ്മൂമ്മയ്ക്ക് വലിയ സന്തോഷം.',
        },
      },
      {
        id: 'tv', role: 'passive', emoji: '📺',
        label: { en: 'Keep watching your show', ml: 'ടിവി കണ്ടുകൊണ്ടിരിക്കുക' },
        result: {
          en: 'Grandma feels unnoticed. A hello makes visitors feel welcome.',
          ml: 'അമ്മൂമ്മയെ ആരും ശ്രദ്ധിച്ചില്ല. ഒരു ഹലോ പറഞ്ഞാൽ അവർക്ക് സന്തോഷമാകും.',
        },
      },
      {
        id: 'goaway', role: 'wrong', emoji: '📢',
        label: { en: "Shout, 'Go away!'", ml: "'പോ ഇവിടുന്ന്!' എന്ന് ഒച്ചവെക്കുക" },
        result: {
          en: 'That is very hurtful. Visitors deserve a kind welcome.',
          ml: 'അത് വലിയ വിഷമമാകും. വിരുന്നുകാരെ സ്നേഹത്തോടെ സ്വീകരിക്കണം.',
        },
      },
    ],
  },
  {
    id: 'excuse',
    construct: 'politeness',
    pool: 'probe',
    text: {
      en: 'Your teacher is talking to another teacher — you need help.',
      ml: 'ടീച്ചർ വേറൊരു ടീച്ചറോട് സംസാരിക്കുകയാ — നിനക്ക് സഹായം വേണം.',
    },
    bubble: '🗣️',
    scene: { mood: 'neutral', tall: true },
    options: [
      {
        id: 'excuseme', role: 'kind', emoji: '🙋',
        label: { en: "Say 'Excuse me' and wait", ml: "'എക്സ്ക്യൂസ് മീ' പറഞ്ഞ് കാത്തുനിൽക്കുക" },
        result: {
          en: 'Teacher turns to help you. Polite waiting works!',
          ml: 'ടീച്ചർ തിരിഞ്ഞ് നിന്നെ സഹായിച്ചു. മര്യാദയോടെ കാത്തുനിന്നാൽ നടക്കും!',
        },
      },
      {
        id: 'walkoff', role: 'passive', emoji: '🚶',
        label: { en: 'Walk away without asking', ml: 'ചോദിക്കാതെ തിരിച്ചുപോകുക' },
        result: {
          en: "You never got the help you needed. 'Excuse me' would work.",
          ml: "നിനക്ക് വേണ്ട സഹായം കിട്ടിയില്ലല്ലോ. 'എക്സ്ക്യൂസ് മീ' പറഞ്ഞാൽ മതിയായിരുന്നു.",
        },
      },
      {
        id: 'interrupt', role: 'wrong', emoji: '📢',
        label: { en: 'Shout over their talk', ml: 'അവരുടെ സംസാരത്തിന് മീതെ ഒച്ചവെക്കുക' },
        result: {
          en: 'Interrupting loudly is rude. Say excuse me and wait.',
          ml: 'അങ്ങനെ ഇടയ്ക്ക് കയറി ഒച്ചവെക്കുന്നത് മോശമാ. എക്സ്ക്യൂസ് മീ പറഞ്ഞ് കാത്തുനിൽക്ക്.',
        },
      },
    ],
  },

  // --- fairness -----------------------------------------------------------------
  {
    id: 'swing',
    construct: 'fairness',
    pool: 'training',
    text: {
      en: 'Your friend has waited a long time for the swing.',
      ml: 'നിന്റെ കൂട്ടുകാരി ഊഞ്ഞാലിന് ഒരുപാട് നേരമായി കാത്തുനിൽക്കുന്നു.',
    },
    bubble: '⏳',
    scene: { mood: 'sad', swing: true },
    options: [
      {
        id: 'turnit', role: 'kind', emoji: '🔁',
        label: { en: 'Give them a turn', ml: 'അവൾക്ക് ഒരു ഊഴം കൊടുക്കുക' },
        result: {
          en: 'You took turns! Your friend is happy and grateful.',
          ml: 'ഊഴം വെച്ച് കളിച്ചു! കൂട്ടുകാരിക്ക് സന്തോഷമായി.',
        },
      },
      {
        id: 'fivemore', role: 'passive', emoji: '⏳',
        label: { en: "Say 'five more minutes' and keep swinging", ml: "'അഞ്ച് മിനിറ്റ് കൂടി' എന്ന് പറഞ്ഞ് ആടിക്കൊണ്ടിരിക്കുക" },
        result: {
          en: 'Your friend keeps waiting and waiting. Taking turns is fair.',
          ml: 'കൂട്ടുകാരി പിന്നെയും കാത്തുനിന്നു. ഊഴം വെക്കുന്നതാ ന്യായം.',
        },
      },
      {
        id: 'push', role: 'wrong', emoji: '✊',
        label: { en: 'Push them away', ml: 'അവളെ തള്ളിമാറ്റുക' },
        result: {
          en: 'That is not safe or kind. Take turns instead.',
          ml: 'അത് അപകടവും മോശവുമാ. പകരം ഊഴം വെച്ച് കളിക്ക്.',
        },
      },
    ],
  },
  {
    id: 'crayons',
    construct: 'fairness',
    pool: 'training',
    text: {
      en: "You have many crayons — Anu's box is empty.",
      ml: 'നിന്റെ കയ്യിൽ ഒരുപാട് ക്രയോൺസ് ഉണ്ട് — അനുവിന്റെ പെട്ടി കാലിയാ.',
    },
    bubble: '🎨',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'sharesome', role: 'kind', emoji: '🤝',
        label: { en: 'Share some of yours', ml: 'കുറച്ച് അനുവിന് കൊടുക്കുക' },
        result: {
          en: 'You shared! Now you both can colour.',
          ml: 'നീ പങ്കുവെച്ചു! ഇനി രണ്ടുപേർക്കും വരയ്ക്കാം.',
        },
      },
      {
        id: 'askteacher', role: 'passive', emoji: '💬',
        label: { en: "Say, 'Ask the teacher for more'", ml: "'ടീച്ചറോട് ചോദിക്ക്' എന്ന് പറയുക" },
        result: {
          en: 'Anu waits with nothing to draw with. Sharing right away is kinder.',
          ml: 'അനു ഒന്നുമില്ലാതെ കാത്തിരുന്നു. ഉടനെ പങ്കുവെക്കുന്നതാ നല്ലത്.',
        },
      },
      {
        id: 'mine', role: 'wrong', emoji: '🙅',
        label: { en: 'Hold them tight and turn away', ml: 'മുറുകെ പിടിച്ച് തിരിഞ്ഞിരിക്കുക' },
        result: {
          en: 'Keeping everything to yourself leaves Anu with none. Sharing is fair.',
          ml: 'എല്ലാം സ്വന്തമാക്കിയാൽ അനുവിന് ഒന്നും ഇല്ലാതാകും. പങ്കുവെക്കുന്നതാ ന്യായം.',
        },
      },
    ],
  },
  {
    id: 'queue',
    construct: 'fairness',
    pool: 'probe',
    text: {
      en: 'Children are waiting in a line at the water tap.',
      ml: 'വെള്ളം കുടിക്കാൻ കുട്ടികൾ വരിയിൽ നിൽക്കുകയാ.',
    },
    bubble: '🚰',
    scene: { mood: 'neutral' },
    options: [
      {
        id: 'back', role: 'kind', emoji: '🧍',
        label: { en: 'Stand at the back of the line', ml: 'വരിയുടെ പിന്നിൽ പോയി നിൽക്കുക' },
        result: {
          en: 'You waited your turn. Everyone gets water fairly.',
          ml: 'നീ ഊഴം കാത്തുനിന്നു. എല്ലാവർക്കും ന്യായമായി വെള്ളം കിട്ടി.',
        },
      },
      {
        id: 'slipin', role: 'passive', emoji: '👥',
        label: { en: 'Slip in next to your friend', ml: 'കൂട്ടുകാരന്റെ അടുത്ത് വരിയിൽ കയറുക' },
        result: {
          en: 'The children behind must wait longer. Joining at the back is fair.',
          ml: 'പിന്നിലുള്ള കുട്ടികൾക്ക് പിന്നെയും കാത്തുനിൽക്കേണ്ടി വന്നു. പിന്നിൽ കയറുന്നതാ ന്യായം.',
        },
      },
      {
        id: 'front', role: 'wrong', emoji: '💨',
        label: { en: 'Push to the front', ml: 'തള്ളിക്കയറി മുന്നിൽ പോകുക' },
        result: {
          en: 'Pushing is unfair and unsafe. Wait your turn.',
          ml: 'തള്ളിക്കയറുന്നത് ന്യായമല്ല, അപകടവുമാ. ഊഴം കാത്തുനിൽക്ക്.',
        },
      },
    ],
  },
  {
    id: 'choosegame',
    construct: 'fairness',
    pool: 'probe',
    text: {
      en: 'You chose the last game. Meera wants to choose this time.',
      ml: 'കഴിഞ്ഞ കളി നീ തിരഞ്ഞെടുത്തതാ. ഇത്തവണ മീരയ്ക്ക് തിരഞ്ഞെടുക്കണം.',
    },
    bubble: '🎲',
    scene: { mood: 'neutral' },
    options: [
      {
        id: 'letchoose', role: 'kind', emoji: '🔁',
        label: { en: 'Let Meera choose this time', ml: 'ഇത്തവണ മീര തിരഞ്ഞെടുക്കട്ടെ' },
        result: {
          en: 'Meera is happy — taking turns keeps games fun for everyone.',
          ml: 'മീരയ്ക്ക് സന്തോഷമായി — മാറിമാറി തിരഞ്ഞെടുത്താൽ എല്ലാവർക്കും രസമാ.',
        },
      },
      {
        id: 'onemore', role: 'passive', emoji: '☝️',
        label: { en: "Say, 'One more of mine first'", ml: "'എന്റേത് ഒന്നൂടെ കഴിഞ്ഞിട്ട്' എന്ന് പറയുക" },
        result: {
          en: 'Meera keeps waiting for her turn. Letting her choose is fair.',
          ml: 'മീര പിന്നെയും ഊഴം കാത്തിരുന്നു. അവളെ തിരഞ്ഞെടുക്കാൻ വിടുന്നതാ ന്യായം.',
        },
      },
      {
        id: 'always', role: 'wrong', emoji: '🙅',
        label: { en: "Say, 'We always play my game'", ml: "'എപ്പോഴും എന്റെ കളിയാ കളിക്കുക' എന്ന് പറയുക" },
        result: {
          en: 'That is not fair to Meera. Friends take turns choosing.',
          ml: 'അത് മീരയോട് ന്യായമല്ല. കൂട്ടുകാർ മാറിമാറി തിരഞ്ഞെടുക്കണം.',
        },
      },
    ],
  },

  // === second situation pair per construct (per-construct reliability) ==========
  // --- helping ---------------------------------------------------------------
  {
    id: 'spilledbag',
    construct: 'helping',
    pool: 'training',
    text: {
      en: "Ravi's bag tips over and his things spill in the corridor.",
      ml: 'രവിയുടെ ബാഗ് മറിഞ്ഞ് സാധനങ്ങളെല്ലാം ഇടനാഴിയിൽ ചിതറി.',
    },
    bubble: '🎒',
    scene: { mood: 'sad', books: true },
    options: [
      {
        id: 'pickup', role: 'kind', emoji: '🤝',
        label: { en: 'Help gather his things', ml: 'സാധനങ്ങൾ പെറുക്കാൻ സഹായിക്കുക' },
        result: {
          en: 'You helped and Ravi says thank you.',
          ml: 'നീ സഹായിച്ചു, രവി നന്ദി പറഞ്ഞു.',
        },
      },
      {
        id: 'stepover', role: 'passive', emoji: '🚶',
        label: { en: 'Step over them and go', ml: 'ചവിട്ടിക്കടന്ന് പോകുക' },
        result: {
          en: 'Ravi gathers it all alone. Stopping to help is kinder.',
          ml: 'രവി ഒറ്റയ്ക്ക് എല്ലാം പെറുക്കി. നിന്ന് സഹായിക്കുന്നതാ നല്ലത്.',
        },
      },
      {
        id: 'kick', role: 'wrong', emoji: '🦶',
        label: { en: 'Kick his things away', ml: 'സാധനങ്ങൾ തട്ടിത്തെറിപ്പിക്കുക' },
        result: {
          en: 'That is unkind and makes it worse. Help him instead.',
          ml: 'അത് മോശമാ, കൂടുതൽ കുഴപ്പമാകും. പകരം സഹായിക്ക്.',
        },
      },
    ],
  },
  {
    id: 'cantopen',
    construct: 'helping',
    pool: 'training',
    text: {
      en: 'A small boy cannot open his water bottle.',
      ml: 'ഒരു ചെറിയ കുട്ടിക്ക് വെള്ളക്കുപ്പി തുറക്കാൻ പറ്റുന്നില്ല.',
    },
    bubble: '🍶',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'openit', role: 'kind', emoji: '🤝',
        label: { en: 'Open it for him', ml: 'അവന് തുറന്നുകൊടുക്കുക' },
        result: {
          en: 'You opened it. He drinks happily and thanks you.',
          ml: 'നീ തുറന്നുകൊടുത്തു. അവൻ സന്തോഷത്തോടെ കുടിച്ചു, നന്ദി പറഞ്ഞു.',
        },
      },
      {
        id: 'ignoreit', role: 'passive', emoji: '🚶',
        label: { en: 'Leave him to try alone', ml: 'ഒറ്റയ്ക്ക് ശ്രമിക്കാൻ വിടുക' },
        result: {
          en: 'He struggles for a long time. Helping would be kind.',
          ml: 'അവൻ കുറേ നേരം കഷ്ടപ്പെട്ടു. സഹായിച്ചിരുന്നെങ്കിൽ നന്നായേനെ.',
        },
      },
      {
        id: 'shake', role: 'wrong', emoji: '😆',
        label: { en: 'Shake it so it sprays him', ml: 'കുലുക്കി അവന്റെ മേൽ തെറിപ്പിക്കുക' },
        result: {
          en: 'That is mean. Helping him open it is better.',
          ml: 'അത് മോശമാ. തുറക്കാൻ സഹായിക്കുന്നതാ നല്ലത്.',
        },
      },
    ],
  },
  {
    id: 'droppedcoins',
    construct: 'helping',
    pool: 'probe',
    text: {
      en: 'A shopkeeper drops coins that roll near your feet.',
      ml: 'കടക്കാരന്റെ കയ്യിൽ നിന്ന് നാണയങ്ങൾ വീണ് നിന്റെ കാലിനടുത്തേക്ക് ഉരുണ്ടു.',
    },
    bubble: '🪙',
    scene: { mood: 'neutral', tall: true },
    options: [
      {
        id: 'coinsback', role: 'kind', emoji: '🙋',
        label: { en: 'Pick them up and give them back', ml: 'പെറുക്കി തിരിച്ചുകൊടുക്കുക' },
        result: {
          en: 'The shopkeeper smiles and thanks you.',
          ml: 'കടക്കാരൻ ചിരിച്ച് നന്ദി പറഞ്ഞു.',
        },
      },
      {
        id: 'coinaway', role: 'passive', emoji: '🚶',
        label: { en: 'Walk on without stopping', ml: 'നിൽക്കാതെ നടന്നുപോകുക' },
        result: {
          en: 'He picks them up slowly alone. Helping would be kind.',
          ml: 'അയാൾ ഒറ്റയ്ക്ക് പതിയെ പെറുക്കി. സഹായിക്കുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'pocket', role: 'wrong', emoji: '🤫',
        label: { en: 'Keep a coin for yourself', ml: 'ഒരു നാണയം സ്വന്തമാക്കുക' },
        result: {
          en: 'That coin is not yours. Giving it back is honest and kind.',
          ml: 'ആ നാണയം നിന്റേതല്ല. തിരിച്ചുകൊടുക്കുന്നതാ സത്യസന്ധത.',
        },
      },
    ],
  },
  {
    id: 'stucklace',
    construct: 'helping',
    pool: 'probe',
    text: {
      en: "Anu's shoelace is stuck in a knot and the bell is ringing.",
      ml: 'അനുവിന്റെ ഷൂലേസ് കുരുങ്ങിപ്പോയി, ബെല്ലടിക്കുകയും ചെയ്യുന്നു.',
    },
    bubble: '👟',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'untie', role: 'kind', emoji: '🤝',
        label: { en: 'Help untie the knot', ml: 'കുരുക്ക് അഴിക്കാൻ സഹായിക്കുക' },
        result: {
          en: 'You freed it together and reach class in time.',
          ml: 'രണ്ടുപേരും കൂടി അഴിച്ചു, സമയത്ത് ക്ലാസ്സിലെത്തി.',
        },
      },
      {
        id: 'runoff', role: 'passive', emoji: '🏃',
        label: { en: 'Run to class and leave her', ml: 'അവളെ വിട്ട് ക്ലാസ്സിലേക്ക് ഓടുക' },
        result: {
          en: 'Anu is left behind struggling. Helping would be kind.',
          ml: 'അനു കഷ്ടപ്പെട്ട് പിന്നിലായി. സഹായിക്കുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'rushlaugh', role: 'wrong', emoji: '😆',
        label: { en: 'Tell her to hurry and laugh', ml: 'വേഗം വാ എന്ന് പറഞ്ഞ് ചിരിക്കുക' },
        result: {
          en: 'Rushing and laughing does not help. Untie it with her.',
          ml: 'ധൃതി കൂട്ടിയും ചിരിച്ചും കാര്യമില്ല. കൂടെനിന്ന് അഴിക്ക്.',
        },
      },
    ],
  },

  // --- comforting -------------------------------------------------------------
  {
    id: 'brokemodel',
    construct: 'comforting',
    pool: 'training',
    text: {
      en: "Sam's clay model broke and he looks very upset.",
      ml: 'സാമിന്റെ കളിമൺ രൂപം പൊട്ടിപ്പോയി, അവന് വലിയ സങ്കടം.',
    },
    bubble: '😢',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'cheer', role: 'kind', emoji: '💬',
        label: { en: "Say, 'We can make it again together'", ml: "'നമുക്ക് ഒരുമിച്ച് വീണ്ടും ഉണ്ടാക്കാം' എന്ന് പറയുക" },
        result: {
          en: 'Sam feels better and you rebuild it together.',
          ml: 'സാമിന് ആശ്വാസമായി, രണ്ടുപേരും കൂടി വീണ്ടും ഉണ്ടാക്കി.',
        },
      },
      {
        id: 'shrug', role: 'passive', emoji: '🤷',
        label: { en: "Say, 'It doesn't matter'", ml: "'അതൊന്നും സാരമില്ല' എന്ന് പറയുക" },
        result: {
          en: 'Sam feels his sadness is ignored. A kind word helps more.',
          ml: 'അവന്റെ സങ്കടം ആരും ശ്രദ്ധിച്ചില്ലെന്ന് സാമിന് തോന്നി. നല്ല വാക്കാ സഹായിക്കുക.',
        },
      },
      {
        id: 'laughbroke', role: 'wrong', emoji: '😆',
        label: { en: "Laugh and say, 'It looks funny now'", ml: "ചിരിച്ച് 'ഇപ്പോ അത് തമാശയായി' എന്ന് പറയുക" },
        result: {
          en: 'That hurts Sam more. A kind word is better.',
          ml: 'അത് സാമിനെ കൂടുതൽ വിഷമിപ്പിച്ചു. നല്ല വാക്കാ വേണ്ടത്.',
        },
      },
    ],
  },
  {
    id: 'scaredark',
    construct: 'comforting',
    pool: 'training',
    text: {
      en: 'The lights go out and a younger boy looks frightened.',
      ml: 'ലൈറ്റ് പോയപ്പോൾ ഒരു ചെറിയ കുട്ടി പേടിച്ചുനിൽക്കുന്നു.',
    },
    bubble: '😨',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'holdhand', role: 'kind', emoji: '🤝',
        label: { en: "Hold his hand and say, 'It's okay'", ml: "കൈ പിടിച്ച് 'സാരമില്ല' എന്ന് പറയുക" },
        result: {
          en: 'He feels safe with you beside him.',
          ml: 'നീ കൂടെയുള്ളപ്പോൾ അവന് ധൈര്യമായി.',
        },
      },
      {
        id: 'moveaway', role: 'passive', emoji: '🚶',
        label: { en: 'Move away and wait for the lights', ml: 'മാറിനിന്ന് ലൈറ്റ് വരാൻ കാത്തിരിക്കുക' },
        result: {
          en: 'He stays scared and alone. A kind word would help.',
          ml: 'അവൻ പേടിച്ച് ഒറ്റയ്ക്കായി. ഒരു നല്ല വാക്ക് സഹായിച്ചേനെ.',
        },
      },
      {
        id: 'scareboo', role: 'wrong', emoji: '👻',
        label: { en: "Jump out and shout 'Boo!'", ml: "ചാടിവന്ന് 'ബൂ!' എന്ന് പേടിപ്പിക്കുക" },
        result: {
          en: 'That frightens him even more. Comfort him instead.',
          ml: 'അത് അവനെ കൂടുതൽ പേടിപ്പിച്ചു. പകരം ആശ്വസിപ്പിക്ക്.',
        },
      },
    ],
  },
  {
    id: 'lostrace',
    construct: 'comforting',
    pool: 'probe',
    text: {
      en: 'Meera came last in the race and is close to tears.',
      ml: 'മീര ഓട്ടമത്സരത്തിൽ ഏറ്റവും പിന്നിലായി, കരയാറായി നിൽക്കുന്നു.',
    },
    bubble: '😢',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'welltried', role: 'kind', emoji: '💬',
        label: { en: "Say, 'You tried so hard, well done'", ml: "'നീ നന്നായി ശ്രമിച്ചല്ലോ, കൊള്ളാം' എന്ന് പറയുക" },
        result: {
          en: 'Meera smiles — she feels proud she tried.',
          ml: 'മീര ചിരിച്ചു — ശ്രമിച്ചതിൽ അഭിമാനം തോന്നി.',
        },
      },
      {
        id: 'sayrules', role: 'passive', emoji: '🤷',
        label: { en: "Say, 'Someone has to come last'", ml: "'ആരെങ്കിലും പിന്നിലാകുമല്ലോ' എന്ന് പറയുക" },
        result: {
          en: 'Meera still feels bad. Kind words would comfort her.',
          ml: 'മീരയ്ക്ക് അപ്പോഴും വിഷമം. നല്ല വാക്ക് ആശ്വാസമായേനെ.',
        },
      },
      {
        id: 'teaseslow', role: 'wrong', emoji: '😆',
        label: { en: "Say, 'You're so slow!'", ml: "'നീ എന്ത് പതുക്കെയാ!' എന്ന് കളിയാക്കുക" },
        result: {
          en: 'That makes her cry. Comfort her instead.',
          ml: 'അത് അവളെ കരയിച്ചു. പകരം ആശ്വസിപ്പിക്ക്.',
        },
      },
    ],
  },
  {
    id: 'sickfriend',
    construct: 'comforting',
    pool: 'probe',
    text: {
      en: 'Aisha feels sick and is resting her head on the desk.',
      ml: 'ആയിഷയ്ക്ക് സുഖമില്ല, തല മേശയിൽ ചായ്ച്ചു കിടക്കുന്നു.',
    },
    bubble: '🤒',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'telladult', role: 'kind', emoji: '🧑‍🏫',
        label: { en: 'Tell the teacher she is unwell', ml: 'അവൾക്ക് സുഖമില്ലെന്ന് ടീച്ചറോട് പറയുക' },
        result: {
          en: 'The teacher helps Aisha. She feels cared for.',
          ml: 'ടീച്ചർ ആയിഷയെ സഹായിച്ചു. ആരോ ശ്രദ്ധിക്കുന്നെന്ന് അവൾക്ക് തോന്നി.',
        },
      },
      {
        id: 'saynothing', role: 'passive', emoji: '🧍',
        label: { en: 'Say nothing and keep working', ml: 'ഒന്നും പറയാതെ പണി തുടരുക' },
        result: {
          en: 'Aisha stays unwell and unnoticed. Telling someone helps.',
          ml: 'ആയിഷ അസുഖത്തോടെ ഒറ്റയ്ക്കിരുന്നു. ആരോടെങ്കിലും പറയുന്നതാ നല്ലത്.',
        },
      },
      {
        id: 'poke', role: 'wrong', emoji: '👉',
        label: { en: 'Poke her to wake her up', ml: 'കുത്തി അവളെ ഉണർത്തുക' },
        result: {
          en: 'Poking a sick friend is unkind. Get help instead.',
          ml: 'അസുഖമുള്ള കൂട്ടുകാരിയെ കുത്തുന്നത് മോശമാ. പകരം സഹായം കൊണ്ടുവാ.',
        },
      },
    ],
  },

  // --- inclusion ---------------------------------------------------------------
  {
    id: 'nopartner',
    construct: 'inclusion',
    pool: 'training',
    text: {
      en: 'The class makes pairs and one boy has no partner.',
      ml: 'ക്ലാസ്സിൽ ജോഡികളാക്കുമ്പോൾ ഒരു കുട്ടിക്ക് ജോഡിയില്ല.',
    },
    bubble: '🧍',
    scene: { mood: 'sad', watching: true },
    options: [
      {
        id: 'bepartner', role: 'kind', emoji: '🤝',
        label: { en: "Say, 'Be my partner!'", ml: "'നീ എന്റെ ജോഡിയാകാം!' എന്ന് പറയുക" },
        result: {
          en: 'He grins and joins you happily.',
          ml: 'അവൻ ചിരിച്ച് സന്തോഷത്തോടെ കൂടെക്കൂടി.',
        },
      },
      {
        id: 'pairfast', role: 'passive', emoji: '🙊',
        label: { en: 'Say nothing and pair up fast', ml: 'ഒന്നും പറയാതെ വേഗം ജോഡിയാകുക' },
        result: {
          en: 'He is left with no partner. Inviting him is kinder.',
          ml: 'അവന് ജോഡിയില്ലാതെ പോയി. അവനെ കൂട്ടുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'nothim', role: 'wrong', emoji: '🙅',
        label: { en: "Say, 'Not with him'", ml: "'അവന്റെ കൂടെ വേണ്ട' എന്ന് പറയുക" },
        result: {
          en: 'That hurts him. Everyone can have a partner.',
          ml: 'അത് അവനെ വേദനിപ്പിച്ചു. എല്ലാവർക്കും ജോഡിയാകാലോ.',
        },
      },
    ],
  },
  {
    id: 'newtable',
    construct: 'inclusion',
    pool: 'training',
    text: {
      en: 'A new boy stands holding his tray, with nowhere to sit.',
      ml: 'പുതിയ കുട്ടി ട്രേ പിടിച്ച് നിൽക്കുന്നു, ഇരിക്കാൻ സ്ഥലമില്ല.',
    },
    bubble: '🍽️',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'makeroom', role: 'kind', emoji: '🪑',
        label: { en: 'Make room and wave him over', ml: 'സ്ഥലം ഒഴിച്ച് അവനെ വിളിക്കുക' },
        result: {
          en: 'He sits with you and feels welcome.',
          ml: 'അവൻ കൂടെയിരുന്നു, സ്വാഗതം കിട്ടിയെന്ന് തോന്നി.',
        },
      },
      {
        id: 'keepeat', role: 'passive', emoji: '🍚',
        label: { en: 'Keep eating and look away', ml: 'നോക്കാതെ കഴിക്കുന്നത് തുടരുക' },
        result: {
          en: 'He wanders off alone. Making room would be kind.',
          ml: 'അവൻ ഒറ്റയ്ക്ക് അലഞ്ഞു. സ്ഥലം കൊടുക്കുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'taken', role: 'wrong', emoji: '🙅',
        label: { en: "Say, 'These seats are taken'", ml: "'ഇവിടെ ആളുണ്ട്' എന്ന് പറയുക" },
        result: {
          en: 'That is unfriendly. Sharing a seat is kind.',
          ml: 'അത് മോശമാ. ഒരു സീറ്റ് പങ്കുവെക്കുന്നതാ നല്ലത്.',
        },
      },
    ],
  },
  {
    id: 'grouptalk',
    construct: 'inclusion',
    pool: 'probe',
    text: {
      en: 'Two friends are chatting and a lonely girl edges closer, wanting to join.',
      ml: 'രണ്ട് കൂട്ടുകാർ സംസാരിക്കുന്നു, ഒറ്റയ്ക്കുള്ള ഒരു കുട്ടി കൂടാൻ ആഗ്രഹിച്ച് അടുത്തേക്ക് നീങ്ങുന്നു.',
    },
    bubble: '💬',
    scene: { mood: 'sad', watching: true },
    options: [
      {
        id: 'turnin', role: 'kind', emoji: '👋',
        label: { en: "Turn to her and say, 'Come join us'", ml: "അവളുടെ നേരെ തിരിഞ്ഞ് 'വാ, കൂടെക്കൂടാം' എന്ന് പറയുക" },
        result: {
          en: 'She joins the chat and feels included.',
          ml: 'അവൾ സംസാരത്തിൽ കൂടി, കൂട്ടത്തിലായെന്ന് തോന്നി.',
        },
      },
      {
        id: 'keeptalk', role: 'passive', emoji: '🗣️',
        label: { en: 'Keep talking, backs to her', ml: 'അവൾക്ക് പുറംതിരിഞ്ഞ് സംസാരം തുടരുക' },
        result: {
          en: 'She stays outside the circle. Inviting her is kinder.',
          ml: 'അവൾ പുറത്തുതന്നെ നിന്നു. അവളെ കൂട്ടുന്നതായിരുന്നു നല്ലത്.',
        },
      },
      {
        id: 'secret', role: 'wrong', emoji: '🤫',
        label: { en: "Whisper, 'This is private'", ml: "'ഇത് ഞങ്ങളുടെ കാര്യമാ' എന്ന് അടക്കം പറയുക" },
        result: {
          en: 'That leaves her out on purpose. Including her is kind.',
          ml: 'അത് അവളെ മനഃപൂർവം ഒഴിവാക്കലാ. കൂട്ടുന്നതാ നല്ലത്.',
        },
      },
    ],
  },
  {
    id: 'wheelchair',
    construct: 'inclusion',
    pool: 'probe',
    text: {
      en: 'A boy in a wheelchair watches the others play tag.',
      ml: 'വീൽചെയറിലിരിക്കുന്ന ഒരു കുട്ടി മറ്റുള്ളവർ പിടിത്തക്കളി കളിക്കുന്നത് നോക്കുന്നു.',
    },
    bubble: '👦',
    scene: { mood: 'sad', watching: true },
    options: [
      {
        id: 'changegame', role: 'kind', emoji: '⚽',
        label: { en: "Say, 'Let's play a game he can join'", ml: "'അവനും കളിക്കാവുന്ന കളി കളിക്കാം' എന്ന് പറയുക" },
        result: {
          en: 'Everyone plays together and he has fun.',
          ml: 'എല്ലാവരും ഒരുമിച്ച് കളിച്ചു, അവനും രസിച്ചു.',
        },
      },
      {
        id: 'playon', role: 'passive', emoji: '🏃',
        label: { en: 'Keep playing tag without him', ml: 'അവനില്ലാതെ കളി തുടരുക' },
        result: {
          en: 'He only watches. Choosing a game he can join is kinder.',
          ml: 'അവൻ നോക്കിനിന്നതേയുള്ളൂ. അവനും കൂടാവുന്ന കളി തിരഞ്ഞെടുക്കുന്നതാ നല്ലത്.',
        },
      },
      {
        id: 'cantplay', role: 'wrong', emoji: '🙅',
        label: { en: "Say, 'You can't play'", ml: "'നിനക്ക് കളിക്കാൻ പറ്റില്ല' എന്ന് പറയുക" },
        result: {
          en: 'That hurts him. There is always a way to include a friend.',
          ml: 'അത് അവനെ വേദനിപ്പിച്ചു. കൂട്ടുകാരനെ കൂട്ടാൻ എപ്പോഴും വഴിയുണ്ട്.',
        },
      },
    ],
  },

  // --- politeness ----------------------------------------------------------------
  {
    id: 'gotgift',
    construct: 'politeness',
    pool: 'training',
    text: {
      en: 'Your aunt gives you a present.',
      ml: 'നിന്റെ ആന്റി നിനക്കൊരു സമ്മാനം തന്നു.',
    },
    bubble: '🎁',
    scene: { mood: 'neutral', tall: true },
    options: [
      {
        id: 'thankaunt', role: 'kind', emoji: '🙏',
        label: { en: "Say, 'Thank you, Aunty!'", ml: "'നന്ദി, ആന്റി!' എന്ന് പറയുക" },
        result: {
          en: 'Your aunt is delighted you thanked her.',
          ml: 'നന്ദി പറഞ്ഞപ്പോൾ ആന്റിക്ക് സന്തോഷമായി.',
        },
      },
      {
        id: 'justtake', role: 'passive', emoji: '🤐',
        label: { en: 'Take it and say nothing', ml: 'ഒന്നും പറയാതെ വാങ്ങുക' },
        result: {
          en: 'She feels unnoticed. A thank you shows you care.',
          ml: 'അവർക്ക് വിഷമമായി. നന്ദി പറഞ്ഞാൽ സ്നേഹം കാണിക്കാം.',
        },
      },
      {
        id: 'complain', role: 'wrong', emoji: '😒',
        label: { en: "Say, 'I didn't want this'", ml: "'എനിക്ക് ഇത് വേണ്ടായിരുന്നു' എന്ന് പറയുക" },
        result: {
          en: 'That is hurtful. A thank you is kind even for a small gift.',
          ml: 'അത് വിഷമമാകും. ചെറിയ സമ്മാനത്തിനും നന്ദി പറയണം.',
        },
      },
    ],
  },
  {
    id: 'bumpsorry',
    construct: 'politeness',
    pool: 'training',
    text: {
      en: 'You bump into a classmate while turning around quickly.',
      ml: 'വേഗം തിരിയുമ്പോൾ നീ ഒരു സഹപാഠിയെ തട്ടി.',
    },
    bubble: '💥',
    scene: { mood: 'neutral' },
    options: [
      {
        id: 'saysorry', role: 'kind', emoji: '🙏',
        label: { en: "Say, 'Oh, sorry!'", ml: "'അയ്യോ, സോറി!' എന്ന് പറയുക" },
        result: {
          en: 'Saying sorry makes things right.',
          ml: 'സോറി പറഞ്ഞപ്പോൾ കാര്യം ശരിയായി.',
        },
      },
      {
        id: 'carryon', role: 'passive', emoji: '😐',
        label: { en: 'Say nothing and carry on', ml: 'ഒന്നും പറയാതെ പോകുക' },
        result: {
          en: "She's left rubbing her arm. A sorry would be kind.",
          ml: 'അവൾ കൈ തടവിക്കൊണ്ട് നിന്നു. ഒരു സോറി പറഞ്ഞാൽ നന്നായേനെ.',
        },
      },
      {
        id: 'blame', role: 'wrong', emoji: '😠',
        label: { en: "Say, 'Watch where you stand!'", ml: "'നോക്കി നിൽക്കാൻ പറ്റില്ലേ!' എന്ന് കുറ്റപ്പെടുത്തുക" },
        result: {
          en: 'Blaming her is rude when it was an accident. Say sorry.',
          ml: 'അറിയാതെ പറ്റിയതിന് കുറ്റപ്പെടുത്തുന്നത് മോശമാ. സോറി പറയ്.',
        },
      },
    ],
  },
  {
    id: 'phonecall',
    construct: 'politeness',
    pool: 'probe',
    text: {
      en: 'Your mother is on an important phone call and you want juice.',
      ml: 'അമ്മ ഒരു പ്രധാന ഫോൺ വിളിയിലാ, നിനക്ക് ജ്യൂസ് വേണം.',
    },
    bubble: '📞',
    scene: { mood: 'neutral', tall: true },
    options: [
      {
        id: 'waitcall', role: 'kind', emoji: '🙋',
        label: { en: 'Wait quietly until she finishes', ml: 'വിളി കഴിയുന്നതുവരെ മിണ്ടാതെ കാത്തിരിക്കുക' },
        result: {
          en: 'Mother finishes and gladly gets your juice.',
          ml: 'വിളി കഴിഞ്ഞ് അമ്മ സന്തോഷത്തോടെ ജ്യൂസ് തന്നു.',
        },
      },
      {
        id: 'giveup', role: 'passive', emoji: '🚶',
        label: { en: 'Give up and walk away thirsty', ml: 'വേണ്ടെന്ന് വെച്ച് ദാഹത്തോടെ പോകുക' },
        result: {
          en: 'You stay thirsty. Waiting and asking after would work.',
          ml: 'നിനക്ക് ദാഹം മാറിയില്ല. കാത്തിരുന്ന് ചോദിച്ചാൽ മതിയായിരുന്നു.',
        },
      },
      {
        id: 'yellover', role: 'wrong', emoji: '📢',
        label: { en: 'Shout over her call', ml: 'വിളിക്ക് മീതെ ഒച്ചവെക്കുക' },
        result: {
          en: 'Shouting over a call is rude. Wait for a pause.',
          ml: 'വിളിക്ക് മീതെ ഒച്ചവെക്കുന്നത് മോശമാ. ഒന്ന് നിർത്തുന്നതുവരെ കാത്തിരിക്ക്.',
        },
      },
    ],
  },
  {
    id: 'sharedfood',
    construct: 'politeness',
    pool: 'probe',
    text: {
      en: "A friend offers you a bite of food you don't like.",
      ml: 'ഒരു കൂട്ടുകാരൻ നിനക്ക് ഇഷ്ടമല്ലാത്ത ഭക്ഷണം ഒരു കഷണം നീട്ടി.',
    },
    bubble: '🍢',
    scene: { mood: 'neutral' },
    options: [
      {
        id: 'politeno', role: 'kind', emoji: '🙂',
        label: { en: "Smile and say, 'No thank you'", ml: "ചിരിച്ച് 'വേണ്ട, നന്ദി' എന്ന് പറയുക" },
        result: {
          en: 'A polite no keeps your friend happy.',
          ml: 'മര്യാദയോടെ വേണ്ടെന്ന് പറഞ്ഞപ്പോൾ കൂട്ടുകാരന് സന്തോഷം.',
        },
      },
      {
        id: 'faceaway', role: 'passive', emoji: '😐',
        label: { en: 'Turn your face away silently', ml: 'ഒന്നും പറയാതെ മുഖം തിരിക്കുക' },
        result: {
          en: 'That looks rude. A polite "no thank you" is kinder.',
          ml: 'അത് മോശമായി തോന്നും. "വേണ്ട, നന്ദി" എന്ന് പറയുന്നതാ നല്ലത്.',
        },
      },
      {
        id: 'yuck', role: 'wrong', emoji: '🤢',
        label: { en: "Say, 'Yuck, that's disgusting!'", ml: "'ഛെ, ഇത് അറപ്പാ!' എന്ന് പറയുക" },
        result: {
          en: 'That hurts his feelings. A polite no is kind.',
          ml: 'അത് അവനെ വേദനിപ്പിച്ചു. മര്യാദയോടെ വേണ്ടെന്ന് പറയുന്നതാ നല്ലത്.',
        },
      },
    ],
  },

  // --- fairness -----------------------------------------------------------------
  {
    id: 'onecookie',
    construct: 'fairness',
    pool: 'training',
    text: {
      en: "There is one cookie left and your friend hasn't had any.",
      ml: 'ഒരു ബിസ്‌ക്കറ്റ് മാത്രം ബാക്കി, കൂട്ടുകാരന് ഇതുവരെ ഒന്നും കിട്ടിയിട്ടില്ല.',
    },
    bubble: '🍪',
    scene: { mood: 'sad' },
    options: [
      {
        id: 'halfit', role: 'kind', emoji: '🤝',
        label: { en: 'Break it in half to share', ml: 'പകുതിയാക്കി പങ്കുവെക്കുക' },
        result: {
          en: 'You both get a piece. That was fair!',
          ml: 'രണ്ടുപേർക്കും കിട്ടി. അത് ന്യായമായി!',
        },
      },
      {
        id: 'eatall', role: 'passive', emoji: '🤷',
        label: { en: 'Eat it quickly yourself', ml: 'വേഗം സ്വയം കഴിക്കുക' },
        result: {
          en: 'Your friend gets none. Sharing would be fair.',
          ml: 'കൂട്ടുകാരന് ഒന്നും കിട്ടിയില്ല. പങ്കുവെക്കുന്നതായിരുന്നു ന്യായം.',
        },
      },
      {
        id: 'eattease', role: 'wrong', emoji: '😋',
        label: { en: 'Eat it slowly in front of him', ml: 'അവന്റെ മുന്നിൽ പതുക്കെ കഴിക്കുക' },
        result: {
          en: 'That is unkind. Sharing the last one is fair.',
          ml: 'അത് മോശമാ. അവസാനത്തേത് പങ്കുവെക്കുന്നതാ ന്യായം.',
        },
      },
    ],
  },
  {
    id: 'bigslice',
    construct: 'fairness',
    pool: 'training',
    text: {
      en: 'You cut the cake — one slice is big, one is small.',
      ml: 'നീ കേക്ക് മുറിച്ചു — ഒരു കഷണം വലുത്, ഒന്ന് ചെറുത്.',
    },
    bubble: '🍰',
    scene: { mood: 'neutral' },
    options: [
      {
        id: 'givebig', role: 'kind', emoji: '🤝',
        label: { en: 'Give your friend the big slice', ml: 'വലിയ കഷണം കൂട്ടുകാരന് കൊടുക്കുക' },
        result: {
          en: 'Your friend is happy — that was generous and fair.',
          ml: 'കൂട്ടുകാരന് സന്തോഷം — അത് ഉദാരവും ന്യായവുമായി.',
        },
      },
      {
        id: 'takebig', role: 'passive', emoji: '🙂',
        label: { en: 'Keep the big one for yourself', ml: 'വലിയത് സ്വന്തമാക്കുക' },
        result: {
          en: 'Your friend gets the small piece. Sharing evenly is fairer.',
          ml: 'കൂട്ടുകാരന് ചെറിയത് കിട്ടി. ഒരുപോലെ പങ്കിടുന്നതാ ന്യായം.',
        },
      },
      {
        id: 'bothmine', role: 'wrong', emoji: '🙅',
        label: { en: 'Take both slices', ml: 'രണ്ട് കഷണവും എടുക്കുക' },
        result: {
          en: 'Taking both leaves him nothing. Fair means sharing.',
          ml: 'രണ്ടും എടുത്താൽ അവന് ഒന്നും ഇല്ല. ന്യായം എന്നാൽ പങ്കുവെക്കലാ.',
        },
      },
    ],
  },
  {
    id: 'foundpencil',
    construct: 'fairness',
    pool: 'probe',
    text: {
      en: 'You find a nice pencil. Another child says it might be theirs.',
      ml: 'നിനക്ക് നല്ലൊരു പെൻസിൽ കിട്ടി. അത് തന്റേതാവാം എന്ന് വേറൊരു കുട്ടി പറയുന്നു.',
    },
    bubble: '✏️',
    scene: { mood: 'neutral' },
    options: [
      {
        id: 'checkowner', role: 'kind', emoji: '🙋',
        label: { en: 'Ask around to find whose it is', ml: 'ആരുടേതാണെന്ന് അന്വേഷിക്കുക' },
        result: {
          en: 'You find the owner. Being fair feels good.',
          ml: 'ഉടമയെ കണ്ടെത്തി. ന്യായം കാണിച്ചത് നല്ലതായി.',
        },
      },
      {
        id: 'slipbag', role: 'passive', emoji: '🤐',
        label: { en: 'Quietly slip it into your bag', ml: 'മിണ്ടാതെ ബാഗിലിടുക' },
        result: {
          en: 'Someone lost their pencil. Finding the owner is fair.',
          ml: 'ആരുടെയോ പെൻസിൽ പോയി. ഉടമയെ കണ്ടെത്തുന്നതാ ന്യായം.',
        },
      },
      {
        id: 'itsmine', role: 'wrong', emoji: '🙅',
        label: { en: "Insist, 'It's mine now!'", ml: "'ഇനി ഇത് എന്റേതാ!' എന്ന് വാശിപിടിക്കുക" },
        result: {
          en: 'Claiming it unfairly is not right. Find who lost it.',
          ml: 'അന്യായമായി അവകാശപ്പെടുന്നത് ശരിയല്ല. കളഞ്ഞുപോയ ആളെ കണ്ടെത്ത്.',
        },
      },
    ],
  },
  {
    id: 'scorecheat',
    construct: 'fairness',
    pool: 'probe',
    text: {
      en: 'In a board game, you could move an extra space when no one is looking.',
      ml: 'ബോർഡ് കളിയിൽ ആരും നോക്കാത്തപ്പോൾ നിനക്ക് ഒരു കളം കൂടുതൽ നീങ്ങാം.',
    },
    bubble: '🎲',
    scene: { mood: 'neutral' },
    options: [
      {
        id: 'playfair', role: 'kind', emoji: '🤝',
        label: { en: 'Move only the right number', ml: 'ശരിയായ എണ്ണം മാത്രം നീങ്ങുക' },
        result: {
          en: 'Everyone trusts you — fair play keeps it fun.',
          ml: 'എല്ലാവർക്കും നിന്നെ വിശ്വാസമായി — ന്യായമായി കളിച്ചാൽ രസമാ.',
        },
      },
      {
        id: 'hidescore', role: 'passive', emoji: '🤫',
        label: { en: 'Stay quiet about the real score', ml: 'ശരിയായ സ്കോർ പറയാതിരിക്കുക' },
        result: {
          en: 'Hiding the score is not fair. Play by the real count.',
          ml: 'സ്കോർ ഒളിപ്പിക്കുന്നത് ന്യായമല്ല. ശരിക്കുള്ള എണ്ണം അനുസരിച്ച് കളിക്ക്.',
        },
      },
      {
        id: 'moveextra', role: 'wrong', emoji: '😏',
        label: { en: 'Sneak an extra move', ml: 'ഒളിച്ച് ഒരു നീക്കം കൂടുതൽ ചെയ്യുക' },
        result: {
          en: 'Cheating is unfair to everyone. Play by the rules.',
          ml: 'കള്ളക്കളി എല്ലാവരോടും അന്യായമാ. നിയമപ്രകാരം കളിക്ക്.',
        },
      },
    ],
  },
]

/** Situations of one construct within one pool (each pair is a level's quota). */
export function situationsFor(construct: Construct, pool: StimulusPool): Situation[] {
  return SITUATIONS.filter((s) => s.construct === construct && s.pool === pool)
}
