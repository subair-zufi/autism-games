import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useRayPointer, useXR, useXRStore } from '@react-three/xr'
import * as THREE from 'three'
import { useSettings } from '../state/settings'
import { t } from '../i18n/strings'
import { applyInputMethod } from './xrInput'
import {
  DWELL_MS,
  advanceAim,
  createAimState,
  findSelectTarget,
  isPadObject,
  pokeAim,
  type AimResult,
} from './headAim'

/**
 * Controller-free selection for the 360 games — the scene half.
 *
 * Drop one inside each game's `<XR>`, next to `<HeadSampler>`. It does nothing
 * outside an immersive session: on a flat screen the mouse already works and a
 * head reticle would only get in the way.
 *
 * Aiming is the same for both input methods — a ray straight out of the head,
 * with a reticle where it lands — because a controller is exactly what we are
 * trying to avoid and a bare-hand ray needs a pinch, which is the fine-motor
 * gesture children fumble. Only the confirm differs: a dwell timer, or a poke
 * of the pad that floats within reach. Targets opt in with
 * `userData={{ headSelect: true }}`; a selection re-emits as a normal click on
 * whatever the ray hit, so every game's existing `onClick` handlers work
 * untouched.
 */

/** Reticle size as a fraction of its distance — keeps it ~2.5° wide at any range. */
const RETICLE_ANGULAR = 0.045
/** Theta segments in the dwell arc; also the resolution of its fill. */
const ARC_SEGMENTS = 48

/** Pad distance forward of the child, metres — comfortably inside arm's reach. */
const PAD_DISTANCE = 0.45
/** How far below eye level the pad sits — chest height, out of the sight line. */
const PAD_DROP = 0.34
/** Pad face tilt, radians — angled up toward the child like a real button box. */
const PAD_TILT = 0.62
/**
 * The pad follows the head lazily rather than rigidly: it only starts turning
 * once the child has looked more than this far off it, then eases into place.
 * A rigidly head-locked pad slides away from the hand that is reaching for it.
 */
const PAD_DEADZONE_RAD = (28 * Math.PI) / 180
const PAD_FOLLOW_PER_S = 3.2

const ARMED_COLOR = '#ffd95e'
const PROGRESS_COLOR = '#5ce08a'
const IDLE_COLOR = '#ffffff'

function shortestAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

export function HeadSelect() {
  // Configuring hands from here rather than in each game's `xrStore.ts` means
  // a scene gets the whole feature by mounting this one component, and the
  // config re-applies if Profile → Selection changes between sessions.
  const store = useXRStore()
  const inputMethod = useSettings((s) => s.inputMethod)
  useEffect(() => applyInputMethod(store, inputMethod), [store, inputMethod])

  const session = useXR((s) => s.session)
  // Rendering the pointer/reticle only inside a session keeps the flat-screen
  // mouse path exactly as it was.
  if (!session) return null
  return <HeadSelectActive />
}

