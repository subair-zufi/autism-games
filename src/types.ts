export type GameId =
  | 'emotionrecognition'
  | 'zebra'
  | 'garden'
  | 'balldrop'
  | 'mirror'
  | 'blocks'
  | 'museum'
  | 'rightway'
  | 'rulefixer'
  | 'slider'
  | 'identifyemotions'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GameMeta {
  id: GameId
  title: string
  icon: string
  path: string
  color: string
  /** Short subtitle shown under the title on the home card. */
  description: string
  /** One-line learning objective shown on the game detail page. */
  objective: string
  /** Human-readable play duration shown on the detail page. */
  duration: string
  /** True for games with an easy/medium/hard progression (server-tracked). */
  hasLevels: boolean
}

export const GAME_LIST: GameMeta[] = [
  {
    id: 'emotionrecognition',
    title: 'Emotion Recognition',
    icon: '🙂',
    path: '/emotion-recognition',
    color: '#f59e0b',
    description: 'Identify facial expressions',
    objective: 'Recognise and name basic and complex emotions from facial cues',
    duration: '15–20 min',
    hasLevels: true,
  },
  {
    id: 'zebra',
    title: 'Cross the Road',
    icon: '🚦',
    path: '/zebra',
    color: '#38bdf8',
    description: 'Wait, look, then cross safely',
    objective: 'Practise stop-and-go impulse control at a crossing',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'museum',
    title: 'Museum Look',
    icon: '🖼️',
    path: '/museum',
    color: '#3b82f6',
    description: 'Look where they look',
    objective: 'Joint attention · step 1: follow a fading cue (glowing point → point → far point) among a few exhibits in a calm room',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'garden',
    title: 'Garden Finder',
    icon: '🦋',
    path: '/garden',
    color: '#22c55e',
    description: 'Follow the point in the garden',
    objective: 'Joint attention · step 2: follow a fading cue (glowing point → point → far point) in a busy garden',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'balldrop',
    title: 'Ball Drop',
    icon: '🔴',
    path: '/balldrop',
    color: '#a855f7',
    description: 'Time your taps',
    objective: 'Build cause-and-effect timing and attention',
    duration: '5 min',
    hasLevels: false,
  },
  {
    id: 'mirror',
    title: 'Emotion Mirror',
    icon: '🪞',
    path: '/mirror',
    color: '#ec4899',
    description: 'Copy the expression',
    objective: 'Imitate and respond to emotional expressions',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'blocks',
    title: 'Block Buddies',
    icon: '🧱',
    path: '/blocks',
    color: '#f97316',
    description: 'Take turns building',
    objective: 'Share and wait during a cooperative activity',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'rightway',
    title: 'Right or Wrong',
    icon: '✅',
    path: '/rightway',
    color: '#16a34a',
    description: 'Judge the situation',
    objective: 'Navigate social norms and appropriate responses',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'rulefixer',
    title: 'Good Choice',
    icon: '💡',
    path: '/rulefixer',
    color: '#f59e0b',
    description: 'Pick the better option',
    objective: 'Learn social rules through better-choice decisions',
    duration: '5–10 min',
    hasLevels: false,
  },
  {
    id: 'slider',
    title: 'Slide Queue',
    icon: '🛝',
    path: '/slider',
    color: '#f43f5e',
    description: 'Wait your turn',
    objective: 'Practise turn-taking and patience in a queue',
    duration: '5 min',
    hasLevels: false,
  },
  {
    id: 'identifyemotions',
    title: 'Emotion Clips',
    icon: '🎬',
    path: '/identifyemotions',
    color: '#8b5cf6',
    description: 'Read emotions in motion',
    objective: 'Identify emotions from short video clips',
    duration: '5–10 min',
    hasLevels: false,
  },
]

/** Look up a game by id (used by the detail page route). */
export const gameById = (id: string): GameMeta | undefined =>
  GAME_LIST.find((g) => g.id === id)
