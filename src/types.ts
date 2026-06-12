export type GameId = 'emotions' | 'zebra' | 'garden' | 'balldrop' | 'mirror' | 'blocks' | 'museum'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GameMeta {
  id: GameId
  title: string
  icon: string
  path: string
  color: string
}

export const GAME_LIST: GameMeta[] = [
  { id: 'emotions', title: 'Feelings Faces', icon: '😊', path: '/emotions', color: '#f6c177' },
  { id: 'zebra', title: 'Cross the Road', icon: '🚦', path: '/zebra', color: '#9ccfd8' },
  { id: 'garden', title: 'Garden Finder', icon: '🦋', path: '/garden', color: '#a3be8c' },
  { id: 'balldrop', title: 'Ball Drop', icon: '🔴', path: '/balldrop', color: '#c4a7e7' },
  { id: 'mirror', title: 'Emotion Mirror', icon: '🪞', path: '/mirror', color: '#e0a3c8' },
  { id: 'blocks', title: 'Block Buddies', icon: '🧱', path: '/blocks', color: '#f0a868' },
  { id: 'museum', title: 'Museum Look', icon: '🖼️', path: '/museum', color: '#8fb8e0' },
]
