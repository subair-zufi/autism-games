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
/**
 * Enough for a long gap on site; beyond this the oldest entries are dropped
 * rather than letting a broken flush fill the device's storage.
 *
 * Sized for telemetry, not for the session records: a 20-minute game session
 * produces on the order of a hundred steps, so this holds roughly a full day of
 * play with no network at all. Overflow drops the oldest first, which can
 * orphan the steps of a session whose opening write has gone — those then fail
 * permanently on replay and are dropped in turn, rather than wedging the queue.
 */
const MAX_ENTRIES = 2000

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

/**
 * Says whether a rejection means "this will never work" rather than "not right
 * now".
 *
 * Without it one entry the server refuses — a step naming a session that was
 * dropped on overflow, say — is retried forever at the head of the queue and
 * every later record waits behind it. A permanent failure is dropped so the
 * rest can go; a transient one keeps its place.
 */
export type IsPermanent = (err: unknown) => boolean

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

/** Test seam: forget any in-progress flush. */
export function resetFlushState(): void {
  inFlight = null
  queuedDuringFlush = false
}

/** One pass over the queue. `blocked` means it stopped on a transient failure. */
async function drain(
  send: SendFn,
  isPermanent?: IsPermanent,
): Promise<{ sent: number; blocked: boolean }> {
  let sent = 0
  for (;;) {
    const entries = read()
    if (entries.length === 0) return { sent, blocked: false }

    const entry = entries[0]
    try {
      await send(entry.path, entry.body)
    } catch (err) {
      if (!isPermanent?.(err)) {
        // Re-read rather than reusing `entries`: a write queued while this was
        // in flight would otherwise be overwritten by the stale copy.
        const current = read()
        const idx = current.findIndex((e) => e.key === entry.key)
        if (idx >= 0) {
          current[idx] = { ...current[idx], attempts: current[idx].attempts + 1 }
          write(current)
        }
        return { sent, blocked: true }
      }
      // Permanently refused: drop it and keep going, so it cannot hold up
      // everything recorded after it.
      console.warn('[writeQueue] dropping a permanently refused write:', entry.path, err)
    }

    write(read().filter((e) => e.key !== entry.key))
    sent += 1
  }
}

/** A flush already running. Telemetry calls flush after every step, and two
 *  passes over one queue would send the same entry twice — and events, unlike
 *  the session record, are not idempotent. */
let inFlight: Promise<number> | null = null
/** Something was queued while a flush was running; go round again so it does
 *  not sit there until the next call. */
let queuedDuringFlush = false

/**
 * Try to send everything queued, oldest first.
 *
 * Stops at the first transient failure and leaves that entry (and everything
 * behind it) queued: if the network is down the next attempt will fail too, and
 * the order records were made in is worth keeping. Entries `isPermanent` marks
 * as refused for good are dropped instead, so they cannot block the queue.
 *
 * Concurrent calls join the flush already in progress rather than starting a
 * second pass over the same entries. Returns how many got through.
 */
export function flush(send: SendFn, isPermanent?: IsPermanent): Promise<number> {
  if (inFlight) {
    queuedDuringFlush = true
    return inFlight
  }

  const run = async (): Promise<number> => {
    let total = 0
    for (;;) {
      queuedDuringFlush = false
      const { sent, blocked } = await drain(send, isPermanent)
      total += sent
      if (blocked || !queuedDuringFlush) return total
    }
  }

  // The work is deferred by a microtask so `inFlight` is set before any `send`
  // can run. An async function body would instead run synchronously as far as
  // its first await — which is the send itself — so a flush triggered from
  // inside that send (recordStep queues and flushes on every step) would find
  // `inFlight` still null and start a second pass over the same entries,
  // posting them twice. Events are not idempotent; that would be duplicate data.
  const started = Promise.resolve().then(run)
  inFlight = started
  return started.finally(() => {
    inFlight = null
  })
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
