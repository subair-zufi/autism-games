/**
 * A durable queue for writes that must not be lost when the network is.
 *
 * The analytics client swallows every failed request so a dropped connection
 * can never interrupt a child mid-game. That is right for a step event, where
 * the next one is a few seconds behind — but wrong for a research record a
 * trainer has just spent three minutes filling in. BUDS sites have unreliable
 * Wi-Fi, and a session's user-experience record cannot be re-created after the
 * fact: the child has gone home.
 *
 * So writes routed through here are persisted first and sent afterwards. A
 * failure leaves the entry on disk to be retried when the connection returns,
 * on the next flush, or on the next app start.
 *
 * Entries are keyed, and a key is held at most once: re-queuing the same record
 * replaces the pending copy rather than stacking a second one. Combined with
 * endpoints that are idempotent for their scope, that makes a retry safe even
 * when the first attempt actually reached the server and only the reply was
 * lost.
 */

const QUEUE_KEY = 'ag_write_queue'
/** Enough for a long gap on site; beyond this the oldest entries are dropped
 *  rather than letting a broken flush fill the device's storage. */
const MAX_ENTRIES = 200

export interface QueuedWrite {
  /** Identity of the record, not of the attempt — re-queuing replaces. */
  key: string
  path: string
  body: unknown
  queuedAt: string
  attempts: number
}

/** Sends one entry. Resolves on success; rejects to leave it queued. */
export type SendFn = (path: string, body: unknown) => Promise<unknown>

function read(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as QueuedWrite[]) : []
  } catch {
    // Unreadable storage (private window, quota, corrupt JSON) must not stop
    // the caller writing — it degrades to "not queued", never to a crash.
    return []
  }
}

function write(entries: QueuedWrite[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)))
  } catch {
    /* storage unavailable or full — nothing useful to do here */
  }
}

/** Everything still waiting to be sent, oldest first. */
export function pending(): QueuedWrite[] {
  return read()
}

export function pendingCount(): number {
  return read().length
}

/** Queue a write, replacing any pending entry with the same key. */
export function enqueue(key: string, path: string, body: unknown): void {
  const entries = read().filter((e) => e.key !== key)
  entries.push({ key, path, body, queuedAt: new Date().toISOString(), attempts: 0 })
  write(entries)
}

export function clearQueue(): void {
  write([])
}

/**
 * Try to send everything queued, oldest first.
 *
 * Stops at the first failure and leaves that entry (and everything behind it)
 * queued: if the network is down, the second attempt will fail too, and the
 * order records were made in is worth keeping. Returns how many got through.
 */
export async function flush(send: SendFn): Promise<number> {
  let sent = 0
  for (;;) {
    const entries = read()
    if (entries.length === 0) return sent

    const entry = entries[0]
    try {
      await send(entry.path, entry.body)
    } catch {
      // Re-read rather than reusing `entries`: a write queued while this was
      // in flight would otherwise be overwritten by the stale copy.
      const current = read()
      const idx = current.findIndex((e) => e.key === entry.key)
      if (idx >= 0) {
        current[idx] = { ...current[idx], attempts: current[idx].attempts + 1 }
        write(current)
      }
      return sent
    }

    write(read().filter((e) => e.key !== entry.key))
    sent += 1
  }
}

/**
 * Run a flush now, and again whenever the browser says the connection is back.
 *
 * Takes the flush itself rather than a `SendFn` so the caller can pass the
 * client's own authenticated flush — handing this a function that *queues*
 * would put the entry straight back on the queue it is draining.
 *
 * Returns a teardown function. Safe to call more than once — each call
 * registers its own listener and removes only that one.
 */
export function flushOnReconnect(run: () => Promise<unknown>): () => void {
  const fire = () => {
    void run()
  }
  fire()
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', fire)
  return () => window.removeEventListener('online', fire)
}
