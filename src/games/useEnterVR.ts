import { useEffect, useRef, useState } from 'react'
import type { XRStore } from '@react-three/xr'

/**
 * Shared "press Enter VR" handling, used by both the small in-canvas
 * `EnterVRButton` and the full-screen `VRWaitingRoom`.
 *
 * Guards against a second `enterVR()` call landing while the first is still
 * in flight — the browser rejects the second one, the rejection was
 * unhandled, and the retry that felt necessary was the thing making it fail.
 * `pending` lets the caller hold the button disabled until the request
 * settles; a rejected request (declined headset permission, session
 * couldn't start) clears `pending` so a real retry is still one press away.
 */
export function useEnterVR(store: XRStore) {
  const [pending, setPending] = useState(false)
  // a session that starts unmounts nothing, but a failed one may resolve
  // after the caller has already navigated away
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  function enter() {
    if (pending) return
    setPending(true)
    void Promise.resolve(store.enterVR())
      .catch(() => {})
      .finally(() => { if (alive.current) setPending(false) })
  }

  return { pending, enter }
}
