import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * A TEACCH-style row of progress dots for the in-world VR HUD: one dot per
 * trial, filled as trials complete, the rest left as outlines. The flat
 * ScoreBar shows a `3 / 8` count; inside a headset only score and prompt were
 * mirrored, so "how many more?" — a predictability cue that matters
 * disproportionately for autistic children — was missing (review R8).
 *
 * Drawn to a CanvasTexture like the scenes' own TextPanels, so it needs no font
 * or image assets and sits in the same HUD group (it inherits the
 * eye-height offset from VRHudAnchor). Each game passes its own done / goal.
 */
export function VRProgressDots({
  done,
  goal,
  position,
  width = 2.6,
  height = 0.32,
  bg = 'rgba(22, 28, 30, 0.82)',
  fill = '#f4fbe9',
}: {
  /** completed trials (dots filled) */
  done: number
  /** total trials this session (dots in the row) */
  goal: number
  position: [number, number, number]
  width?: number
  height?: number
  /** the rounded backing colour (match the game's TextPanel for a cohesive HUD) */
  bg?: string
  /** dot colour */
  fill?: string
}) {
  const texture = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 1024
    cv.height = Math.round((1024 * height) / width)
    return new THREE.CanvasTexture(cv)
  }, [width, height])

  useEffect(() => {
    const cv = texture.image as HTMLCanvasElement
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    // a long session should never shrink the dots to invisibility; cap the row
    const n = Math.max(1, Math.min(Math.round(goal), 24))
    const filled = Math.max(0, Math.min(Math.round(done), n))

    // rounded backing pill, same style as the scenes' TextPanels
    const r = cv.height * 0.4
    ctx.beginPath()
    ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, r)
    ctx.fillStyle = bg
    ctx.fill()

    const cy = cv.height / 2
    const gap = cv.width / (n + 1)
    const dot = Math.min(gap * 0.32, cv.height * 0.3)
    for (let i = 0; i < n; i++) {
      const cx = gap * (i + 1)
      ctx.beginPath()
      ctx.arc(cx, cy, dot, 0, Math.PI * 2)
      if (i < filled) {
        ctx.fillStyle = fill
        ctx.fill()
      } else {
        ctx.lineWidth = Math.max(3, dot * 0.3)
        ctx.strokeStyle = 'rgba(244, 251, 233, 0.5)'
        ctx.stroke()
      }
    }
    texture.needsUpdate = true
  }, [done, goal, bg, fill, texture])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={position}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}
