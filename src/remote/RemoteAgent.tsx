import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { GAME_LIST } from '../types'
import { useSettings } from '../state/settings'
import { useAuth } from '../state/auth'
import { useRemoteLink } from '../state/remote'
import { currentXrSession, isXrPresenting } from '../services/xrPresence'
import { exitVrTo } from '../games/exitVr'
import { RemoteError, remoteApi } from './client'
import { applyRemoteCommand, currentGameId, type RemoteContext } from './commands'
import { emitRemoteIntent } from './intents'
import { setMirrorWanted, mirrorState, takeMirrorFrame } from './mirror'
import { parseCommand, REMOTE_PROTOCOL_VERSION, type RemoteStatus } from './protocol'
import { readGameReport } from './status'

/** How long a command poll parks on the relay before coming back empty. */
const COMMAND_WAIT_SECONDS = 20
/** How often the headset reports what the child is doing, while a trainer is
 *  watching — and while nobody is, when the report only has to be fresh enough
 *  that a console joining mid-session sees the truth within a few seconds. */
const STATE_INTERVAL_MS = 1000
const IDLE_STATE_INTERVAL_MS = 4000
/** Backoff after a failed call, so a headset that lost Wi-Fi is not hammering. */
const RETRY_MS = 2000
/**
 * Floor under the command poll.
 *
 * The relay parks a poll for `COMMAND_WAIT_SECONDS`, so in normal service this
 * never applies. It is here for the server that does not: an older build, or a
 * proxy that cuts long-polls short, would otherwise have the headset pulling in
 * a tight loop — flattening the battery of the device on a child's head.
 */
const MIN_POLL_GAP_MS = 500
/**
 * A command older than this is read but not carried out.
 *
 * A headset that was asleep, offline or reloading must not come back and act on
 * a pile of instructions from several minutes ago — sending a child into a game
 * the trainer asked for long before, or quitting one they are happily playing.
 * The age is measured by the relay, so it does not depend on the headset's
 * clock being right.
 */
const STALE_COMMAND_MS = 60_000

/**
 * The headset half of the remote control: pulls the trainer's commands and
 * pushes back what the child is on.
 *
 * Mounted once, above the routes, so it keeps running across every game — and
 * so it survives what it is most needed for, a child sitting inside a game
 * with no idea how to leave it.
 *
 * Renders nothing and does nothing at all unless this device was paired as the
 * headset, which is a deliberate property: the trainer's phone runs the very
 * same app.
 */
