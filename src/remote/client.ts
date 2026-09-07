/**
 * HTTP client for the pairing relay (`server/app/routers/remote.py`).
 *
 * Separate from `services/analytics.ts` for one reason: the relay address is
 * changeable on the device. A build points at the deployed API, but a therapy
 * room with no internet can run the same server on a laptop on its own Wi-Fi
 * and point both devices at it — which has to be doable on a headset, at the
 * start of a session, without rebuilding anything. The mentor token is shared
 * with the analytics client, so pairing needs no second login.
 */
import { DEFAULT_API_BASE, analytics } from '../services/analytics'
import type { RemoteEnvelope, RemoteStatus } from './protocol'

const RELAY_BASE_KEY = 'ag_remote_relay'

/** The relay this device talks to: the operator's override, else the build's API. */
export function relayBase(): string {
  try {
    return localStorage.getItem(RELAY_BASE_KEY)?.trim() || DEFAULT_API_BASE
  } catch {
    return DEFAULT_API_BASE
  }
}

/** Point this device at another relay (trailing slashes trimmed), or clear it. */
export function setRelayBase(url: string | null): void {
  try {
    const clean = (url ?? '').trim().replace(/\/+$/, '')
    if (clean) localStorage.setItem(RELAY_BASE_KEY, clean)
    else localStorage.removeItem(RELAY_BASE_KEY)
  } catch {
    /* private mode / storage disabled — the build default still works */
  }
}

export class RemoteError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the request never reached the relay. */
    readonly status: number,
  ) {
    super(message)
    this.name = 'RemoteError'
  }

  /** The pairing is gone (expired, closed, or never existed on this relay). */
  get isGone(): boolean {
    return this.status === 404
  }
}

async function call<T>(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const token = analytics.authToken
  if (!token) throw new RemoteError('Sign in on this device first.', 401)

  let res: Response
  try {
    res = await fetch(relayBase() + path, {
      ...init,
      signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
      },
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    throw new RemoteError('Cannot reach the relay.', 0)
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail
    } catch {
      /* keep the generic message */
    }
    throw new RemoteError(detail, res.status)
  }
  return (res.status === 204 ? null : await res.json()) as T
}

export interface RoomInfo {
  code: string
  expires_in: number
  state?: Partial<RemoteStatus>
  state_rev?: number
  last_seq?: number
}

export interface StateSnapshot {
  state: Partial<RemoteStatus>
  state_rev: number
  frame: string | null
  frame_rev: number
  headset_online: boolean
  last_seq: number
}

export const remoteApi = {
  /** Headset: register a pairing and get the code to show. */
  openRoom: () => call<RoomInfo>('/api/remote/rooms', { method: 'POST' }),

  /** Console: attach to a code the trainer typed. */
  join: (code: string) => call<RoomInfo>(`/api/remote/rooms/${encode(code)}/join`, { method: 'POST' }),

  /** Either end: drop the pairing. */
  close: (code: string) => call<null>(`/api/remote/rooms/${encode(code)}`, { method: 'DELETE' }),

  /** Console: queue one instruction. */
  pushCommand: (code: string, type: string, payload: Record<string, unknown> = {}) =>
    call<RemoteEnvelope>(`/api/remote/rooms/${encode(code)}/commands`, {
      method: 'POST',
      body: JSON.stringify({ type, payload }),
    }),

  /** Headset: everything queued since `after`, parking up to `waitSeconds`. */
  pullCommands: (code: string, after: number, waitSeconds: number, signal?: AbortSignal) =>
    call<{ commands: RemoteEnvelope[]; last_seq: number; console_online: boolean }>(
      `/api/remote/rooms/${encode(code)}/commands?after=${after}&wait=${waitSeconds}`,
      { method: 'GET' },
      signal,
    ),

  /** Headset: publish what it is showing, plus an optional mirror frame. */
  pushState: (code: string, state: RemoteStatus, frame: string | null, signal?: AbortSignal) =>
    call<StateSnapshot>(
      `/api/remote/rooms/${encode(code)}/state`,
      { method: 'POST', body: JSON.stringify({ state, frame }) },
      signal,
    ),

  /** Console: the headset's state, parking until it changes. */
  pullState: (
    code: string,
    after: number,
    waitSeconds: number,
    wantFrame: boolean,
    signal?: AbortSignal,
  ) =>
    call<StateSnapshot>(
      `/api/remote/rooms/${encode(code)}/state?after=${after}&wait=${waitSeconds}&frame=${wantFrame}`,
      { method: 'GET' },
      signal,
    ),
}

function encode(code: string): string {
  return encodeURIComponent(code.trim().toUpperCase())
}
