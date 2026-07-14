export type GameId =
  | 'emotionrecognition'
  | 'blocks'
  | 'rollback'
  | 'football360'
  | 'museum'
  | 'museum360'
  | 'rightway'
  | 'rulefixer'
  | 'identifyemotions'
  | 'discovery'
export type Difficulty = 'easy' | 'medium' | 'hard'

/** The four skills the study targets — every game trains exactly one. */
export type Skill = 'emotion' | 'turntaking' | 'socialnorms' | 'jointattention'

export interface SkillMeta {
  id: Skill
  label: string
  icon: string
  /** Accent colour used across the Home sections and Progress dashboard. */
  color: string
}

/** Display order for the skill sections on the Home page. */
export const SKILLS: SkillMeta[] = [
  { id: 'emotion', label: 'Emotional Identification', icon: '🙂', color: '#f59e0b' },
  { id: 'turntaking', label: 'Turn-Taking', icon: '🔄', color: '#14b8a6' },
  { id: 'socialnorms', label: 'Social Norms', icon: '⚖️', color: '#16a34a' },
  { id: 'jointattention', label: 'Joint Attention', icon: '👀', color: '#3b82f6' },
]

export function skillMeta(id: Skill): SkillMeta {
  return SKILLS.find((s) => s.id === id)!
}

export interface GameMeta {
  id: GameId
  title: string
  icon: string
  path: string
  color: string
  /** Which of the four target skills this game trains. */
  skill: Skill
  /** Short subtitle shown under the title on the home card. */
  description: string
  /** One-line learning objective shown on the game detail page. */
  objective: string
  /** Human-readable play duration shown on the detail page. */
  duration: string
  /** True for games with an easy/medium/hard progression (server-tracked). */
  hasLevels: boolean
}

// Grouped two-per-skill, in SKILLS order, so the Home page can render one
// section per skill without any extra sorting.
export const GAME_LIST: GameMeta[] = [
  // --- Emotional Identification -----------------------------------------
  {
    id: 'emotionrecognition',
    title: 'Emotion Recognition',
    icon: '🙂',
    path: '/emotion-recognition',
    color: '#f59e0b',
    skill: 'emotion',
    description: 'Identify facial expressions',
    objective: 'Recognise and name basic and complex emotions from facial cues',
    duration: '15–20 min',
    hasLevels: true,
  },
  {
    id: 'identifyemotions',
    title: 'Emotion Clips',
    icon: '🎬',
    path: '/identifyemotions',
    color: '#8b5cf6',
    skill: 'emotion',
    description: 'Read emotions in motion',
    objective: 'Identify emotions from dynamic video clips, from full-intensity to partially-formed expressions',
    duration: '5–10 min',
    hasLevels: true,
  },
  // --- Turn-Taking --------------------------------------------------------
  {
    id: 'blocks',
    title: 'Block Buddies',
    icon: '🧱',
    path: '/blocks',
    color: '#f97316',
    skill: 'turntaking',
    description: 'Take turns building',
    objective: 'Share and wait during a cooperative activity',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'rollback',
    title: 'Roll-Back Buddy',
    icon: '⚽',
    path: '/rollback',
    color: '#14b8a6',
    skill: 'turntaking',
    description: 'Roll the ball back · പന്ത് ഉരുട്ടിക്കൊടുക്കൂ',
    objective: 'Turn-taking · reciprocity: read who is ready for the ball (voice → gesture → body cue) and roll it back · ആരാ റെഡി എന്ന് നോക്കി പന്ത് ഉരുട്ടിക്കൊടുക്കൂ',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'football360',
    title: 'Football 360',
    icon: '🏟️',
    path: '/football-360',
    color: '#22c55e',
    skill: 'turntaking',
    description: 'Pass on the pitch — look around · ഗ്രൗണ്ടിൽ പാസ് ചെയ്യൂ',
    objective:
      'Turn-taking · reciprocity in an immersive first-person football ground: the same read-who-is-ready exchange as Roll-Back Buddy (voice → gesture → body cue, with child-initiated rallies on hard), but the child stands on the centre spot and turns the view — a head turn in VR — to find the teammate who is ready and pass the ball back',
    duration: '5–10 min',
    hasLevels: false,
  },
  // --- Social Norms ---------------------------------------------------------
  {
    id: 'rightway',
    title: 'Right or Wrong',
    icon: '⚖️',
    path: '/rightway',
    color: '#16a34a',
    skill: 'socialnorms',
    description: 'Judge the situation · ശരിയോ തെറ്റോ പറയൂ',
    objective:
      'Social norms: judge whether a behaviour is okay across greetings, sharing, turns, space and politeness — harder levels use subtle behaviours (quiet omissions, polite refusals)',
    duration: '5–10 min',
    hasLevels: true,
  },
  {
    id: 'rulefixer',
    title: 'Good Choice',
    icon: '💡',
    path: '/rulefixer',
    color: '#f59e0b',
    skill: 'socialnorms',
    description: 'Pick the kind choice · നല്ലത് തിരഞ്ഞെടുക്കൂ',
    objective:
      'Social norms: choose the kind response across helping, comforting, inclusion, politeness and fairness situations — harder levels drop the obvious wrong option',
    duration: '5–10 min',
    hasLevels: true,
  },
  // --- Joint Attention ------------------------------------------------------
  {
    id: 'museum',
    title: 'Museum Look',
    icon: '🖼️',
    path: '/museum',
    color: '#3b82f6',
    skill: 'jointattention',
    description: 'Look where they look',
    objective:
      'Joint attention · step 1 (responding — prerequisite): follow a pointing hand that fades with success (glowing point → point → far point), interleaved with gaze-only trials where a friend simply looks at the target. Trains the attention-following prerequisite of responding to joint attention across both gesture and gaze cues, not the full live dyadic skill',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'museum360',
    title: 'Museum 360',
    icon: '🧭',
    path: '/museum-360',
    color: '#0ea5e9',
    skill: 'jointattention',
    description: 'Look along the row — follow the cue',
    objective:
      'Joint attention · step 1 (responding) in an immersive first-person gallery: the exhibits sit in a row in front of the child with the helper avatar facing them, and the child turns the view to follow the same fading point and gaze cues as Museum Look — a headset-friendly head turn along the row, closer to a real-world "look where I point" exchange',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'discovery',
    title: 'Look What I Found!',
    icon: '✨',
    path: '/discovery',
    color: '#8b5cf6',
    skill: 'jointattention',
    description: 'Share your discovery · കണ്ടെത്തിയത് കാണിക്കൂ',
    objective:
      'Joint attention · step 2 (initiating): when a surprise appears and nothing prompts you, spontaneously show it to a friend — surprises get subtler and hints disappear at harder levels',
    duration: '5–10 min',
    hasLevels: false,
  },
]

/** Look up a game by id (used by the detail page route). */
export const gameById = (id: string): GameMeta | undefined =>
  GAME_LIST.find((g) => g.id === id)

/** Games grouped by skill, in `SKILLS` order — drives the Home page sections. */
export const GAMES_BY_SKILL: Array<{ skill: SkillMeta; games: GameMeta[] }> = SKILLS.map((skill) => ({
  skill,
  games: GAME_LIST.filter((g) => g.skill === skill.id),
}))
