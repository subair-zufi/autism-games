import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Matches the `.celebrate` star-pop animation length in global.css. */
const STAR_MS = 1300

/**
 * A one-shot ⭐ "you got it!" pop, shown on the rising edge of `show`.
 *
 * Why this exists instead of a plain `{cond && <div className="celebrate">…}`:
 * the VR/360 games re-render every frame (head tracking), and their win cue is
 * often tied to a scene stage that lasts only a few hundred milliseconds (e.g.
 * the ball-travel window in Football/Roll-Back). Inline, that meant the star
 * either unmounted long before the 1.3s star-pop finished, or had its animation
 * restarted by sibling churn during the per-frame re-renders — so it never
 * actually appeared. This component fixes both:
 *
 *  - it *latches*: once `show` goes truthy it keeps the star up for the full
 *    animation regardless of how briefly the trigger condition held;
 *  - it renders through a portal to `document.body`, outside the game's
 *    frequently re-rendering subtree, so nothing restarts the CSS animation
 *    mid-flight.
 *
 * `key` is bumped on every rising edge so a fresh element restarts the
 * animation cleanly when the child answers correctly again within the window.
 */
export function WinStar({ show, emoji = '⭐' }: { show: boolean; emoji?: string }) {
  const [runKey, setRunKey] = useState(0)
  const [visible, setVisible] = useState(false)
  const prev = useRef(false)

  useEffect(() => {
    if (show && !prev.current) {
      setRunKey((k) => k + 1)
      setVisible(true)
    }
    prev.current = show
  }, [show])

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setVisible(false), STAR_MS)
    return () => clearTimeout(t)
  }, [visible, runKey])

  if (!visible || typeof document === 'undefined') return null
  return createPortal(
    <div className="celebrate" key={runKey}>
      {emoji}
    </div>,
    document.body,
  )
}
