/**
 * The language the trainer's console and the headset speak to each other.
 *
 * Both halves of the remote control are this same app, so the protocol lives
 * in one file rather than being duplicated across a client and a server: the
 * relay (`server/app/routers/remote.py`) only moves opaque `{type, payload}`
 * objects around and never looks inside them, which means a new control needs
 * a frontend deploy and nothing else.
 */
import type { Difficulty, GameId, PlayMode } from '../types'
import type { Lang } from '../i18n/strings'
import type { InputMethod } from '../types'

/** Bumped when a command's meaning changes incompatibly. Reported in status so
 *  a console on an older build can say so instead of silently doing nothing. */
export const REMOTE_PROTOCOL_VERSION = 1

/** Session settings the trainer can change from the phone, mid-session. */
export interface RemoteSettings {
  voiceOn: boolean
  soundOn: boolean
  language: Lang
  inputMethod: InputMethod
  playMode: PlayMode
}

export type RemoteCommand =
  /** Open a game (optionally setting its level first) and, if the child is
   *  already inside a headset session, leave that session cleanly on the way. */
  | { type: 'goto'; payload: { gameId: GameId; level?: Difficulty } }
  /** Back to the app's Home page, ending any live headset session. */
  | { type: 'home'; payload: Record<string, never> }
  /** Press the Play button on whatever start/level screen is showing. */
  | { type: 'play'; payload: Record<string, never> }
  /** Play the same level again from a result screen. */
  | { type: 'restart'; payload: Record<string, never> }
  /** End the session and go Home — the "get them out of there" button. */
  | { type: 'quit'; payload: Record<string, never> }
  /** Change a level. Defaults to the game currently open. */
  | { type: 'setLevel'; payload: { level: Difficulty; gameId?: GameId } }
  /** Change one or more session settings. */
  | { type: 'setting'; payload: Partial<RemoteSettings> }
  /** Record the session against this participant (null = unrecorded). */
  | { type: 'participant'; payload: { studentId: string | null } }
  /** Start/stop sending the mirror image of the child's view. */
  | { type: 'mirror'; payload: { on: boolean; intervalMs?: number } }
  /** Keep-alive, so the headset can show "trainer connected". */
  | { type: 'ping'; payload: Record<string, never> }

export type RemoteCommandType = RemoteCommand['type']

/**
 * What the child is doing right now, as far as any shared component knows.
 *
 * `enterVr` is the one the trainer must not miss: the child is on the Enter VR
 * screen, and the press that starts the session can only happen on the headset
 * (WebXR requires user activation there — see docs/trainer-remote.md).
 */
export type RemotePhase = 'menu' | 'start' | 'playing' | 'over' | 'enterVr'

export interface RemoteStatus {
  v: number
  /** Hash route the headset is on, e.g. `/park-360`. */
  route: string
  gameId: GameId | null
  gameTitle: string | null
  /** The level that will be played (or is being played) in that game. */
  level: Difficulty | null
  phase: RemotePhase
  /** True while a headset session is actually presenting. */
  vrActive: boolean
  /** Points, and any "3 / 8"-style progress the game shows next to them. */
  score: number | null
  progress: string | null
  /** The prompt the child is being asked right now, in their language. */
  prompt: string | null
  settings: RemoteSettings
  studentId: string | null
  studentName: string | null
  /** Whether a mirror image is being produced, and why not when it isn't. */
  mirror: 'live' | 'off' | 'unavailable'
  /** Headset clock at the moment this was assembled. */
  at: number
}

/** A command as it travels through the relay. */
export interface RemoteEnvelope {
  seq: number
  type: string
  payload: Record<string, unknown>
  /** How long ago the console sent it, measured by the relay — so a headset
   *  coming back from a reload can ignore instructions that have gone stale
   *  without trusting its own clock. */
  age_ms?: number
}

/**
 * Narrow a relayed envelope to a command this build understands.
 *
 * The relay accepts any string as a type, and a console may be running a newer
 * build than the headset, so an unknown type has to be dropped quietly rather
 * than crash the loop that is the child's only way out of a game.
 */
const KNOWN: ReadonlySet<string> = new Set<RemoteCommandType>([
  'goto', 'home', 'play', 'restart', 'quit', 'setLevel', 'setting', 'participant', 'mirror', 'ping',
])

export function parseCommand(envelope: RemoteEnvelope): RemoteCommand | null {
  if (!KNOWN.has(envelope.type)) return null
  return { type: envelope.type, payload: envelope.payload ?? {} } as RemoteCommand
}
