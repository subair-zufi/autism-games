import { useEffect, useMemo } from 'react'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'

/**
 * In-world "Quit" control for immersive VR sessions.
 *
 * The DOM (the "Enter VR" button, the ScoreBar's Home link, GameOverDialog)
 * is invisible once inside a headset — WebXR's dom-overlay feature only works
 * in handheld AR, not immersive-vr — and every game's *only* other way to end
 * a session is reaching the "over" phase at the end of a round. A child who
 * never gets there (idles mid-round, or just wants out) previously had no way
 * to leave VR at all (review V3). Ending the session here drops back to the
 * flat page exactly where the game left off, so the existing Home
 * link/GameOverDialog take over from there — this button only ever leaves
 * the headset, it never resets or skips the game itself.
 *
 * Placed by BEARING, not raw coordinates: each game passes a `bearingDeg` just
 * outside its own left-most interactive element (boards / cards / players /
 * discoveries), so the button sits right at the edge of that game's activity
 * arc — a small glance left to reach — and can never overlap or hide the game
 * or its answer options. It rides low and turns to face the child. Drop one
 * inside each game's `VRHud` (rendered only while `inSession`).
 */
export function VRQuitButton({
  bearingDeg,
  label,
  radius = 3.6,
  height = 1.2,
}: {
  /** signed bearing from straight-ahead, degrees left(−)/right(+) — put it just
   *  outside the game's own left activity edge */
  bearingDeg: number
  label: string
  /** distance from the child (metres) */
  radius?: number
  /** panel centre height (metres) */
  height?: number
}) {
  const session = useXR((s) => s.session)

  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 640
    cv.height = 260
    return new THREE.CanvasTexture(cv)
  }, [])

  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    const r = cv.height * 0.35
    ctx.beginPath()
    ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, r)
    ctx.fillStyle = 'rgba(120, 33, 33, 0.88)'
    ctx.fill()
    ctx.fillStyle = '#fff6f0'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = 'bold 92px "Comic Sans MS", "Noto Sans Malayalam", sans-serif'
    ctx.fillText(`🚪 ${label}`, cv.width / 2, cv.height / 2)
    texture.needsUpdate = true
  }, [label, texture])

  useEffect(() => () => texture.dispose(), [texture])

  if (!session) return null

  // bearing 0 = forward/−z; left(−)/right(+) — same convention as every game
  const rad = (bearingDeg * Math.PI) / 180
  const x = Math.sin(rad) * radius
  const z = -Math.cos(rad) * radius
  // turn the panel to face the child at the origin (its −z default would sit
  // edge-on at an off-centre bearing)
  const rotY = Math.atan2(-x, -z)

  return (
    <mesh
      position={[x, height, z]}
      rotation={[0, rotY, 0]}
      onClick={(e) => {
        e.stopPropagation()
        void session.end()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <planeGeometry args={[1.6, 0.65]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}
