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
 * Drop one inside each game's `VRHud` (rendered only while `inSession`, same
 * as the score/prompt panels), at a position clear of that game's own HUD.
 */
export function VRQuitButton({
  position,
  label,
}: {
  position: [number, number, number]
  label: string
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

  return (
    <mesh
      position={position}
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
