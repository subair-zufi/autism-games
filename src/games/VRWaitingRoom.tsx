import type { XRStore } from '@react-three/xr'
import { t, type Lang } from '../i18n/strings'
import { useEnterVR } from './useEnterVR'
import { useRemoteReport } from '../remote/status'

/**
 * Shown on top of a 360 game, from the moment "Play" is pressed on a
 * headset-capable browser until the child is actually inside the VR session.
 *
 * Before this existed, "Play" started the round immediately on the flat
 * pre-VR screen — the helper animated and settled on its cue, spoken prompts
 * played, round timers started — all before the child had the headset on,
 * because nothing gated the game on the session actually starting. Enter VR
 * just sat on top of a game that was already running underneath it, which is
 * exactly backwards: the button should be what starts the game, not a
 * shortcut into a game already in progress. This screen holds the *round*
 * back (the caller must not call its own `start()` until the session is live
 * — see the `awaitingVr` gate in each `*Game.tsx`) so Enter VR is genuinely
 * the start button.
 *
 * It renders as an opaque full-screen overlay ON TOP OF the game's own
 * canvas — not in place of it. `store.enterVR()` needs a mounted `<XR>`
 * inside a live `<Canvas>` to bind to (that's how @pmndrs/xr learns which
 * WebGLRenderer to hand the session to); a session started against no
 * renderer at all just rejects with "not connected to three.js", which is
 * why the earlier version of this screen — which replaced the whole game
 * page, canvas included — made Enter VR silently do nothing. The canvas
 * underneath sits idle (its round not yet started) until this overlay is
 * removed once the session goes live.
 */
export function VRWaitingRoom({
  store,
  label,
  accent,
  lang,
}: {
  store: XRStore
  /** Already-localized "Enter VR" text for this game. */
  label: string
  /** The game's own accent colour, as a CSS background value. */
  accent: string
  lang: Lang
}) {
  const { pending, enter } = useEnterVR(store)
  // Tells the trainer's phone that the session is waiting on the one press
  // only the headset can supply — the moment they need to prompt the child.
  useRemoteReport({ phase: 'enterVr' })
  return (
    // The whole screen is the button. Starting a session needs a real press on
    // this device — WebXR will not hand one out without user activation, so the
    // trainer's remote cannot do it from their phone — and after a remote game
    // switch this screen is the one thing standing between the child and the
    // next game. Making the target the entire panel means any trigger press
    // aimed anywhere at it gets them in, rather than asking a child who
    // struggles to choose to also hit a button.
    <div
      className="vr-waiting-overlay start-screen"
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => {
        if (!pending) enter()
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !pending) enter()
      }}
    >
      <div className="start-icon">🥽</div>
      <h1>{t('vrGetReadyTitle', lang)}</h1>
      <span className="start-choose">{t('vrGetReadyHint', lang)}</span>
      <button
        className="big-btn"
        onClick={(e) => {
          // the overlay handles it; don't let the click count twice
          e.stopPropagation()
          enter()
        }}
        disabled={pending}
        style={{ background: accent, opacity: pending ? 0.7 : 1, cursor: pending ? 'progress' : 'pointer' }}
      >
        🥽 {pending ? t('vrEnterPending', lang) : label}
      </button>
    </div>
  )
}
