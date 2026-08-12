import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { XR, useXR } from '@react-three/xr'
import * as THREE from 'three'
import { xrStore } from './xrStore'
import { FLAT_SCREEN_DPR } from '../xrInput'
import { HeadSelect } from '../HeadSelect'
import { XRCameraHome } from '../XRCameraHome'
import { VRGameOver } from '../VRGameOver'
import { HeadSampler } from '../HeadSampler'
import { VRQuitButton } from '../VRQuitButton'
import { VRInputSwitch } from '../VRInputSwitch'
import { VRHudAnchor } from '../VRHudAnchor'
import {
  bearingToXZ,
  dragDistance,
  isDragTail,
  lookDrag,
  playerPosition,
  type CueMode,
  type Player,
} from './logic'
import { fbLine } from './strings'
import type { Lang } from '../../i18n/strings'

/** the child's eye height — the camera stands here, on the centre spot */
const EYE_Y = 1.6
const BALL_R = 0.32
const BALL_Y = BALL_R
/** where the ball rests while the child holds it: right at the child's feet
 * (just ahead of the centre spot, slightly to the right so it doesn't hide the
 * teammate straight in front). Kept close so a pass visibly leaves the child —
 * Quest feedback: a ball resting further out didn't feel like it came from you */
const CHILD_BALL: readonly [number, number] = [0.45, -1.9]

export interface Football360SceneProps {
  players: Player[]
  cue: CueMode
  /** player index currently holding (or receiving) the ball; the ball rolls there */
  ballOwner: number
  /** teammate currently showing the "pass it to me" ready cue, or null */
  readyIndex: number | null
  /** teammate performing the incoming pass (lean-and-push animation), or null */
  rollerIndex: number | null
  /** teammate who just got a wrong-partner pass (head-shake wobble), or null */
  rejectIndex: number | null
  /** teammate celebrating a caught return, or null */
  celebrateIndex: number | null
  /** true while the child holds the ball and may act — the ball glows/bobs */
  childTurn: boolean
  /** increments on a premature pass — shakes the ball */
  shake: number
  onPickPartner: (index: number) => void
  /** the chosen play language — the in-world name tags and the teammate's
   *  "pass it to me!" bubble are child-facing text and must follow it */
  lang: Lang
  /** child-facing HUD lines mirrored inside VR, where the DOM overlay is invisible */
  hudScore: string
  hudPrompt: string
  /** localized "Quit" label for the in-world VR-only exit control */
  hudQuit: string
}

export function Football360Scene(props: Football360SceneProps) {
  return (
    <Canvas
      dpr={FLAT_SCREEN_DPR}
      camera={{ position: [0, EYE_Y, 0], fov: 60, near: 0.1, far: 120 }}
      onCreated={({ camera }) => {
        // yaw-then-pitch so dragging sideways always spins the ground level
        camera.rotation.order = 'YXZ'
      }}
    >
      {/* WebXR: on a headset the session takes over the camera (real head
          tracking) and the controllers' rays drive the same pointer events the
          mouse/touch use — the game logic is identical in and out of VR */}
      <XR store={xrStore}>
        {/* open-air afternoon sky */}
        <color attach="background" args={['#8ecff0']} />
        <ambientLight intensity={0.8} color="#fdfbf4" />
        {/* the sun, plus a soft fill from the opposite side so faces read */}
        <directionalLight position={[14, 22, 8]} intensity={1.05} color="#fff7e0" />
        <directionalLight position={[-8, 10, -12]} intensity={0.3} />
        <LookControls />
        <HeadSelect confirmSide="on" />
        <XRCameraHome />
        <VRGameOver />
        <HeadSampler />
        <FootballGround />
        <SceneInner {...props} />
        <VRHud score={props.hudScore} prompt={props.hudPrompt} quit={props.hudQuit} />
      </XR>
    </Canvas>
  )
}

/* ---- 360° look-around controls ------------------------------------------
 * Same controls as Museum 360: the camera never moves — the child stands on
 * the centre spot and drags (touch or mouse) or scrolls to turn their view,
 * like a panorama viewer. Pitch is clamped so the ground never flips; motion
 * is damped so turning feels smooth, not jumpy (gentler for sensory comfort).
 */