export function RemoteAgent() {
  const role = useRemoteLink((s) => s.role)
  const code = useRemoteLink((s) => s.code)
  const navigate = useNavigate()

  /**
   * `navigate` is held in a ref, and deliberately NOT in the effect's
   * dependencies.
   *
   * react-router rebuilds it on every route change (the current pathname is one
   * of its own dependencies), so listing it restarted this whole effect each
   * time anyone navigated — including the trainer's own commands, and including
   * anyone pressing a button on the headset. A restarted listener began again
   * from sequence zero and was handed the trainer's earlier commands a second
   * time, so pressing Home on the headset threw the child straight back into
   * the last game the phone had opened. That is why the headset felt locked.
   */
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  useEffect(() => {
    if (role !== 'headset' || !code) return

    let stopped = false
    const abort = new AbortController()

    const ctx: RemoteContext = {
      // Read the route off the URL rather than subscribing to the router: a
      // re-render on every navigation would restart this effect and drop the
      // parked long-poll — a Quit press lost on every screen change.
      route: () => window.location.hash.replace(/^#/, '').split('?')[0] || '/',
      navigate: (path) => navigateRef.current(path),
      currentSession: () => (isXrPresenting() ? currentXrSession() : null),
      exitTo: exitVrTo,
      setDifficulty: (game, level) => useSettings.getState().setDifficulty(game, level),
      applySettings: (patch) => {
        const s = useSettings.getState()
        if (patch.voiceOn !== undefined) s.setVoiceOn(patch.voiceOn)
        if (patch.soundOn !== undefined) s.setSoundOn(patch.soundOn)
        if (patch.language !== undefined) s.setLanguage(patch.language)
        if (patch.inputMethod !== undefined) s.setInputMethod(patch.inputMethod)
        if (patch.playMode !== undefined) s.setPlayMode(patch.playMode)
      },
      setStudent: (studentId) => {
        const auth = useAuth.getState()
        auth.switchStudent(studentId)
        // A participant the trainer just added on their phone is not in this
        // device's list yet. Recording works either way — it is the id that is
        // stored — but without this the console would be told the session is
        // running against nobody in particular.
        if (studentId && !auth.students.some((s) => s.id === studentId)) {
          void auth.loadStudents().catch(() => {})
        }
      },
      emit: emitRemoteIntent,
      setMirror: (on, intervalMs) => setMirrorWanted(on, intervalMs),
    }

    async function commandLoop(): Promise<void> {
      // Resume where this device left off. Starting from zero would replay the
      // whole room's history after any reload — a service-worker update, or the
      // headset browser reclaiming the tab — and the child would be dragged
      // back through every game the trainer had opened that session.
      let after = useRemoteLink.getState().ackSeq
      while (!stopped) {
        const startedAt = Date.now()
        try {
          const res = await remoteApi.pullCommands(code!, after, COMMAND_WAIT_SECONDS, abort.signal)
          if (stopped) return
          useRemoteLink.getState().markLive(res.console_online)
          // A console that stopped watching should not leave the headset
          // paying for mirror frames nobody sees.
          if (!res.console_online) setMirrorWanted(false)
          for (const envelope of res.commands) {
            const cmd = parseCommand(envelope)
            if (!cmd) continue
            if ((envelope.age_ms ?? 0) > STALE_COMMAND_MS) continue
            await applyRemoteCommand(cmd, ctx)
          }
          after = res.last_seq
          // Remembered across reloads, so nothing is ever carried out twice.
          useRemoteLink.getState().setAck(after)
        } catch (err) {
          if (stopped || isAbort(err)) return
          if (err instanceof RemoteError && err.isGone) {
            void useRemoteLink.getState().stop()
            return
          }
          useRemoteLink.getState().markError(errorText(err))
          await sleep(RETRY_MS)
          continue
        }
        const spent = Date.now() - startedAt
        if (spent < MIN_POLL_GAP_MS) await sleep(MIN_POLL_GAP_MS - spent)
      }
    }

    async function stateLoop(): Promise<void> {
      while (!stopped) {
        try {
          await remoteApi.pushState(code!, buildStatus(), takeMirrorFrame(), abort.signal)
        } catch (err) {
          if (stopped || isAbort(err)) return
          if (err instanceof RemoteError && err.isGone) {
            void useRemoteLink.getState().stop()
            return
          }
          // The command loop reports connection trouble; this one just keeps
          // trying, so a dropped state push never costs the trainer a control.
        }
        await sleep(
          useRemoteLink.getState().peerOnline ? STATE_INTERVAL_MS : IDLE_STATE_INTERVAL_MS,
        )
      }
    }

    void commandLoop()
    void stateLoop()

    return () => {
      stopped = true
      abort.abort()
    }
    // NOT `navigate` — see navigateRef above. Restarting this effect on every
    // route change is exactly the bug that made the headset unusable by hand.
  }, [role, code])

  // Pairing is a mentor feature: signing out has to end it, or the next person
  // to use this headset inherits somebody else's remote.
  const isLoggedIn = useAuth((s) => s.isLoggedIn)
  useEffect(() => {
    if (!isLoggedIn && useRemoteLink.getState().role !== 'off') void useRemoteLink.getState().stop()
  }, [isLoggedIn])

  return null
}

/** Everything the trainer's phone shows about the child's screen. */
export function buildStatus(): RemoteStatus {
  const route = window.location.hash.replace(/^#/, '').split('?')[0] || '/'
  const gameId = currentGameId(route)
  const game = gameId ? GAME_LIST.find((g) => g.id === gameId) ?? null : null
  const settings = useSettings.getState()
  const auth = useAuth.getState()
  const report = readGameReport()
  const student = auth.students.find((s) => s.id === auth.activeStudentId) ?? null

  return {
    v: REMOTE_PROTOCOL_VERSION,
    route,
    gameId,
    gameTitle: game?.title ?? null,
    level: gameId ? settings.difficulty[gameId] ?? null : null,
    phase: report.phase ?? (gameId ? 'start' : 'menu'),
    vrActive: isXrPresenting(),
    score: report.score ?? null,
    progress: report.progress ?? null,
    prompt: report.prompt ?? null,
    settings: {
      voiceOn: settings.voiceOn,
      soundOn: settings.soundOn,
      language: settings.language,
      inputMethod: settings.inputMethod,
      playMode: settings.playMode,
    },
    studentId: auth.activeStudentId,
    studentName: student?.full_name ?? null,
    mirror: mirrorState(),
    at: Date.now(),
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAbort(err: unknown): boolean {
  return (err as Error)?.name === 'AbortError'
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : 'Connection lost.'
}
