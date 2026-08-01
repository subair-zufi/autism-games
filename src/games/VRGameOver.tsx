import { useEffect, useMemo } from 'react'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'
import { useVrGameOver } from './gameOverPanel'

/**
 * The end-of-round results, shown inside VR.
 *
 * The flat `GameOverDialog` cannot be seen from a headset, and the old answer —
 * end the session so the child is back on the page to read it — is exactly what
 * strands them: on this device any `XRSession.end()` costs the browser window
 * (see `gameOverPanel.ts`). So the score stays in-world, and "Play again" starts
 * another round without ever leaving VR.
 *
 * `Finish` is the one place the app still ends a session on purpose: once, when
 * the visit is over and the facilitator is expecting to take the headset off.
 *
 * Drop one inside each game's `<XR>`, next to `<HeadSelect>`.
 */

/** Distance from the child, metres — closer than the game's activity arc. */
const PANEL_RADIUS = 2.4
const PANEL_Y = 1.45

export function VRGameOver() {
  const session = useXR((s) => s.session)
  const info = useVrGameOver((s) => s.info)
  if (!session || info == null) return null
  return <Panel />
}

function Panel() {
  const session = useXR((s) => s.session)
  const info = useVrGameOver((s) => s.info)!
  const hide = useVrGameOver((s) => s.hide)

  const board = useMemo(
    () => resultsTexture(info.headline, info.scoreLine, info.bestLine, info.stars),
    [info.headline, info.scoreLine, info.bestLine, info.stars],
  )
  const again = useMemo(() => buttonTexture(info.playAgainLabel, true), [info.playAgainLabel])
  const finish = useMemo(() => buttonTexture(info.finishLabel, false), [info.finishLabel])

  useEffect(() => () => void board.dispose(), [board])
  useEffect(() => () => void again.dispose(), [again])
  useEffect(() => () => void finish.dispose(), [finish])

  return (
    <group position={[0, PANEL_Y, -PANEL_RADIUS]}>
      <mesh position={[0, 0.42, 0]}>
        <planeGeometry args={[2.0, 1.15]} />
        <meshBasicMaterial map={board} transparent />
      </mesh>

      <Button
        texture={again}
        x={-0.52}
        onPick={() => {
          hide()
          info.onRestart()
        }}
      />
      <Button
        texture={finish}
        x={0.52}
        onPick={() => {
          hide()
          // the single deliberate exit — the visit is over
          void session?.end()
        }}
      />
    </group>
  )
}

function Button({ texture, x, onPick }: { texture: THREE.Texture; x: number; onPick: () => void }) {
  return (
    <mesh
      position={[x, -0.34, 0.01]}
      userData={{ headSelect: true }}
      onClick={(e) => {
        e.stopPropagation()
        onPick()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <planeGeometry args={[0.92, 0.34]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

/** Canvas-drawn text, same approach as every other in-world panel — no font
 *  assets, and the browser's own fonts cover Malayalam. */
function resultsTexture(
  headline: string,
  scoreLine: string,
  bestLine: string,
  stars?: number,
): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 590
  const tex = new THREE.CanvasTexture(cv)
  const ctx = cv.getContext('2d')
  if (ctx == null) return tex

  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.beginPath()
  ctx.roundRect(8, 8, cv.width - 16, cv.height - 16, 44)
  ctx.fillStyle = 'rgba(30, 41, 56, 0.92)'
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = '#7fb2e8'
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const font = (px: number) => `bold ${px}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`

  ctx.fillStyle = '#ffffff'
  ctx.font = font(72)
  ctx.fillText(headline, cv.width / 2, 130)

  if (stars !== undefined) {
    ctx.font = font(84)
    ctx.fillText('⭐'.repeat(Math.max(1, Math.min(3, stars))), cv.width / 2, 250)
  }

  ctx.fillStyle = '#ffe08a'
  ctx.font = font(74)
  ctx.fillText(scoreLine, cv.width / 2, stars === undefined ? 290 : 385)

  ctx.fillStyle = '#b9c8dc'
  ctx.font = font(50)
  ctx.fillText(bestLine, cv.width / 2, stars === undefined ? 400 : 480)

  tex.needsUpdate = true
  return tex
}

function buttonTexture(label: string, primary: boolean): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 190
  const tex = new THREE.CanvasTexture(cv)
  const ctx = cv.getContext('2d')
  if (ctx == null) return tex

  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.beginPath()
  ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, 52)
  ctx.fillStyle = primary ? 'rgba(46, 160, 100, 0.96)' : 'rgba(74, 82, 96, 0.94)'
  ctx.fill()
  ctx.lineWidth = 7
  ctx.strokeStyle = primary ? '#eafff2' : '#9aa3b4'
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = 'bold 66px "Comic Sans MS", "Noto Sans Malayalam", sans-serif'
  ctx.fillText(label, cv.width / 2, cv.height / 2)

  tex.needsUpdate = true
  return tex
}
