/**
 * The picture of the child's view that the trainer watches on their phone.
 *
 * The trainer's first job is not pressing buttons, it is coaching — "look a
 * bit to your left", "the picture is behind you" — and they cannot do that
 * blind. Casting the headset to a phone shows the same thing, but it needs the
 * Meta app, an account and a network the room may not have, and it dies the
 * moment the child takes the headset off and puts it back on. This is a few
 * hundred milliseconds of latency instead, over the same relay the controls
 * already use, and it costs nothing at all when nobody is watching: the flag
 * below is off until a console asks for it, and the capture in
 * `RemoteMirror.tsx` returns immediately while it is.
 *
 * Frames are small JPEGs. On a headset that is running a 360 scene at 72fps,
 * the budget matters far more than the picture does — the trainer needs to see
 * where the child is looking, not read text off it.
 */

/** Mirror resolution. 16:9 so it matches the shape of a phone held sideways. */
export const MIRROR_WIDTH = 384
export const MIRROR_HEIGHT = 216
/** JPEG quality — low enough to keep a frame near 20KB. */
export const MIRROR_QUALITY = 0.55
/** Default gap between frames. ~1.5fps: enough to follow a head turn. */
export const DEFAULT_MIRROR_INTERVAL_MS = 700
/** A mirror asked for but not fed for this long is reported as unavailable
 *  (a flat-screen game with no capture mounted, or a capture that is failing). */
const STALE_AFTER_MS = 4000

let wanted = false
let intervalMs = DEFAULT_MIRROR_INTERVAL_MS
let latest: string | null = null
let latestAt = 0
/** Set when the capture gives up (context loss, unsupported readback). */
let failure: string | null = null

/** Console asked for (or dropped) the mirror. */
export function setMirrorWanted(on: boolean, ms?: number): void {
  wanted = on
  if (ms && ms > 0) intervalMs = Math.max(200, Math.min(5000, ms))
  if (!on) {
    latest = null
    latestAt = 0
    failure = null
  }
}

export function isMirrorWanted(): boolean {
  return wanted
}

export function mirrorIntervalMs(): number {
  return intervalMs
}

/** Called by the capture with a freshly encoded frame. */
export function publishMirrorFrame(dataUrl: string, now = Date.now()): void {
  latest = dataUrl
  latestAt = now
  failure = null
}

/** Called by the capture when it cannot produce frames at all. */
export function reportMirrorFailure(reason: string): void {
  failure = reason
  latest = null
}

/**
 * The newest frame, if it has not been sent yet.
 *
 * Consuming it means an unchanged view costs one small state push instead of
 * re-uploading the same JPEG every second.
 */
export function takeMirrorFrame(): string | null {
  const frame = latest
  latest = null
  return frame
}

/** What to tell the console about the mirror. */
export function mirrorState(now = Date.now()): 'live' | 'off' | 'unavailable' {
  if (!wanted) return 'off'
  if (failure) return 'unavailable'
  return latestAt && now - latestAt <= STALE_AFTER_MS ? 'live' : 'unavailable'
}

/** Test seam. */
export function resetMirror(): void {
  wanted = false
  intervalMs = DEFAULT_MIRROR_INTERVAL_MS
  latest = null
  latestAt = 0
  failure = null
}

/** Whether enough time has passed to spend another capture. */
export function shouldCapture(now: number, lastAt: number, gapMs: number): boolean {
  return now - lastAt >= gapMs
}

/**
 * Flip an RGBA buffer top-to-bottom, in place.
 *
 * WebGL hands back pixels with the origin at the bottom left; a canvas expects
 * the top left. Without this the trainer is told to look left when the child
 * should look right — which is worse than no mirror at all.
 */
export function flipRowsInPlace(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4
  const row = new Uint8Array(stride)
  for (let y = 0; y < Math.floor(height / 2); y++) {
    const top = y * stride
    const bottom = (height - 1 - y) * stride
    row.set(pixels.subarray(top, top + stride))
    pixels.copyWithin(top, bottom, bottom + stride)
    pixels.set(row, bottom)
  }
  return pixels
}
