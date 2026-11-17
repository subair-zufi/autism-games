import { useSettings } from '../state/settings'

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  return ctx
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
  // nothing to schedule at silence, and it saves building the context
  if (useSettings.getState().volume <= 0) return
  if (ctx == null) {
    setTimeout(() => emit(freq, startAt, duration, peak), 0)
    return
  }
  emit(freq, startAt, duration, peak)
}

function emit(freq: number, startAt: number, duration: number, peak: number) {
  const ac = audio()
  if (!ac) return
  // Read the level here rather than at the call site: every tone in the app
  // passes through this one function, so this is the single place the master
  // volume has to be applied (review D1). Deferred tones re-read it, which is
  // what a trainer turning the level down mid-session should get.
  const vol = useSettings.getState().volume
  if (vol <= 0) return
  peak *= vol
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
const clipLoading = new Set<string>()

async function loadClip(url: string): Promise<AudioBuffer | null> {
  const ac = audio()
  if (!ac) return null
  const cached = clipBuffers.get(url)
  if (cached) return cached
  if (clipLoading.has(url)) return null
  clipLoading.add(url)
  try {
    const res = await fetch(url)
    const buf = await ac.decodeAudioData(await res.arrayBuffer())
    clipBuffers.set(url, buf)
    return buf
  } catch {
    return null
  } finally {
    clipLoading.delete(url)
  }
}

/** Warm the decoded-buffer cache so the first real play isn't silent. */
export function preloadClips(urls: readonly string[]) {
  if (typeof AudioContext === 'undefined') return
  for (const u of urls) void loadClip(u)
}

/** Play a bundled audio clip through the shared context. Caller gates on the
 *  relevant mute toggle (praise checks `voiceOn`), so this never checks it —
 *  but the master level applies to everything the child hears, so it is
 *  applied here. */
export function playClip(url: string, volume = 1) {
  const ac = audio()
  if (!ac) return
  const master = useSettings.getState().volume
  if (master <= 0) return
  volume *= master
  if (ac.state === 'suspended') void ac.resume()
  const start = (b: AudioBuffer) => {
    const src = ac.createBufferSource()
    src.buffer = b
    const gain = ac.createGain()
    gain.gain.value = volume
    src.connect(gain).connect(ac.destination)
    src.start()
  }
  const cached = clipBuffers.get(url)
  if (cached) start(cached)
  else void loadClip(url).then((b) => b && start(b))
}
