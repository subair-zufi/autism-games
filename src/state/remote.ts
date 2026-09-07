import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RemoteError, remoteApi } from '../remote/client'
import { setMirrorWanted } from '../remote/mirror'

/**
 * Which end of the remote control this device is.
 *
 * Persisted, because both ends have to survive a reload: the headset reloads
 * itself whenever the service worker picks up a new build, and a phone screen
 * that locks and wakes must come back still holding the session rather than
 * asking a trainer mid-session to find the pairing code again.
 */
export type RemoteRole = 'off' | 'headset' | 'console'

export type RemoteStatusKind = 'idle' | 'connecting' | 'live' | 'error'

interface RemoteLinkState {
  role: RemoteRole
  code: string | null
  status: RemoteStatusKind
  error: string | null
  /** Headset: a console is watching. Console: the headset is calling in. */
  peerOnline: boolean
  /** Headset: register a pairing and start listening. */
  startHeadset: () => Promise<boolean>
  /** Console: attach to the code shown on the headset. */
  joinAsConsole: (code: string) => Promise<boolean>
  /** Drop the pairing on this device (and on the relay, if asked). */
  stop: (opts?: { closeRoom?: boolean }) => Promise<void>
  /** Internal: called by the agent/console loops. */
  markLive: (peerOnline: boolean) => void
  markError: (message: string) => void
}

export const useRemoteLink = create<RemoteLinkState>()(
  persist(
    (set, get) => ({
      role: 'off',
      code: null,
      status: 'idle',
      error: null,
      peerOnline: false,

      startHeadset: async () => {
        set({ status: 'connecting', error: null })
        try {
          const room = await remoteApi.openRoom()
          set({ role: 'headset', code: room.code, status: 'live', error: null, peerOnline: false })
          return true
        } catch (err) {
          set({ status: 'error', error: message(err), role: 'off', code: null })
          return false
        }
      },

      joinAsConsole: async (code) => {
        set({ status: 'connecting', error: null })
        try {
          const room = await remoteApi.join(code)
          set({ role: 'console', code: room.code, status: 'live', error: null, peerOnline: false })
          return true
        } catch (err) {
          set({ status: 'error', error: message(err), role: 'off', code: null })
          return false
        }
      },

      stop: async ({ closeRoom = false } = {}) => {
        const { code } = get()
        set({ role: 'off', code: null, status: 'idle', error: null, peerOnline: false })
        setMirrorWanted(false)
        if (closeRoom && code) {
          // Best effort: the pairing expires on its own, and a trainer who
          // pressed "stop" must not be shown an error about tidying up.
          try {
            await remoteApi.close(code)
          } catch {
            /* ignore */
          }
        }
      },

      markLive: (peerOnline) => {
        const s = get()
        if (s.status === 'live' && s.peerOnline === peerOnline && !s.error) return
        set({ status: 'live', error: null, peerOnline })
      },

      markError: (msg) => set({ status: 'error', error: msg }),
    }),
    {
      name: 'autism-remote-link',
      // Only the pairing itself is worth restoring; connection state is
      // whatever the next poll says it is.
      partialize: (s) => ({ role: s.role, code: s.code }),
    },
  ),
)

function message(err: unknown): string {
  if (err instanceof RemoteError) {
    if (err.isGone) return 'That code is not paired to anything (it may have expired).'
    if (err.status === 401) return 'Sign in with your mentor account on this device first.'
    if (err.status === 0) return 'Cannot reach the server. Check the relay address and the network.'
  }
  return err instanceof Error ? err.message : 'Something went wrong.'
}
