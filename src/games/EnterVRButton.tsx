import type { XRStore } from '@react-three/xr'
import { useSettings } from '../state/settings'
import { t } from '../i18n/strings'
import { useEnterVR } from './useEnterVR'

/**
 * The "Enter VR" control every 360 game overlays on its flat-screen canvas.
 *
 * It used to be copy-pasted into each game as a bare
 * `onClick={() => store.enterVR()}` button, which had two problems on a
 * headset, both of which read to the facilitator as "the button doesn't work":
 *
 *  1. Nothing about the button changed when it was pressed. Handing a session
 *     over takes the headset a moment, and for that moment the screen looked
 *     exactly as it had before — so the natural response was to press again.
 *  2. Pressing again fired a second `requestSession` while the first was still
 *     in flight. The browser rejects the second one, the rejection was
 *     unhandled, and the retry that felt necessary was the thing making it
 *     fail. The button now holds itself disabled until the request settles.
 *
 * A rejected request (the child declined the headset permission prompt, or the
 * session could not start) puts the button straight back to normal, so a real
 * retry is still one press away.
 *
 * The click handling itself lives in `useEnterVR`, shared with `VRWaitingRoom`
 * — the full-screen prompt shown in place of the game until the session is
 * actually live (see that file for why the game no longer starts here).
 */
export function EnterVRButton({
  store,
  label,
  accent,
}: {
  store: XRStore
  /** Already-localized "Enter VR" text for this game. */
  label: string
  /** The game's own accent colour, as a CSS background value. */
  accent: string
}) {
  const { pending, enter } = useEnterVR(store)
  const lang = useSettings((s) => s.language)

  return (
    <button
      onClick={enter}
      disabled={pending}
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        padding: '10px 16px',
        borderRadius: 22,
        border: 'none',
        background: accent,
        color: '#fff',
        fontWeight: 700,
        fontSize: '1rem',
        cursor: pending ? 'progress' : 'pointer',
        // acknowledge the press on the compositor, so it shows even while the
        // main thread is busy tearing down the flat view and starting a session
        opacity: pending ? 0.7 : 1,
        transition: 'opacity 0.1s ease, transform 0.1s ease',
        touchAction: 'manipulation',
      }}
    >
      🥽 {pending ? t('vrEnterPending', lang) : label}
    </button>
  )
}