function LookControls() {
  const { camera, gl } = useThree()
  const view = useRef({ yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 })

  useEffect(() => {
    const el = gl.domElement
    let down = false
    let lastX = 0
    let lastY = 0
    let startX = 0
    let startY = 0
    const clampPitch = (p: number) => Math.max(-0.5, Math.min(0.35, p))
    const onDown = (e: PointerEvent) => {
      down = true
      lastX = startX = e.clientX
      lastY = startY = e.clientY
      lookDrag.px = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!down) return
      const v = view.current
      // grab-the-world: dragging left pulls the ground left, so the view turns right
      v.tYaw -= (e.clientX - lastX) * 0.0042
      v.tPitch = clampPitch(v.tPitch + (e.clientY - lastY) * 0.0032)
      lastX = e.clientX
      lastY = e.clientY
      lookDrag.px = Math.max(lookDrag.px, Math.hypot(e.clientX - startX, e.clientY - startY))
    }
    const onUp = () => {
      if (down) lookDrag.endedAt = Date.now()
      down = false
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      view.current.tYaw += d * 0.0022
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((state, dt) => {
    // inside a VR session the headset owns the camera — a real head turn IS
    // the look-around, so the drag controls stand down entirely
    if (state.gl.xr.isPresenting) return
    const v = view.current
    const k = Math.min(1, dt * 9)
    v.yaw += (v.tYaw - v.yaw) * k
    v.pitch += (v.tPitch - v.pitch) * k
    camera.rotation.set(v.pitch, -v.yaw, 0)
  })
  return null
}

/* ---- in-world HUD for VR --------------------------------------------------
 * The DOM score bar and prompt banner cannot be seen inside an immersive
 * session, so the same lines are mirrored on floating panels at bearing 0 —
 * above the teammates, the natural "home" direction between rallies.
 */
function VRHud({ score, prompt, quit }: { score: string; prompt: string; quit: string }) {
  const inSession = useXR((s) => !!s.session)
  if (!inSession) return null
  return (
    <VRHudAnchor designEyeY={EYE_Y}>
      <TextPanel text={score} position={[0, 4.6, -8.2]} width={2.6} height={0.62} font={110} />
      <TextPanel text={prompt} position={[0, 3.8, -8.2]} width={4.8} height={0.8} font={64} />
      {/* left of the outermost teammate (≈−50°) — clear of the players, with a
          bit more margin than the teammate's own edge */}
      <VRQuitButton bearingDeg={-72} label={quit} />
      {/* selection-method switch, directly under Quit in the same controls corner */}
      <VRInputSwitch bearingDeg={-72} />
    </VRHudAnchor>
  )
}

/**
 * A rounded panel with centred text, drawn to a CanvasTexture — no font assets
 * needed, and the browser's own fonts cover Malayalam script too. Doubles as
 * the in-world name tags and speech bubble (drei Html overlays are invisible
 * inside a VR session, so everything textual lives in the 3D world here).
 */
function TextPanel({
  text,
  position,
  width,
  height,
  font,
  bg = 'rgba(20, 34, 18, 0.82)',
  fg = '#f4fbef',
  rotY = 0,
}: {
  text: string
  position: [number, number, number]
  width: number
  height: number
  font: number
  bg?: string
  fg?: string
  rotY?: number
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
    const r = cv.height * 0.3
    ctx.beginPath()
    ctx.roundRect(4, 4, cv.width - 8, cv.height - 8, r)
    ctx.fillStyle = bg
    ctx.fill()
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = font
    do {
      ctx.font = `bold ${size}px "Comic Sans MS", "Noto Sans Malayalam", sans-serif`
      size -= 4
    } while (ctx.measureText(text).width > cv.width - 90 && size > 24)
    ctx.fillText(text, cv.width / 2, cv.height / 2)
    texture.needsUpdate = true
  }, [text, font, bg, fg, texture])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <mesh position={position} rotation={[0, rotY, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  )
}

/* ---- the football ground: pitch, goals, stands, floodlights ---------------- */
const PITCH_W = 26 // x extent of the marked pitch
const PITCH_L = 40 // z extent — the child stands on the halfway line
const LINE_W = 0.14
const LINE_COLOR = '#f6f8f4'
const STAND_R = 24 // where the grandstand tiers begin

/** one flat white marking line (a thin plane lying on the grass) */
function PitchLine({ x = 0, z = 0, w, l }: { x?: number; z?: number; w: number; l: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.012, z]}>
      <planeGeometry args={[w, l]} />
      <meshStandardMaterial color={LINE_COLOR} roughness={0.9} />
    </mesh>
  )
}

