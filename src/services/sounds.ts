import { useSettings } from '../state/settings'

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  return ctx
}

/**
 * Run `play` against a RUNNING context, resuming a suspended one first.
 *
 * A browser starts an AudioContext suspended until the page has been
 * interacted with, and suspends a running one again when audio output goes
 * away for a while — the headset going to sleep, the tab being backgrounded,
 * the child taking the Quest off between trials. A suspended context accepts
 * every call below without complaint and plays nothing, which is what "sound
 * is on but I hear nothing" looks like from the outside.
 *
 * Resuming is not enough on its own: `currentTime` is FROZEN while suspended,
 * so anything scheduled against it lands in the past the moment the context
 * catches up — the oscillator's envelope has already run to zero and the note
 * is silent. So the work is deferred until resume() settles and the clock is
 * moving again.
 */
function withRunningContext(play: (ac: AudioContext) => void) {
  const ac = audio()
  if (!ac) return
  if (ac.state === 'closed') return
  if (ac.state === 'running') {
    play(ac)
    return
  }
  let played = false
  const go = () => {
    if (played) return
    played = true
    play(ac)
  }
  // resume() rejects when the page has had no user gesture at all yet; play
  // anyway in that case, since a silent schedule is no worse than dropping it.
  try {
    void Promise.resolve(ac.resume()).then(go, go)
  } catch {
    go()
  }
}

/**
 * Soft sine tone; gentle attack/decay so nothing is ever startling.
 *
 * Two things keep this off the click's critical path, because every button in
 * the app plays a tap and the first one used to make the press feel ignored:
 *
 *  - `soundOn` is checked BEFORE the context is touched. It used to be checked
 *    after, so the first tap built an AudioContext even with sound switched off.
 *  - Building the context is deferred to a fresh task the first time round.
 *    Constructing one is not free — the browser opens an audio output stream,
 *    which on the Quest blocks long enough to be felt — and there is no reason
 *    for a navigation to wait on it. Every later tone is emitted inline; the
 *    context already exists by then.
 */
function tone(freq: number, startAt: number, duration: number, peak = 0.15) {
  if (!useSettings.getState().soundOn) return
  if (ctx == null) {
    setTimeout(() => emit(freq, startAt, duration, peak), 0)
    return
  }
  emit(freq, startAt, duration, peak)
}

function emit(freq: number, startAt: number, duration: number, peak: number) {
  withRunningContext((ac) => {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    const t = ac.currentTime + startAt
    osc.frequency.value = freq
    osc.type = 'sine'
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(peak, t + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + duration)
  })
}

export const playSuccess = () => { tone(523, 0, 0.25); tone(659, 0.12, 0.25); tone(784, 0.24, 0.35) }
export const playGentle = () => { tone(330, 0, 0.3, 0.08) }
export const playTap = () => { tone(440, 0, 0.08, 0.06) }

// --- Pre-recorded audio clips ------------------------------------------------
//
// Played through the SAME AudioContext as the tones above. That matters on VR
// headsets: the browser's speech synthesis (used for spoken prompts) ships no
// voices in Wolvic/standalone browsers, but WebAudio works — the success chime
// already proves it — so bundled clips are how spoken praise reaches the
// headset. Decoded buffers are cached; the first play of a cold clip loads then
// plays, later plays are instant.

const clipBuffers = new Map<string, AudioBuffer>()
// In-flight loads, keyed by url. Holding the PROMISE rather than a "busy" flag
// is what lets a play that lands mid-preload wait for that same decode instead
// of giving up: praise() warms all 24 clips and then immediately plays one of
// them, so with a flag the very first cheer of a session was always silent.
const clipLoading = new Map<string, Promise<AudioBuffer | null>>()

function loadClip(url: string): Promise<AudioBuffer | null> {
  const ac = audio()
  if (!ac) return Promise.resolve(null)
  const cached = clipBuffers.get(url)
  if (cached) return Promise.resolve(cached)
  const inFlight = clipLoading.get(url)
  if (inFlight) return inFlight
  const load = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const buf = await ac.decodeAudioData(await res.arrayBuffer())
      clipBuffers.set(url, buf)
      return buf
    } catch {
      return null
    } finally {
      clipLoading.delete(url)
    }
  })()
  clipLoading.set(url, load)
  return load
}

/** Warm the decoded-buffer cache so the first real play isn't silent. */
export function preloadClips(urls: readonly string[]) {
  if (typeof AudioContext === 'undefined') return
  for (const u of urls) void loadClip(u)
}

/** Play a bundled audio clip through the shared context. Caller gates on the
 *  relevant mute toggle (praise checks `voiceOn`), so this never checks it. */
export function playClip(url: string, volume = 1) {
  const cached = clipBuffers.get(url)
  if (cached) {
    startClip(cached, volume)
    return
  }
  void loadClip(url).then((b) => { if (b) startClip(b, volume) })
}

function startClip(buffer: AudioBuffer, volume: number) {
  withRunningContext((ac) => {
    const src = ac.createBufferSource()
    src.buffer = buffer
    const gain = ac.createGain()
    gain.gain.value = volume
    src.connect(gain).connect(ac.destination)
    src.start()
  })
}

/** Drop the shared context and every cached clip — tests only. */
export function resetSoundsForTest() {
  ctx = null
  clipBuffers.clear()
  clipLoading.clear()
}
