/**
 * Carrying out what the trainer pressed.
 *
 * Split from the agent that fetches commands so the decisions here — when a
 * live headset session has to be ended first, what "play" means on a screen
 * this module knows nothing about — can be tested without a relay, a router or
 * a headset. Everything the outside world does is reached through
 * `RemoteContext`.
 */
import { GAME_LIST, type Difficulty, type GameId } from '../types'
import type { RemoteCommand, RemoteSettings } from './protocol'
import type { RemoteIntent } from './intents'

export interface RemoteContext {
  /** The hash route the app is on, e.g. `/park-360`. */
  route: () => string
  /** Go to a route inside the running app (never a page load). */
  navigate: (path: string) => void
  /** The headset session presenting right now, if any. */
  currentSession: () => XRSession | null
  /** End that session properly, landing on `path` (see games/exitVr.ts). */
  exitTo: (session: XRSession, path: string) => Promise<void>
  setDifficulty: (game: GameId, level: Difficulty) => void
  applySettings: (patch: Partial<RemoteSettings>) => void
  setStudent: (studentId: string | null) => void
  /** Press a button on whatever screen is up. Returns how many took it. */
  emit: (intent: RemoteIntent) => number
  setMirror: (on: boolean, intervalMs?: number) => void
}

const LEVELS: ReadonlySet<string> = new Set<Difficulty>(['easy', 'medium', 'hard'])

/**
 * Run one command. Never throws: the remote is the trainer's only way to reach
 * a child who is stuck, so a malformed or unknown instruction has to leave the
 * loop running.
 */
export async function applyRemoteCommand(cmd: RemoteCommand, ctx: RemoteContext): Promise<void> {
  try {
    switch (cmd.type) {
      case 'goto': {
        const game = GAME_LIST.find((g) => g.id === cmd.payload.gameId)
        if (!game) return
        const level = cmd.payload.level
        if (level && LEVELS.has(level)) ctx.setDifficulty(game.id, level)
        await goTo(ctx, game.path)
        return
      }
      case 'home':
      case 'quit':
        await goTo(ctx, '/')
        return
      case 'play':
        ctx.emit('play')
        return
      case 'restart':
        ctx.emit('restart')
        return
      case 'setLevel': {
        const level = cmd.payload.level
        if (!LEVELS.has(level)) return
        const game = cmd.payload.gameId ?? currentGameId(ctx.route())
        if (game) ctx.setDifficulty(game, level)
        return
      }
      case 'setting':
        ctx.applySettings(cmd.payload)
        return
      case 'participant':
        ctx.setStudent(cmd.payload.studentId ?? null)
        return
      case 'mirror':
        ctx.setMirror(!!cmd.payload.on, cmd.payload.intervalMs)
        return
      case 'ping':
        return
    }
  } catch (err) {
    console.warn('[remote] command failed:', cmd.type, err)
  }
}

/**
 * Move the child to `path`.
 *
 * With a session presenting, this cannot just navigate: unmounting the canvas
 * mid-session drops the child into the headset's own home environment with no
 * browser window (see games/exitVr.ts). The session is ended properly first,
 * which lands them on the destination's Enter VR screen.
 *
 * Asking for the screen they are already on is treated as "do that again" —
 * the trainer pressed a game they were already in, which only means anything
 * if there is a Play or Play again on screen to press.
 */
async function goTo(ctx: RemoteContext, path: string): Promise<void> {
  if (ctx.route() === path && !ctx.currentSession()) {
    if (ctx.emit('play') > 0 || ctx.emit('restart') > 0) return
  }
  const session = ctx.currentSession()
  if (session) {
    await ctx.exitTo(session, path)
    return
  }
  ctx.navigate(path)
}

/** Which game a route belongs to, if any. */
export function currentGameId(route: string): GameId | null {
  return GAME_LIST.find((g) => g.path === route)?.id ?? null
}