function HeadSelectActive() {
  const camera = useThree((s) => s.camera)
  const inputMethod = useSettings((s) => s.inputMethod)
  const lang = useSettings((s) => s.language)

  // The ray pointer's "space" is the head itself: its world matrix is the head
  // pose inside a session, and −z (the pointer's default direction) is exactly
  // where the child is looking. Same camera `HeadSampler` reads its yaw from.
  const spaceRef = useRef<THREE.Object3D | null>(null)
  spaceRef.current = camera

  const pointerState = useMemo(() => ({ headSelect: true }), [])
  const pointer = useRayPointer(
    spaceRef,
    pointerState,
    {
      // never let the pad occlude its own target: glancing down at the pad
      // while reaching for it must not drop the lock
      filter: (object) => !isPadObject(object),
    },
    'gaze',
  )

  const aim = useMemo(createAimState, [])
  const result = useRef<AimResult>({ progress: 0, armed: false, fire: false })

  const reticle = useRef<THREE.Group>(null)
  const arcGeo = useRef<THREE.RingGeometry>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const dotMat = useRef<THREE.MeshBasicMaterial>(null)

  const camPos = useMemo(() => new THREE.Vector3(), [])
  const camDir = useMemo(() => new THREE.Vector3(), [])

  const dwellMs = inputMethod === 'dwell' ? DWELL_MS : Infinity

  // Fires the selection as a real click on whatever the ray is resting on, so
  // the games need no selection-specific code path — down then up inside the
  // pointer's click threshold is exactly what a trigger or a tap produces.
  const commit = useCallback(() => {
    const now = performance.now()
    pointer.down({ timeStamp: now, button: 0 })
    pointer.up({ timeStamp: now, button: 0 })
  }, [pointer])

  // Priority 0 runs after the root combined pointer's move (−50), so the
  // intersection read here is this frame's.
  useFrame((_, dt) => {
    const inter = pointer.getIntersection()
    const target = findSelectTarget(inter?.object)
    const r = advanceAim(aim, target, dt * 1000, dwellMs)
    result.current = r

    if (reticle.current != null) {
      if (inter == null) {
        reticle.current.visible = false
      } else {
        reticle.current.visible = true
        camera.getWorldPosition(camPos)
        // nudge toward the head so it never z-fights the surface it lands on
        reticle.current.position.copy(inter.point).lerp(camPos, 0.02)
        reticle.current.quaternion.copy(camera.quaternion)
        reticle.current.scale.setScalar(Math.max(inter.distance, 0.3) * RETICLE_ANGULAR)
      }
    }
    if (ringMat.current != null) {
      ringMat.current.opacity = r.armed ? 0.95 : 0.35
      ringMat.current.color.set(r.armed ? ARMED_COLOR : IDLE_COLOR)
    }
    if (dotMat.current != null) {
      dotMat.current.color.set(r.armed ? ARMED_COLOR : IDLE_COLOR)
    }
    // RingGeometry emits its theta segments in order, 2 triangles each, so
    // clipping the index range draws a partial arc without rebuilding it.
    if (arcGeo.current != null) {
      arcGeo.current.setDrawRange(0, Math.round(r.progress * ARC_SEGMENTS) * 6)
    }

    if (r.fire) commit()
  })

  return (
    <>
      <group ref={reticle} renderOrder={999} visible={false}>
        <mesh>
          <ringGeometry args={[0.6, 0.72, ARC_SEGMENTS]} />
          <meshBasicMaterial
            ref={ringMat}
            color={IDLE_COLOR}
            transparent
            opacity={0.35}
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh>
          <circleGeometry args={[0.13, 20]} />
          <meshBasicMaterial
            ref={dotMat}
            color={IDLE_COLOR}
            transparent
            opacity={0.9}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
        {/* dwell fill — starts at 12 o'clock, sweeps clockwise */}
        <mesh>
          <ringGeometry ref={arcGeo} args={[0.55, 0.86, ARC_SEGMENTS, 1, Math.PI / 2, -Math.PI * 2]} />
          <meshBasicMaterial
            color={PROGRESS_COLOR}
            transparent
            opacity={0.95}
            depthTest={false}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {inputMethod === 'poke' && (
        <PokePad
          camera={camera}
          camPos={camPos}
          camDir={camDir}
          readyLabel={t('vrPokeReady', lang)}
          waitLabel={t('vrPokeLook', lang)}
          isArmed={() => result.current.armed}
          onPoke={() => {
            if (pokeAim(aim)) commit()
          }}
        />
      )}
    </>
  )
}

/**
 * The in-reach confirm pad. The child looks at what they want and pokes this
 * with a bare finger — no pinch, no controller, one hand, and a deliberate act
 * so simply looking around can never answer for them.
 *
 * It rides at chest height on a lazy body-locked follow, and it goes dim
 * whenever the reticle is not on anything, so a poke is never made into
 * nothing.
 */