function Goal({ z }: { z: number }) {
  // goalmouth faces the pitch centre; posts 5.2 apart, crossbar at 1.75
  const H = 1.75
  const HALF = 2.6
  const netZ = z < 0 ? z - 0.9 : z + 0.9
  return (
    <group>
      {[-HALF, HALF].map((x) => (
        <mesh key={x} position={[x, H / 2, z]}>
          <cylinderGeometry args={[0.07, 0.07, H, 10]} />
          <meshStandardMaterial color="#fbfbfb" />
        </mesh>
      ))}
      <mesh position={[0, H, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, HALF * 2 + 0.14, 10]} />
        <meshStandardMaterial color="#fbfbfb" />
      </mesh>
      {/* gauzy net panel behind the posts */}
      <mesh position={[0, H / 2, netZ]}>
        <planeGeometry args={[HALF * 2, H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** deterministic pseudo-random for crowd colours (stable across renders) */
function crowdColor(i: number, tier: number): string {
  const palette = ['#e2554c', '#5aa9e6', '#f5c542', '#7ac74f', '#b07fe0', '#f2f2f2', '#f97316']
  return palette[(i * 7 + tier * 3) % palette.length]
}

/** the four grandstand decks, from pitch-side outward */
const TIERS = [0, 1, 2, 3]

function Grandstand() {
  const tiers = TIERS
  return (
    <group>
      {/* perimeter wall closing the world behind the top tier */}
      <mesh position={[0, 5.5, 0]}>
        <cylinderGeometry args={[STAND_R + 9, STAND_R + 9, 11, 64, 1, true]} />
        <meshStandardMaterial color="#7d8794" side={THREE.BackSide} />
      </mesh>
      {tiers.map((t) => {
        const r = STAND_R + t * 2.1
        const stepY = 0.9 + t * 1.15
        return (
          <group key={t}>
            {/* riser (the vertical face of the step) */}
            <mesh position={[0, stepY / 2, 0]}>
              <cylinderGeometry args={[r, r, stepY, 64, 1, true]} />
              <meshStandardMaterial color={t % 2 ? '#5f6b7a' : '#6a7688'} side={THREE.BackSide} />
            </mesh>
            {/* seating deck (the flat top of the step) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, stepY, 0]}>
              <ringGeometry args={[r - 0.05, r + 2.15, 64]} />
              <meshStandardMaterial color={t % 2 ? '#8b97a6' : '#96a2b2'} side={THREE.DoubleSide} />
            </mesh>
          </group>
        )
      })}
      {/* the crowd: rings of bright spectators on every deck */}
      <Crowd tiers={tiers} />
    </group>
  )
}

/** spectators per deck */
const CROWD_PER_TIER = 36

/**
 * The whole crowd in two draw calls — one for the bodies, one for the heads.
 *
 * This used to be a `<mesh>` per body and a `<mesh>` per head: 4 decks × 36
 * spectators × 2 = 288 separate meshes, each with its own geometry and its own
 * material, so 288 draw calls every single frame. In an immersive session the
 * scene is drawn once per eye, which made it 576 — for scenery the child never
 * interacts with. That is the bulk of what the headset was spending its frame
 * budget on, and a headset that misses its frame deadline is a headset that
 * samples the controller late, which is what makes a press feel unanswered.
 *
 * `InstancedMesh` draws all of them from one geometry and one material in a
 * single call. The bodies vary in colour, which instancing handles through a
 * per-instance colour attribute; the heads are all one skin tone. Nothing about
 * the crowd moves, so the transforms are written once on mount.
 */
function Crowd({ tiers }: { tiers: number[] }) {
  const bodies = useRef<THREE.InstancedMesh>(null)
  const heads = useRef<THREE.InstancedMesh>(null)
  const count = tiers.length * CROWD_PER_TIER

  useEffect(() => {
    const b = bodies.current
    const h = heads.current
    if (!b || !h) return
    const m = new THREE.Matrix4()
    const colour = new THREE.Color()
    let n = 0
    for (const t of tiers) {
      const r = STAND_R + t * 2.1
      const stepY = 0.9 + t * 1.15
      for (let i = 0; i < CROWD_PER_TIER; i++) {
        const a = ((i + t * 0.5) / CROWD_PER_TIER) * Math.PI * 2
        const [x, z] = bearingToXZ(a, r + 1.1)
        m.setPosition(x, stepY + 0.28, z)
        b.setMatrixAt(n, m)
        b.setColorAt(n, colour.set(crowdColor(i, t)))
        m.setPosition(x, stepY + 0.68, z)
        h.setMatrixAt(n, m)
        n++
      }
    }
    b.instanceMatrix.needsUpdate = true
    if (b.instanceColor) b.instanceColor.needsUpdate = true
    h.instanceMatrix.needsUpdate = true
  }, [tiers])

  return (
    <group>
      <instancedMesh ref={bodies} args={[undefined, undefined, count]}>
        <capsuleGeometry args={[0.16, 0.3, 4, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.13, 8, 8]} />
        <meshStandardMaterial color="#e8b888" />
      </instancedMesh>
    </group>
  )
}

function Floodlight({ bearingDeg }: { bearingDeg: number }) {
  const a = (bearingDeg * Math.PI) / 180
  const [x, z] = bearingToXZ(a, STAND_R + 7)
  return (
    <group position={[x, 0, z]} rotation={[0, -a, 0]}>
      <mesh position={[0, 7, 0]}>
        <cylinderGeometry args={[0.18, 0.3, 14, 10]} />
        <meshStandardMaterial color="#98a0aa" />
      </mesh>
      {/* lamp head: a small grid of glowing panels angled at the pitch */}
      <group position={[0, 14.2, 0]} rotation={[0.5, Math.PI, 0]}>
        <mesh>
          <boxGeometry args={[2.4, 1.5, 0.25]} />
          <meshStandardMaterial color="#3c434c" />
        </mesh>
        {[-0.8, 0, 0.8].map((lx) =>
          [-0.38, 0.38].map((ly) => (
            <mesh key={`${lx}${ly}`} position={[lx, ly, 0.15]}>
              <circleGeometry args={[0.3, 12]} />
              <meshStandardMaterial color="#fffbe8" emissive="#fff6c9" emissiveIntensity={0.9} />
            </mesh>
          )),
        )}
      </group>
    </group>
  )
}

function AdBoard({ bearingDeg, color, w = 3.6 }: { bearingDeg: number; color: string; w?: number }) {
  const a = (bearingDeg * Math.PI) / 180
  const [x, z] = bearingToXZ(a, STAND_R - 2.2)
  return (
    <group position={[x, 0.42, z]} rotation={[0, -a, 0]}>
      <mesh>
        <boxGeometry args={[w, 0.84, 0.12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <planeGeometry args={[w - 0.3, 0.5]} />
        <meshStandardMaterial color="#f5f5f0" />
      </mesh>
    </group>
  )
}

function FootballGround() {
  const boardColors = ['#1d4ed8', '#dc2626', '#0d9488', '#f59e0b', '#7c3aed', '#16a34a']
  return (
    <group>
      {/* grass out to the stands */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[STAND_R + 2, 64]} />
        <meshStandardMaterial color="#3e8a44" roughness={0.95} />
      </mesh>
      {/* mowing stripes across the marked pitch */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, -PITCH_L / 2 + (i + 0.5) * (PITCH_L / 10)]}>
          <planeGeometry args={[PITCH_W, PITCH_L / 10]} />
          <meshStandardMaterial color={i % 2 ? '#4c9b52' : '#57a85d'} roughness={0.95} />
        </mesh>
      ))}

      {/* white markings: touchlines, goal lines, halfway line, centre circle */}
      <PitchLine x={-PITCH_W / 2} w={LINE_W} l={PITCH_L} />
      <PitchLine x={PITCH_W / 2} w={LINE_W} l={PITCH_L} />
      <PitchLine z={-PITCH_L / 2} w={PITCH_W} l={LINE_W} />
      <PitchLine z={PITCH_L / 2} w={PITCH_W} l={LINE_W} />
      <PitchLine w={PITCH_W} l={LINE_W} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[2.55, 2.55 + LINE_W, 48]} />
        <meshStandardMaterial color={LINE_COLOR} roughness={0.9} />
      </mesh>
      {/* the centre spot — right under the child's feet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <circleGeometry args={[0.14, 20]} />
        <meshStandardMaterial color={LINE_COLOR} roughness={0.9} />
      </mesh>
      {/* penalty boxes */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <PitchLine x={-6} z={s * (PITCH_L / 2 - 2.75)} w={LINE_W} l={5.5} />
          <PitchLine x={6} z={s * (PITCH_L / 2 - 2.75)} w={LINE_W} l={5.5} />
          <PitchLine z={s * (PITCH_L / 2 - 5.5)} w={12} l={LINE_W} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, s * (PITCH_L / 2 - 3.6)]}>
            <circleGeometry args={[0.12, 16]} />
            <meshStandardMaterial color={LINE_COLOR} roughness={0.9} />
          </mesh>
        </group>
      ))}

      <Goal z={-PITCH_L / 2} />
      <Goal z={PITCH_L / 2} />

      {/* advertising boards ringing the pitch (bearing 0 kept clear of clutter) */}
      {Array.from({ length: 12 }, (_, i) => (
        <AdBoard key={i} bearingDeg={15 + i * 30} color={boardColors[i % boardColors.length]} />
      ))}

      <Grandstand />
      {[45, 135, 225, 315].map((b) => (
        <Floodlight key={b} bearingDeg={b} />
      ))}

      {/* scoreboard high over the stand at bearing 0 — the "home" direction */}
      <group position={[0, 10.2, -(STAND_R + 8.2)]}>
        <mesh position={[0, 0, -0.15]}>
          <boxGeometry args={[8.6, 2.2, 0.25]} />
          <meshStandardMaterial color="#232a33" />
        </mesh>
        <TextPanel text="⚽ FOOTBALL 360" position={[0, 0, 0]} width={8} height={1.7} font={150} bg="rgba(12, 16, 22, 0.95)" fg="#ffe27a" />
      </group>

      {/* a few soft clouds so the sky isn't a flat wash */}
      {[
        [-18, 26, -30, 3.2],
        [14, 30, -24, 2.6],
        [26, 24, 18, 3.6],
        [-24, 28, 20, 2.8],
      ].map(([x, y, z, s], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh scale={[s, s * 0.45, s * 0.7]}>
            <sphereGeometry args={[1, 10, 10]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
          </mesh>
          <mesh position={[s * 0.7, -0.2, 0]} scale={[s * 0.6, s * 0.3, s * 0.5]}>
            <sphereGeometry args={[1, 10, 10]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---- the play: teammates, ball, cues --------------------------------------- */

/** Where the ball rests for a given holder: the child's spot is just ahead of
 * the camera; a teammate keeps it at their feet, toward the middle. */
function ballSpot(index: number, players: Player[]): [number, number] {
  if (index <= 0) return [CHILD_BALL[0], CHILD_BALL[1]]
  const [x, z] = playerPosition(index, players.length - 1)
  const len = Math.hypot(x, z) || 1
  return [x - (x / len) * 0.9, z - (z / len) * 0.9]
}

function SceneInner(props: Football360SceneProps) {
  const { players, cue, ballOwner, readyIndex, rollerIndex, rejectIndex, celebrateIndex, childTurn, shake, onPickPartner, lang } = props
  const partners = players.length - 1

  return (
    <group>
      <Football players={players} owner={ballOwner} glowing={childTurn} shake={shake} />

      {players.map((player, i) => {
        if (player.kind === 'child') return null // first person: the camera IS the child
        const [x, z] = playerPosition(i, partners)
        // teammates face the child (the camera at the centre spot) by default;
        // in orient mode the not-ready ones turn away — direction of the body
        // *is* the cue on hard.
        let face = Math.atan2(-x, -z)
        if (readyIndex !== null && i !== readyIndex && cue === 'orient') {
          face += (i % 2 === 0 ? 1 : -1) * 0.95
        }
        return (
          <Kid
            key={player.id}
            player={player}
            x={x}
            z={z}
            face={face}
            ready={i === readyIndex}
            cue={cue}
            rolling={i === rollerIndex}
            rejecting={i === rejectIndex}
            celebrating={i === celebrateIndex}
            onPick={() => onPickPartner(i)}
            lang={lang}
          />
        )
      })}
    </group>
  )
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * The football rolls (position lerp + true rolling rotation) toward whoever
 * owns it. It bobs and glows on the child's turn and shakes after a premature
 * pass. White with black patches so the rolling is readable.
 */
function Football({
  players,
  owner,
  glowing,
  shake,
}: {
  players: Player[]
  owner: number
  glowing: boolean
  shake: number
}) {
  const ref = useRef<THREE.Group>(null)
  const sphere = useRef<THREE.Mesh>(null)
  const pos = useRef<THREE.Vector3 | null>(null)
  const dest = useRef(new THREE.Vector3())
  const delta = useRef(new THREE.Vector3())
  const axis = useRef(new THREE.Vector3())
  const spin = useRef(new THREE.Quaternion())
  const shakeAmt = useRef(0)

  useEffect(() => {
    if (shake > 0) shakeAmt.current = 1
  }, [shake])

  const [tx, tz] = ballSpot(owner, players)
  dest.current.set(tx, BALL_Y, tz)
  if (pos.current === null) pos.current = dest.current.clone()

  // classic panel pattern: black caps poking through the white shell
  const patches = useMemo(() => {
    const dirs: THREE.Vector3[] = []
    for (const y of [-0.62, 0.62]) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + (y > 0 ? Math.PI / 3 : 0)
        dirs.push(new THREE.Vector3(Math.cos(a) * 0.78, y, Math.sin(a) * 0.78).normalize())
      }
    }
    dirs.push(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0))
    return dirs
  }, [])

  useFrame((state, dt) => {
    const g = ref.current
    const m = sphere.current
    const p = pos.current
    if (!g || !m || !p) return
    delta.current.copy(p)
    p.lerp(dest.current, Math.min(1, dt * 4.2))
    delta.current.subVectors(p, delta.current)
    const dist = delta.current.length()
    if (dist > 1e-4) {
      // rolling, not sliding: rotate about up × direction by dist / radius
      axis.current.crossVectors(UP, delta.current).normalize()
      spin.current.setFromAxisAngle(axis.current, dist / BALL_R)
      m.quaternion.premultiply(spin.current)
    }
    const t = state.clock.elapsedTime
    const bob = glowing ? Math.abs(Math.sin(t * 2.5)) * 0.09 : 0
    let sx = 0
    if (shakeAmt.current > 0) {
      shakeAmt.current = Math.max(0, shakeAmt.current - dt * 2.5)
      sx = Math.sin(t * 40) * shakeAmt.current * 0.07
    }
    g.position.set(p.x + sx, p.y + bob, p.z)
    const mat = m.material as THREE.MeshStandardMaterial
    const glow = glowing ? 0.3 + Math.sin(t * 4) * 0.15 : 0
    mat.emissiveIntensity += (glow - mat.emissiveIntensity) * 0.2
  })

  return (
    <group ref={ref}>
      <mesh ref={sphere}>
        <sphereGeometry args={[BALL_R, 24, 24]} />
        <meshStandardMaterial color="#f4f4f2" emissive="#fff3b0" emissiveIntensity={0} roughness={0.5} />
        {patches.map((d, i) => (
          <mesh key={i} position={[d.x * BALL_R * 0.97, d.y * BALL_R * 0.97, d.z * BALL_R * 0.97]}>
            <sphereGeometry args={[BALL_R * 0.28, 10, 10]} />
            <meshStandardMaterial color="#23262b" roughness={0.6} />
          </mesh>
        ))}
      </mesh>
    </group>
  )
}

/**
 * A stylized teammate (same body plan as Roll-Back Buddy) with the ready-cue
 * poses:
 *  - verbal : hands up + pulsing ring at the feet + a "Pass it to me!" bubble.
 *  - gesture: hands up and leaning in — no ring, no words.
 *  - orient : arms stay down; only the body turning toward the child signals
 *             readiness (the scene turns non-ready teammates away).
 * Teammates are tappable — tapping one passes the ball to them. Name tags and
 * the bubble are canvas-texture panels (not DOM overlays) so they stay visible
 * inside a VR session too.
 */
function Kid({
  player,
  x,
  z,
  face,
  ready,
  cue,
  rolling,
  rejecting,
  celebrating,
  onPick,
  lang,
}: {
  player: Player
  x: number
  z: number
  face: number
  ready: boolean
  cue: CueMode
  rolling: boolean
  rejecting: boolean
  celebrating: boolean
  onPick: () => void
  lang: Lang
}) {
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const shirtMat = useRef<THREE.MeshStandardMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const look = player.look
  const phase = x * 1.7
  const handsUp = (ready && cue !== 'orient') || celebrating
  const initialized = useRef(false)
  const [hover, setHover] = useState(false)
  // panels always face the child at the centre spot, whatever the body does
  const faceChild = Math.atan2(-x, -z)

  useFrame((state) => {
    const grp = g.current
    if (!grp) return
    if (!initialized.current && body.current) {
      // start out already facing the child — no spin-around on mount
      body.current.rotation.y = face
      initialized.current = true
    }
    const t = state.clock.elapsedTime
    const targetScale = (ready || celebrating ? 1.06 : 1) * (hover ? 1.04 : 1)
    grp.scale.setScalar(grp.scale.x + (targetScale - grp.scale.x) * 0.1)
    const hop = celebrating ? Math.abs(Math.sin(t * 5)) * 0.14 : ready ? Math.abs(Math.sin(t * 3)) * 0.04 : 0
    grp.position.y += (hop - grp.position.y) * 0.12

    const b = body.current
    if (b) {
      // turn to the assigned facing, sway idly, lean in to pass or beckon
      const wobble = rejecting ? Math.sin(t * 9) * 0.16 : 0
      b.rotation.y += (face + Math.sin(t * 0.9 + phase) * 0.04 + wobble - b.rotation.y) * 0.09
      const lean = rolling ? -0.3 : ready && cue !== 'verbal' ? -0.14 : 0
      b.rotation.x += (lean - b.rotation.x) * 0.1
    }
    const raiseL = handsUp ? -2.55 : Math.sin(t * 1.1 + phase) * 0.06
    const raiseR = handsUp ? -2.55 : rolling ? -1.15 : Math.sin(t * 1.05 + phase) * 0.06
    if (armL.current) armL.current.rotation.x += (raiseL - armL.current.rotation.x) * 0.12
    if (armR.current) armR.current.rotation.x += (raiseR - armR.current.rotation.x) * 0.12

    if (shirtMat.current) {
      const glow = ready && cue === 'verbal' ? 0.3 : 0
      shirtMat.current.emissiveIntensity += (glow - shirtMat.current.emissiveIntensity) * 0.2
    }
    if (ring.current) {
      const s = 1 + Math.sin(t * 4) * 0.12
      ring.current.scale.setScalar(s)
      const mat = ring.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.4 + Math.sin(t * 4) * 0.2
    }
  })

  return (
    <group position={[x, 0, z]}>
      <group ref={g}>
        {/* verbal cue only: pulsing ring at the feet */}
        {ready && cue === 'verbal' && (
          <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.42, 0.56, 32]} />
            <meshBasicMaterial color="#22c55e" transparent opacity={0.5} />
          </mesh>
        )}
        <group ref={body}>
          {/* legs + boots */}
          {[-0.09, 0.09].map((lx) => (
            <group key={lx}>
              <mesh position={[lx, 0.28, 0]}>
                <cylinderGeometry args={[0.065, 0.075, 0.56, 10]} />
                <meshStandardMaterial color={look.pants} />
              </mesh>
              <mesh position={[lx, 0.03, 0.03]}>
                <boxGeometry args={[0.14, 0.07, 0.24]} />
                <meshStandardMaterial color="#494d52" />
              </mesh>
            </group>
          ))}
          {/* torso (football jersey) */}
          <mesh position={[0, 0.85, 0]}>
            <capsuleGeometry args={[0.175, 0.34, 6, 14]} />
            <meshStandardMaterial
              ref={shirtMat}
              color={look.shirt}
              emissive={look.shirt}
              emissiveIntensity={0}
            />
          </mesh>
          {/* arms (both raise for the ready gesture; right pushes the pass) */}
          {[
            { side: -0.25 as number, ref: armL },
            { side: 0.25 as number, ref: armR },
          ].map(({ side, ref }) => (
            <group key={side} ref={ref} position={[side, 1.03, 0]}>
              <mesh position={[0, -0.19, 0]}>
                <cylinderGeometry args={[0.05, 0.045, 0.4, 8]} />
                <meshStandardMaterial color={look.shirt} />
              </mesh>
              <mesh position={[0, -0.42, 0]}>
                <sphereGeometry args={[0.055, 10, 10]} />
                <meshStandardMaterial color={look.skin} />
              </mesh>
            </group>
          ))}
          {/* head, hair, face */}
          <mesh position={[0, 1.38, 0]}>
            <sphereGeometry args={[0.165, 18, 18]} />
            <meshStandardMaterial color={look.skin} />
          </mesh>
          <mesh position={[0, 1.45, -0.03]} scale={[1, 0.72, 1]}>
            <sphereGeometry args={[0.175, 18, 18]} />
            <meshStandardMaterial color={look.hair} />
          </mesh>
          {look.longHair && (
            <mesh position={[0, 1.27, -0.12]}>
              <boxGeometry args={[0.26, 0.34, 0.1]} />
              <meshStandardMaterial color={look.hair} />
            </mesh>
          )}
          {[-0.06, 0.06].map((ex) => (
            <mesh key={ex} position={[ex, 1.4, 0.145]}>
              <sphereGeometry args={[0.021, 8, 8]} />
              <meshStandardMaterial color="#2b2620" />
            </mesh>
          ))}
          <mesh position={[0, 1.315, 0.152]}>
            <boxGeometry args={[0.07, 0.016, 0.02]} />
            <meshStandardMaterial color="#9a5b4a" />
          </mesh>
        </group>

        {/* name tag — a canvas panel (visible in VR too), turned to the child.
            Malayalam script in an English session is unreadable to the child,
            so the tag follows the play language like every other child-facing
            label (`name` is Malayalam, `nameEn` the romanization). */}
        <TextPanel
          text={lang === 'ml' ? player.name : player.nameEn}
          position={[0, 1.92, 0]}
          width={0.9}
          height={0.28}
          font={120}
          bg="rgba(255, 255, 255, 0.85)"
          fg="#2b3440"
          rotY={faceChild}
        />
        {/* verbal cue only: the teammate literally asks for the ball */}
        {ready && cue === 'verbal' && (
          <TextPanel
            text={fbLine('bubbleAsk', lang)}
            position={[0, 2.28, 0]}
            width={1.5}
            height={0.4}
            font={110}
            bg="rgba(234, 251, 241, 0.95)"
            fg="#0a7d4f"
            rotY={faceChild}
          />
        )}

        {/* transparent tap target around the whole teammate — clicks are
            filtered against look-around drags, same guard as Museum 360 */}
        <mesh
          visible={false}
          position={[0, 0.95, 0]}
          userData={{ headSelect: true }}
          onClick={(e) => {
            e.stopPropagation()
            if (isDragTail() || dragDistance(e) > 8) return
            onPick()
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHover(false)
            document.body.style.cursor = 'auto'
          }}
        >
          <boxGeometry args={[1.1, 2.1, 0.9]} />
        </mesh>
      </group>
    </group>
  )
}
