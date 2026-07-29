import { useEffect, useMemo } from 'react'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'
import { useSettings } from '../state/settings'
import { t } from '../i18n/strings'

/**
 * In-world switch between the selection methods (gaze dwell / controller).
 *
 * Profile → Selection sets this too, but the page is invisible inside an
 * immersive session, so without this the only way to try the other method is
 * to take the headset off — impractical when you are sitting with a child
 * working out which one they can actually use, and worse across multiple
 * centres.
 *
 * Both buttons are ordinary `headSelect` targets, so whichever method is
 * currently active can operate them: a gaze dwells on them, and the controller
 * ray works in either mode since controllers stay live throughout. That
 * matters — the switch must never be unreachable from the mode you are trying
 * to leave.
 *
 * Placed by BEARING like `VRQuitButton`, and normally directly below it at the
 * same bearing, so both live in one "controls corner" already outside the
 * game's activity arc and neither can cover the game or its answers.
 */
export function VRInputSwitch({
  bearingDeg,
  radius = 3.6,
  height = 0.62,
}: {
  /** signed bearing from straight-ahead, degrees left(−)/right(+) — same value
   *  the game passes to `VRQuitButton` */
  bearingDeg: number
  /** distance from the child (metres) */
  radius?: number
  /** panel centre height (metres) — sits under the Quit button by default */
  height?: number
}) {
  const session = useXR((s) => s.session)
  const inputMethod = useSettings((s) => s.inputMethod)
  const setInputMethod = useSettings((s) => s.setInputMethod)
  const lang = useSettings((s) => s.language)

  if (!session) return null

  // bearing 0 = forward/−z; left(−)/right(+) — same convention as every game
  const rad = (bearingDeg * Math.PI) / 180
  const x = Math.sin(rad) * radius
  const z = -Math.cos(rad) * radius
  // turn the panel to face the child at the origin
  const rotY = Math.atan2(-x, -z)

  return (
    <group position={[x, height, z]} rotation={[0, rotY, 0]}>
      <SwitchButton
        label={t('vrInputGaze', lang)}
        active={inputMethod === 'dwell'}
        offsetX={-0.39}
        onPick={() => setInputMethod('dwell')}
      />
      <SwitchButton
        label={t('vrInputController', lang)}
        active={inputMethod === 'controller'}
        offsetX={0.39}
        onPick={() => setInputMethod('controller')}
      />
    </group>
  )
}

function SwitchButton({
  label,
  active,
  offsetX,
  onPick,
}: {
  label: string
  active: boolean
  offsetX: number
  onPick: () => void
}) {
  const texture = useMemo(() => buttonTexture(label, active), [label, active])
  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh
      position={[offsetX, 0, 0]}
      // reachable by whichever method is active, including the one being
      // switched away from
      userData={{ headSelect: true }}
      onClick={(e) => {
        e.stopPropagation()
        onPick()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <planeGeometry args={[0.72, 0.38]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

function buttonTexture(label: string, active: boolean): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 270
  const tex = new THREE.CanvasTexture(cv)
  const ctx = cv.getContext('2d')
  if (ctx == null) return tex
  ctx.clearRect(0, 0, cv.width, cv.height)
  ctx.beginPath()
  ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, 54)
  ctx.fillStyle = active ? 'rgba(37, 122, 205, 0.95)' : 'rgba(48, 56, 68, 0.86)'
  ctx.fill()
  // a lit border on the active one: colour alone is easy to miss on a headset
  // display, and this control has no other "you are here" cue
  ctx.lineWidth = active ? 12 : 5
  ctx.strokeStyle = active ? '#eaf4ff' : '#79839a'
  ctx.stroke()
  ctx.fillStyle = active ? '#ffffff' : '#c2cad8'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${active ? 82 : 74}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
  ctx.fillText(label, cv.width / 2, cv.height / 2)
  tex.needsUpdate = true
  return tex
}