function PokePad({
  camera,
  camPos,
  camDir,
  readyLabel,
  waitLabel,
  isArmed,
  onPoke,
}: {
  camera: THREE.Camera
  camPos: THREE.Vector3
  camDir: THREE.Vector3
  readyLabel: string
  waitLabel: string
  isArmed: () => boolean
  onPoke: () => void
}) {
  const group = useRef<THREE.Group>(null)
  const yaw = useRef<number | null>(null)
  const plateMat = useRef<THREE.MeshBasicMaterial>(null)
  const wasArmed = useRef(false)

  // Two canvas labels (lit / dimmed) rather than one redrawn on every state
  // change — same approach as VRQuitButton, and it keeps Malayalam rendering
  // through the system font stack inside the headset.
  const readyTex = useMemo(() => padTexture(`👆 ${readyLabel}`, true), [readyLabel])
  const waitTex = useMemo(() => padTexture(waitLabel, false), [waitLabel])
  useEffect(() => () => void readyTex.dispose(), [readyTex])
  useEffect(() => () => void waitTex.dispose(), [waitTex])

  const labelMat = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((_, dt) => {
    const g = group.current
    if (g == null) return

    camera.getWorldPosition(camPos)
    camera.getWorldDirection(camDir)
    const camYaw = Math.atan2(camDir.x, -camDir.z)

    if (yaw.current == null) yaw.current = camYaw
    const err = shortestAngle(camYaw - yaw.current)
    if (Math.abs(err) > PAD_DEADZONE_RAD) {
      const overshoot = err - Math.sign(err) * PAD_DEADZONE_RAD
      yaw.current += overshoot * Math.min(1, PAD_FOLLOW_PER_S * dt)
    }

    const y = yaw.current
    g.position.set(
      camPos.x + Math.sin(y) * PAD_DISTANCE,
      camPos.y - PAD_DROP,
      camPos.z - Math.cos(y) * PAD_DISTANCE,
    )
    g.rotation.set(0, y, 0)

    const armed = isArmed()
    if (armed !== wasArmed.current) {
      wasArmed.current = armed
      if (plateMat.current != null) plateMat.current.color.set(armed ? '#1f7a4d' : '#3a3f4b')
      if (labelMat.current != null) labelMat.current.map = armed ? readyTex : waitTex
      if (labelMat.current != null) labelMat.current.needsUpdate = true
    }
  })

  return (
    <group ref={group} userData={{ headSelectPad: true }}>
      <group rotation={[-PAD_TILT, 0, 0]}>
        {/* thick hit body: a finger poke needs something with depth to enter */}
        <mesh
          onPointerDown={(e) => {
            e.stopPropagation()
            onPoke()
          }}
        >
          <boxGeometry args={[0.34, 0.21, 0.035]} />
          <meshBasicMaterial ref={plateMat} color="#3a3f4b" />
        </mesh>
        <mesh position={[0, 0, 0.019]}>
          <planeGeometry args={[0.32, 0.19]} />
          <meshBasicMaterial ref={labelMat} map={waitTex} transparent />
        </mesh>
      </group>
    </group>
  )
}

function padTexture(label: string, lit: boolean): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 640
  cv.height = 380
  const ctx = cv.getContext('2d')
  const tex = new THREE.CanvasTexture(cv)
  if (ctx == null) return tex
  ctx.clearRect(0, 0, cv.width, cv.height)
  const r = 46
  ctx.beginPath()
  ctx.roundRect(10, 10, cv.width - 20, cv.height - 20, r)
  ctx.fillStyle = lit ? 'rgba(46, 160, 100, 0.96)' : 'rgba(74, 80, 94, 0.92)'
  ctx.fill()
  ctx.lineWidth = 10
  ctx.strokeStyle = lit ? '#eafff2' : '#9aa2b2'
  ctx.stroke()
  ctx.fillStyle = lit ? '#ffffff' : '#c9cfdb'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `bold ${lit ? 110 : 82}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
  ctx.fillText(label, cv.width / 2, cv.height / 2)
  tex.needsUpdate = true
  return tex
}
