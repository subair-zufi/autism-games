import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { DiscoveryId } from './logic'

/**
 * The ten surprises of Park 360, built from three.js primitives.
 *
 * No model files anywhere in this app: the whole thing has to work offline from
 * a service-worker cache on a headset, and a glTF pipeline would be a second
 * asset system to keep in sync. Everything here is spheres, capsules, cones and
 * lathes — but layered the way a real animal is, which is what makes the
 * difference between "a shape" and "a rabbit":
 *
 *  - Organic masses are built from SEVERAL overlapping ellipsoids (a head is a
 *    skull plus a muzzle plus cheeks), never one sphere. One sphere reads as a
 *    ball; three overlapping ones read as an animal.
 *  - Colour is layered: a darker back, a paler belly, markings on top. Flat
 *    single-colour bodies are the strongest "toy" signal there is.
 *  - Eyes get a dark iris AND a small white catch-light, which is most of what
 *    makes a face feel alive rather than drawn on.
 *  - Nothing is pure saturated RGB. Real fur, feathers and petals sit a little
 *    off the primaries, so every colour here is mixed.
 *  - Small asymmetries and soft roughness values stop the surfaces reading as
 *    plastic under the park's single sun.
 *
 * Each model is authored to fit roughly within ±0.3 m of its own origin, so the
 * game can scale them all together by level saliency and no surprise is easier
 * to spot than another just because its species is bigger. That is deliberate:
 * equal findability matters more here than a butterfly being smaller than a
 * puppy, and unequal target salience would be a confound in the measure.
 *
 * How tall each one stands and where its underside is are measured, not
 * declared here: see `MODEL_EXTENTS` in logic.ts, which is what places them on
 * the grass and sizes their tap volume.
 */

/* ---- shared materials ----------------------------------------------------
 * One instance of each, created at module load and reused by every model, so
 * swapping surprise does not churn the GPU. Fur and feather get real roughness
 * so the sun picks out their form instead of flattening it.
 */
const fur = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 })
const feather = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.06 })
const petal = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0 })
const shell = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.1 })

const M = {
  // eyes + noses, shared by every animal
  iris: new THREE.MeshStandardMaterial({ color: '#17120d', roughness: 0.25 }),
  catchlight: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  nosePink: fur('#d98a94'),
  noseDark: fur('#3a2f2a'),
  whisker: new THREE.MeshBasicMaterial({ color: '#f3ece2' }),
  // bunny
  bunnyFur: fur('#d9cfc2'),
  bunnyBelly: fur('#f2ece3'),
  bunnyInnerEar: fur('#e3b3b8'),
  // puppy
  puppyFur: fur('#c89a63'),
  puppyBelly: fur('#eddcc2'),
  puppyPatch: fur('#8a6238'),
  // kitten
  kittenFur: fur('#9a9388'),
  // squirrel
  squirrelFur: fur('#a3663c'),
  squirrelBelly: fur('#e8d5bd'),
  // duckling
  ducklingDown: fur('#edc94e'),
  ducklingWing: fur('#dbb43c'),
  bill: fur('#e8913c'),
  // parrot
  parrotGreen: feather('#4e9b3f'),
  parrotLime: feather('#73b84b'),
  parrotRed: feather('#c9433a'),
  parrotBeak: shell('#d9b23c'),
  // peacock
  peacockBlue: feather('#1f6f93'),
  peacockTeal: feather('#2a8f84'),
  peacockEye: feather('#2f5f8c'),
  peacockGold: feather('#c8a13c'),
  // butterfly
  wingUpper: petal('#e2607f'),
  wingLower: petal('#e8a13c'),
  wingEdge: petal('#f4e3c2'),
  bodyDark: fur('#3a2e24'),
  // ladybird
  ladyRed: shell('#c0392b'),
  ladyBlack: shell('#1c1a18'),
  // sunflower
  stem: petal('#55893f'),
  leaf: petal('#67a04a'),
  sunPetal: petal('#e8b63c'),
  seedHead: petal('#5d4324'),
}

const kittenStripe = fur('#6f6960')
const kittenBelly = fur('#e6e1d8')
const peacockCrest = feather('#2f8fa8')

/** Two eyes with a catch-light, the single biggest "alive" cue there is. */
function Eyes({
  x,
  y,
  z,
  r = 0.032,
  spread,
}: {
  x?: number
  y: number
  z: number
  r?: number
  spread: number
}) {
  return (
    <>
      {[-spread, spread].map((s) => (
        <group key={s} position={[(x ?? 0) + s, y, z]}>
          <mesh material={M.iris}>
            <sphereGeometry args={[r, 14, 14]} />
          </mesh>
          <mesh position={[r * 0.35, r * 0.35, r * 0.6]} material={M.catchlight}>
            <sphereGeometry args={[r * 0.36, 8, 8]} />
          </mesh>
        </group>
      ))}
    </>
  )
}

/** Fine whiskers — three a side, fanned, as thin cylinders. */
function Whiskers({ y, z, spread = 0.05 }: { y: number; z: number; spread?: number }) {
  return (
    <>
      {[-1, 1].map((s) =>
        [0.22, 0, -0.18].map((tilt, i) => (
          <mesh
            key={`${s}-${i}`}
            position={[s * spread, y, z]}
            rotation={[0, 0, s * (Math.PI / 2) + tilt * s]}
            material={M.whisker}
          >
            <cylinderGeometry args={[0.0028, 0.0012, 0.17, 4]} />
          </mesh>
        )),
      )}
    </>
  )
}

/* ---- butterfly -----------------------------------------------------------
 * Four wings, not two: a large rounded forewing and a smaller scalloped
 * hindwing each side, which is what actually makes a butterfly read as a
 * butterfly rather than a bow tie. They flap from the body on their own pivot.
 */
function Butterfly() {
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  useFrame((state) => {
    const a = Math.sin(state.clock.elapsedTime * 6.5) * 0.62
    if (left.current) left.current.rotation.y = a
    if (right.current) right.current.rotation.y = -a
  })
  return (
    <group>
      {/* segmented body: thorax and a tapering abdomen */}
      <mesh position={[0, 0.06, 0]} material={M.bodyDark}>
        <capsuleGeometry args={[0.035, 0.1, 6, 12]} />
      </mesh>
      <mesh position={[0, -0.12, 0]} scale={[0.8, 1, 0.8]} material={M.bodyDark}>
        <capsuleGeometry args={[0.028, 0.16, 6, 12]} />
      </mesh>
      <mesh position={[0, 0.17, 0]} material={M.bodyDark}>
        <sphereGeometry args={[0.045, 14, 14]} />
      </mesh>
      <Eyes y={0.18} z={0.03} r={0.016} spread={0.026} />
      {/* clubbed antennae */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.022, 0.2, 0]} rotation={[0, 0, -s * 0.5]}>
          <mesh position={[0, 0.07, 0]} material={M.bodyDark}>
            <cylinderGeometry args={[0.004, 0.004, 0.15, 5]} />
          </mesh>
          <mesh position={[0, 0.15, 0]} material={M.bodyDark}>
            <sphereGeometry args={[0.013, 8, 8]} />
          </mesh>
        </group>
      ))}
      {[
        { s: -1, ref: left },
        { s: 1, ref: right },
      ].map(({ s, ref }) => (
        <group key={s} ref={ref}>
          {/* forewing: big, swept back */}
          <mesh position={[s * 0.19, 0.1, 0]} rotation={[0, 0, s * 0.3]} scale={[1, 1.25, 0.08]} material={M.wingUpper}>
            <sphereGeometry args={[0.2, 18, 18]} />
          </mesh>
          {/* pale outer margin */}
          <mesh position={[s * 0.3, 0.16, 0.002]} rotation={[0, 0, s * 0.3]} scale={[0.5, 0.6, 0.06]} material={M.wingEdge}>
            <sphereGeometry args={[0.2, 14, 14]} />
          </mesh>
          {/* hindwing: smaller, rounder, below */}
          <mesh position={[s * 0.15, -0.13, 0]} rotation={[0, 0, s * -0.2]} scale={[1, 0.9, 0.08]} material={M.wingLower}>
            <sphereGeometry args={[0.15, 16, 16]} />
          </mesh>
          {/* the eyespot every child looks for */}
          <mesh position={[s * 0.2, 0.12, 0.012]} material={M.wingEdge}>
            <sphereGeometry args={[0.035, 10, 10]} />
          </mesh>
          <mesh position={[s * 0.2, 0.12, 0.016]} material={M.bodyDark}>
            <sphereGeometry args={[0.016, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---- bunny ---------------------------------------------------------------
 * Sitting upright, haunches drawn up, ears alert. The nose twitches, which is
 * the one piece of motion that makes a rabbit unmistakably a rabbit.
 */
function Bunny() {
  const nose = useRef<THREE.Mesh>(null)
  const earL = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (nose.current) nose.current.position.z = 0.213 + Math.sin(t * 9) * 0.004
    // one ear swivels now and then, the other stays put
    if (earL.current) earL.current.rotation.z = -0.18 + Math.sin(t * 0.7) * 0.12
  })
  return (
    <group>
      {/* body: chest + haunch, two masses not one */}
      <mesh position={[0, -0.08, -0.02]} scale={[1, 0.95, 1.15]} material={M.bunnyFur}>
        <sphereGeometry args={[0.21, 20, 20]} />
      </mesh>
      <mesh position={[0, -0.12, -0.12]} scale={[1.05, 0.9, 0.9]} material={M.bunnyFur}>
        <sphereGeometry args={[0.17, 18, 18]} />
      </mesh>
      {/* pale chest */}
      <mesh position={[0, -0.09, 0.11]} scale={[0.72, 0.8, 0.62]} material={M.bunnyBelly}>
        <sphereGeometry args={[0.18, 16, 16]} />
      </mesh>
      {/* cotton tail */}
      <mesh position={[0, -0.09, -0.26]} material={M.bunnyBelly}>
        <sphereGeometry args={[0.075, 14, 14]} />
      </mesh>
      {/* hind feet tucked forward */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, -0.24, 0.06]} rotation={[0.2, 0, 0]} scale={[0.7, 0.55, 1.5]} material={M.bunnyFur}>
          <sphereGeometry args={[0.07, 12, 12]} />
        </mesh>
      ))}
      {/* head: skull + muzzle */}
      <mesh position={[0, 0.16, 0.06]} scale={[1, 0.95, 1]} material={M.bunnyFur}>
        <sphereGeometry args={[0.135, 20, 20]} />
      </mesh>
      <mesh position={[0, 0.12, 0.16]} scale={[0.85, 0.72, 0.8]} material={M.bunnyFur}>
        <sphereGeometry args={[0.1, 16, 16]} />
      </mesh>
      <mesh ref={nose} position={[0, 0.13, 0.213]} scale={[1.2, 0.85, 0.8]} material={M.nosePink}>
        <sphereGeometry args={[0.022, 12, 12]} />
      </mesh>
      <Eyes y={0.19} z={0.14} r={0.034} spread={0.085} />
      <Whiskers y={0.13} z={0.2} spread={0.045} />
      {/* long ears, with a pink inner channel */}
      {[-1, 1].map((s) => (
        <group
          key={s}
          ref={s === -1 ? earL : undefined}
          position={[s * 0.055, 0.27, 0.03]}
          rotation={[-0.12, 0, s * 0.18]}
        >
          <mesh position={[0, 0.11, 0]} material={M.bunnyFur}>
            <capsuleGeometry args={[0.042, 0.19, 8, 12]} />
          </mesh>
          <mesh position={[0, 0.11, 0.028]} scale={[0.55, 0.88, 0.4]} material={M.bunnyInnerEar}>
            <capsuleGeometry args={[0.042, 0.19, 8, 12]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/* ---- parrot --------------------------------------------------------------
 * An Indian ringneck: green body, rose collar, red hooked bill, long tapering
 * tail. Perched, with the head cocking the way parrots actually watch you.
 */
function Parrot() {
  const head = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (head.current) head.current.rotation.z = Math.sin(t * 0.8) * 0.22
  })
  return (
    <group>
      {/* upright body, tapering to the tail */}
      <mesh position={[0, -0.02, 0]} scale={[0.9, 1.25, 0.9]} material={M.parrotGreen}>
        <sphereGeometry args={[0.15, 20, 20]} />
      </mesh>
      <mesh position={[0, -0.05, 0.08]} scale={[0.62, 1, 0.5]} material={M.parrotLime}>
        <sphereGeometry args={[0.14, 16, 16]} />
      </mesh>
      {/* folded wings */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.115, -0.03, -0.015]}
          rotation={[0, 0, -s * 0.12]}
          scale={[0.34, 1.15, 0.72]}
          material={M.parrotGreen}
        >
          <sphereGeometry args={[0.14, 16, 16]} />
        </mesh>
      ))}
      {/* long tail, two tapering feathers */}
      <mesh position={[0, -0.3, -0.05]} rotation={[0.26, 0, 0]} material={M.parrotLime}>
        <coneGeometry args={[0.045, 0.3, 6]} />
      </mesh>
      <mesh position={[0.018, -0.33, -0.07]} rotation={[0.3, 0, 0.08]} material={M.parrotGreen}>
        <coneGeometry args={[0.032, 0.26, 6]} />
      </mesh>
      {/* head, cocking */}
      <group ref={head} position={[0, 0.2, 0.01]}>
        <mesh scale={[0.95, 1, 0.95]} material={M.parrotGreen}>
          <sphereGeometry args={[0.105, 18, 18]} />
        </mesh>
        {/* the ringneck's rose collar */}
        <mesh position={[0, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]} material={M.parrotRed}>
          <torusGeometry args={[0.085, 0.014, 8, 20]} />
        </mesh>
        {/* Hooked bill. A parrot's is short, deep and curls DOWN over a stubby
            lower mandible — drawn as a long forward cone it read as a clown
            nose. The cere (the fleshy band where the bill meets the face)
            is what seats it into the head instead of stuck on. */}
        <mesh position={[0, 0.0, 0.082]} scale={[1, 0.9, 0.7]} material={M.parrotRed}>
          <sphereGeometry args={[0.036, 12, 12]} />
        </mesh>
        <mesh position={[0, -0.028, 0.088]} rotation={[-0.75, 0, 0]} material={M.parrotRed}>
          <coneGeometry args={[0.03, 0.055, 10]} />
        </mesh>
        <mesh position={[0, -0.042, 0.072]} scale={[0.85, 0.5, 0.6]} material={M.parrotBeak}>
          <sphereGeometry args={[0.026, 10, 10]} />
        </mesh>
        {/* pale eye-ring, then the eye */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.062, 0.025, 0.07]} material={M.parrotBeak}>
            <sphereGeometry args={[0.028, 12, 12]} />
          </mesh>
        ))}
        <Eyes y={0.028} z={0.088} r={0.019} spread={0.062} />
      </group>
      {/* feet gripping */}
      {[-0.05, 0.05].map((x) => (
        <mesh key={x} position={[x, -0.19, 0.05]} rotation={[1.2, 0, 0]} material={M.parrotBeak}>
          <cylinderGeometry args={[0.012, 0.012, 0.07, 6]} />
        </mesh>
      ))}
    </group>
  )
}

/* ---- sunflower -----------------------------------------------------------
 * A real sunflower head: two offset rings of petals around a domed, textured
 * seed centre, on a hairy stem with broad heart-shaped leaves.
 */
function Sunflower() {
  const head = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (head.current) head.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.9) * 0.05
  })
  return (
    <group>
      <mesh position={[0, -0.26, 0]} material={M.stem}>
        <cylinderGeometry args={[0.022, 0.032, 0.5, 8]} />
      </mesh>
      {/* broad leaves, one each side at different heights */}
      {[
        { x: 0.12, y: -0.24, rot: -0.7, s: 1 },
        { x: -0.11, y: -0.34, rot: 0.75, s: 0.82 },
      ].map(({ x, y, rot, s }, i) => (
        <mesh key={i} position={[x, y, 0]} rotation={[0, 0, rot]} scale={[s, s * 0.45, s * 0.22]} material={M.leaf}>
          <sphereGeometry args={[0.15, 14, 14]} />
        </mesh>
      ))}
      <group ref={head} position={[0, 0.12, 0]}>
        {/* outer ring of petals */}
        {Array.from({ length: 13 }, (_, i) => {
          const a = (i / 13) * Math.PI * 2
          return (
            <mesh
              key={`o${i}`}
              position={[Math.cos(a) * 0.2, Math.sin(a) * 0.2, -0.01]}
              rotation={[0, 0, a]}
              scale={[1, 0.42, 0.14]}
              material={M.sunPetal}
            >
              <sphereGeometry args={[0.115, 12, 12]} />
            </mesh>
          )
        })}
        {/* inner ring, offset so the petals interleave like the real thing */}
        {Array.from({ length: 13 }, (_, i) => {
          const a = ((i + 0.5) / 13) * Math.PI * 2
          return (
            <mesh
              key={`i${i}`}
              position={[Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.012]}
              rotation={[0, 0, a]}
              scale={[1, 0.38, 0.12]}
              material={M.sunPetal}
            >
              <sphereGeometry args={[0.095, 12, 12]} />
            </mesh>
          )
        })}
        {/* domed seed head */}
        <mesh position={[0, 0, 0.035]} scale={[1, 1, 0.45]} material={M.seedHead}>
          <sphereGeometry args={[0.115, 20, 20]} />
        </mesh>
        {/* a scatter of seeds so the centre is not a flat disc */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = i * 2.39
          const r = 0.028 * Math.sqrt(i)
          return (
            <mesh key={`s${i}`} position={[Math.cos(a) * r, Math.sin(a) * r, 0.085]} material={M.bodyDark}>
              <sphereGeometry args={[0.012, 6, 6]} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

/* ---- puppy ---------------------------------------------------------------
 * Sitting, head tilted, tail going. Floppy ears and a patch over one eye —
 * asymmetry is most of what stops a model looking stamped out.
 */
function Puppy() {
  const tail = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (tail.current) tail.current.rotation.z = Math.sin(t * 7) * 0.5
    if (head.current) head.current.rotation.z = 0.12 + Math.sin(t * 0.9) * 0.06
  })
  return (
    <group>
      {/* haunches + chest */}
      <mesh position={[0, -0.12, -0.05]} scale={[1, 1, 1.1]} material={M.puppyFur}>
        <sphereGeometry args={[0.175, 18, 18]} />
      </mesh>
      <mesh position={[0, -0.05, 0.07]} scale={[0.92, 1.05, 0.85]} material={M.puppyFur}>
        <sphereGeometry args={[0.15, 18, 18]} />
      </mesh>
      <mesh position={[0, -0.08, 0.14]} scale={[0.6, 0.85, 0.5]} material={M.puppyBelly}>
        <sphereGeometry args={[0.14, 14, 14]} />
      </mesh>
      {/* front legs */}
      {[-0.075, 0.075].map((x) => (
        <group key={x}>
          <mesh position={[x, -0.19, 0.13]} material={M.puppyFur}>
            <capsuleGeometry args={[0.035, 0.1, 6, 10]} />
          </mesh>
          <mesh position={[x, -0.26, 0.17]} scale={[1, 0.7, 1.4]} material={M.puppyBelly}>
            <sphereGeometry args={[0.042, 10, 10]} />
          </mesh>
        </group>
      ))}
      {/* tail */}
      <group ref={tail} position={[0, -0.14, -0.18]}>
        <mesh position={[0, 0.07, -0.03]} rotation={[0.5, 0, 0]} material={M.puppyFur}>
          <capsuleGeometry args={[0.028, 0.12, 6, 10]} />
        </mesh>
      </group>
      {/* head: skull, muzzle, nose */}
      <group ref={head} position={[0, 0.16, 0.08]}>
        <mesh scale={[1, 0.95, 1]} material={M.puppyFur}>
          <sphereGeometry args={[0.13, 20, 20]} />
        </mesh>
        <mesh position={[0, -0.045, 0.1]} scale={[0.75, 0.65, 0.95]} material={M.puppyBelly}>
          <sphereGeometry args={[0.085, 16, 16]} />
        </mesh>
        <mesh position={[0, -0.03, 0.175]} scale={[1.25, 0.9, 0.8]} material={M.noseDark}>
          <sphereGeometry args={[0.03, 12, 12]} />
        </mesh>
        {/* the patch, over one eye only */}
        <mesh position={[-0.07, 0.03, 0.095]} scale={[0.75, 0.7, 0.5]} material={M.puppyPatch}>
          <sphereGeometry args={[0.075, 14, 14]} />
        </mesh>
        <Eyes y={0.035} z={0.113} r={0.03} spread={0.062} />
        {/* floppy ears, hanging from the sides of the skull */}
        {[-1, 1].map((s) => (
          <mesh
            key={s}
            position={[s * 0.115, -0.01, -0.01]}
            rotation={[0.15, 0, s * 0.25]}
            scale={[0.42, 1.25, 0.72]}
            material={M.puppyPatch}
          >
            <sphereGeometry args={[0.095, 14, 14]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/* ---- kitten --------------------------------------------------------------
 * Tabby: striped back and tail, white chest and paws, upright triangular ears,
 * whiskers. The tail curls slowly, which is the cat-specific motion.
 */
function Kitten() {
  const tail = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (tail.current) tail.current.rotation.x = -0.6 + Math.sin(state.clock.elapsedTime * 1.6) * 0.3
  })
  return (
    <group>
      <mesh position={[0, -0.11, -0.03]} scale={[1, 1, 1.15]} material={M.kittenFur}>
        <sphereGeometry args={[0.16, 18, 18]} />
      </mesh>
      <mesh position={[0, -0.07, 0.09]} scale={[0.7, 0.95, 0.6]} material={kittenBelly}>
        <sphereGeometry args={[0.145, 16, 16]} />
      </mesh>
      {/* Tabby stripes: thin BANDS wrapping over the spine, not spots. Drawn as
          flattened torus arcs following the back's curve, which is what reads
          as a stripe at any viewing angle — three ellipsoids laid on top just
          looked like a dalmatian. */}
      {[
        { z: -0.12, y: 0.022, w: 0.72 },
        { z: -0.03, y: 0.042, w: 0.82 },
        { z: 0.06, y: 0.022, w: 0.72 },
      ].map((s, i) => (
        // Bedded INTO the back rather than wrapped around it: a flattened bar
        // mostly buried in the body, so only the crown of each shows. A ring
        // round the barrel kept breaking out through the flanks, because the
        // ring is circular and the body is an ellipse.
        <mesh key={i} position={[0, s.y, s.z]} scale={[s.w, 0.1, 0.09]} material={kittenStripe}>
          <sphereGeometry args={[0.16, 14, 10]} />
        </mesh>
      ))}
      {/* white front paws */}
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, -0.23, 0.13]} scale={[1, 0.65, 1.5]} material={kittenBelly}>
          <sphereGeometry args={[0.042, 12, 12]} />
        </mesh>
      ))}
      {/* curling tail */}
      <group ref={tail} position={[0, -0.13, -0.18]} rotation={[-0.6, 0, 0]}>
        <mesh position={[0, 0.1, 0]} material={M.kittenFur}>
          <capsuleGeometry args={[0.026, 0.2, 6, 10]} />
        </mesh>
        <mesh position={[0, 0.22, 0]} material={kittenBelly}>
          <sphereGeometry args={[0.028, 10, 10]} />
        </mesh>
      </group>
      {/* head: rounder than a cat's, as kittens are */}
      <group position={[0, 0.15, 0.07]}>
        <mesh scale={[1, 0.92, 0.95]} material={M.kittenFur}>
          <sphereGeometry args={[0.12, 20, 20]} />
        </mesh>
        <mesh position={[0, -0.04, 0.09]} scale={[0.9, 0.6, 0.6]} material={kittenBelly}>
          <sphereGeometry args={[0.075, 14, 14]} />
        </mesh>
        <mesh position={[0, -0.018, 0.125]} scale={[1.3, 0.8, 0.7]} material={M.nosePink}>
          <sphereGeometry args={[0.019, 10, 10]} />
        </mesh>
        <Eyes y={0.03} z={0.1} r={0.031} spread={0.057} />
        <Whiskers y={-0.02} z={0.115} spread={0.04} />
        {/* triangular ears with pink inners */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.075, 0.1, -0.005]} rotation={[0, 0, s * 0.28]}>
            <mesh material={M.kittenFur}>
              <coneGeometry args={[0.05, 0.1, 4]} />
            </mesh>
            <mesh position={[0, -0.005, 0.022]} scale={[0.6, 0.7, 0.6]} material={M.bunnyInnerEar}>
              <coneGeometry args={[0.05, 0.1, 4]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/* ---- squirrel ------------------------------------------------------------
 * Sitting up with a nut in its paws and that enormous S-curved tail — the tail
 * IS the squirrel, so it gets built in three tapering segments, not one blob.
 */
function Squirrel() {
  const tail = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (tail.current) tail.current.rotation.x = Math.sin(state.clock.elapsedTime * 2.4) * 0.12
  })
  return (
    <group>
      {/* upright body */}
      <mesh position={[0, -0.08, 0.01]} scale={[0.85, 1.15, 0.85]} material={M.squirrelFur}>
        <sphereGeometry args={[0.14, 18, 18]} />
      </mesh>
      <mesh position={[0, -0.07, 0.08]} scale={[0.6, 1, 0.5]} material={M.squirrelBelly}>
        <sphereGeometry args={[0.13, 16, 16]} />
      </mesh>
      {/* The tail IS the squirrel, so it is built as a question-mark plume that
          rises ABOVE the head rather than tucking in behind the back — from
          the child's viewpoint a tail hidden behind the body reads as a lump,
          and the one silhouette that says "squirrel" is lost. Five tapering
          segments, swinging from the base. */}
      <group ref={tail} position={[0, -0.17, -0.09]}>
        {[
          { y: 0.04, z: -0.08, r: 0.085, rot: 0.8 },
          { y: 0.17, z: -0.15, r: 0.115, rot: 0.35 },
          { y: 0.33, z: -0.15, r: 0.13, rot: -0.1 },
          { y: 0.47, z: -0.08, r: 0.125, rot: -0.6 },
          { y: 0.55, z: 0.04, r: 0.1, rot: -1.05 },
        ].map((seg, i) => (
          // Each segment is a FLATTENED sphere, wide across and thin front to
          // back: a squirrel's tail is a plume held side-on, not a sausage.
          // Overlapping them generously is what makes it read as fur rather
          // than as beads on a string.
          <mesh
            key={i}
            position={[0, seg.y, seg.z]}
            rotation={[seg.rot, 0, 0]}
            scale={[0.62, 1.15, 1]}
            material={i >= 3 ? M.squirrelBelly : M.squirrelFur}
          >
            <sphereGeometry args={[seg.r, 14, 14]} />
          </mesh>
        ))}
      </group>
      {/* little paws, holding a nut at the chest */}
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, -0.04, 0.115]} material={M.squirrelFur}>
          <sphereGeometry args={[0.028, 10, 10]} />
        </mesh>
      ))}
      <mesh position={[0, -0.035, 0.14]} scale={[1, 1.2, 1]} material={M.seedHead}>
        <sphereGeometry args={[0.038, 12, 12]} />
      </mesh>
      {/* head with a blunt muzzle */}
      <group position={[0, 0.13, 0.04]}>
        <mesh scale={[0.95, 1, 0.95]} material={M.squirrelFur}>
          <sphereGeometry args={[0.1, 18, 18]} />
        </mesh>
        <mesh position={[0, -0.025, 0.08]} scale={[0.8, 0.65, 0.8]} material={M.squirrelBelly}>
          <sphereGeometry args={[0.06, 14, 14]} />
        </mesh>
        <mesh position={[0, -0.012, 0.122]} scale={[1.2, 0.8, 0.8]} material={M.noseDark}>
          <sphereGeometry args={[0.017, 10, 10]} />
        </mesh>
        <Eyes y={0.03} z={0.082} r={0.028} spread={0.05} />
        <Whiskers y={-0.015} z={0.11} spread={0.035} />
        {/* tufted ears */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.062, 0.09, -0.01]}>
            <mesh scale={[0.55, 1, 0.5]} material={M.squirrelFur}>
              <sphereGeometry args={[0.042, 10, 10]} />
            </mesh>
            <mesh position={[0, 0.04, 0]} material={M.squirrelFur}>
              <coneGeometry args={[0.018, 0.05, 6]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

/* ---- duckling ------------------------------------------------------------
 * Round, fluffy and yellow, with the flat bill and webbed feet that make it a
 * duck rather than a chick. It bobs, because ducklings never hold still.
 */
function Duckling() {
  const body = useRef<THREE.Group>(null)
  useFrame((state) => {
    if (body.current) body.current.position.y = Math.sin(state.clock.elapsedTime * 3.2) * 0.012
  })
  return (
    <group ref={body}>
      <mesh position={[0, -0.05, 0]} scale={[1, 0.92, 1.1]} material={M.ducklingDown}>
        <sphereGeometry args={[0.17, 20, 20]} />
      </mesh>
      {/* stubby wings */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.14, -0.04, -0.01]}
          rotation={[0, 0, -s * 0.2]}
          scale={[0.3, 0.85, 0.95]}
          material={M.ducklingWing}
        >
          <sphereGeometry args={[0.13, 14, 14]} />
        </mesh>
      ))}
      {/* little upturned tail */}
      <mesh position={[0, 0.0, -0.17]} rotation={[-0.6, 0, 0]} material={M.ducklingWing}>
        <coneGeometry args={[0.05, 0.1, 8]} />
      </mesh>
      {/* head on a short neck */}
      <mesh position={[0, 0.11, 0.045]} scale={[0.95, 1, 0.95]} material={M.ducklingDown}>
        <sphereGeometry args={[0.105, 18, 18]} />
      </mesh>
      {/* flat spatulate bill, upper and lower */}
      <mesh position={[0, 0.085, 0.145]} rotation={[1.5, 0, 0]} scale={[1, 1, 0.42]} material={M.bill}>
        <cylinderGeometry args={[0.042, 0.052, 0.075, 12]} />
      </mesh>
      <mesh position={[0, 0.072, 0.142]} rotation={[1.5, 0, 0]} scale={[0.9, 1, 0.3]} material={M.noseDark}>
        <cylinderGeometry args={[0.04, 0.048, 0.072, 12]} />
      </mesh>
      <Eyes y={0.135} z={0.082} r={0.022} spread={0.05} />
      {/* webbed feet */}
      {[-0.055, 0.055].map((x) => (
        <mesh key={x} position={[x, -0.2, 0.05]} scale={[1, 0.3, 1.5]} material={M.bill}>
          <sphereGeometry args={[0.045, 10, 10]} />
        </mesh>
      ))}
    </group>
  )
}

/* ---- ladybird ------------------------------------------------------------
 * Glossy domed shell split down the middle into two elytra, seven black spots,
 * small head with feelers, six legs. Sits on a leaf so it is not floating.
 */
function Ladybird() {
  const spots: [number, number, number][] = [
    [0.07, 0.05, 0.02],
    [-0.07, 0.05, 0.02],
    [0.1, -0.02, -0.05],
    [-0.1, -0.02, -0.05],
    [0.05, 0.02, -0.12],
    [-0.05, 0.02, -0.12],
    [0, 0.08, 0.08],
  ]
  return (
    <group>
      {/* the leaf it rests on */}
      <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0.3]} scale={[1.5, 1.05, 1]} material={M.leaf}>
        <circleGeometry args={[0.24, 16]} />
      </mesh>
      {/* domed shell, in two halves with a seam */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 0.013, 0.02, -0.01]}
          scale={[0.95, 0.82, 1.12]}
          material={M.ladyRed}
        >
          <sphereGeometry args={[0.165, 20, 20, 0, Math.PI, 0, Math.PI]} />
        </mesh>
      ))}
      <mesh position={[0, 0.021, -0.01]} scale={[0.04, 0.84, 1.13]} material={M.ladyBlack}>
        <sphereGeometry args={[0.165, 12, 12, 0, Math.PI, 0, Math.PI]} />
      </mesh>
      {/* the spots, sitting proud of the shell */}
      {spots.map((p, i) => (
        <mesh key={i} position={[p[0], 0.02 + p[1] * 0.55, p[2]]} scale={[1, 0.5, 1]} material={M.ladyBlack}>
          <sphereGeometry args={[0.028, 10, 10]} />
        </mesh>
      ))}
      {/* head and pronotum */}
      <mesh position={[0, 0.015, 0.145]} scale={[1, 0.7, 0.75]} material={M.ladyBlack}>
        <sphereGeometry args={[0.075, 14, 14]} />
      </mesh>
      <Eyes y={0.035} z={0.185} r={0.016} spread={0.038} />
      {/* feelers */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.035, 0.045, 0.205]} rotation={[0.7, 0, -s * 0.4]} material={M.ladyBlack}>
          <cylinderGeometry args={[0.005, 0.004, 0.075, 5]} />
        </mesh>
      ))}
      {/* six legs */}
      {[-1, 1].map((s) =>
        [0.1, 0.0, -0.1].map((z, i) => (
          <mesh
            key={`${s}-${i}`}
            position={[s * 0.14, -0.045, z]}
            rotation={[0, 0, s * 0.9]}
            material={M.ladyBlack}
          >
            <cylinderGeometry args={[0.007, 0.005, 0.085, 5]} />
          </mesh>
        )),
      )}
    </group>
  )
}

/* ---- peacock -------------------------------------------------------------
 * The showpiece: a fanned train of eyed feathers behind an iridescent blue
 * body, with the three-feather crest. The fan opens and closes slowly, which
 * is the single most delightful thing in the set to come across.
 */
function Peacock() {
  const fan = useRef<THREE.Group>(null)
  useFrame((state) => {
    // breathe the fan open and shut rather than holding it rigid
    const s = 0.88 + Math.sin(state.clock.elapsedTime * 0.7) * 0.12
    if (fan.current) fan.current.scale.set(s, s, 1)
  })
  // A real train dwarfs the bird — roughly twice its height, in a near-half
  // circle. Scaled to that: 21 feathers across ±1.45 rad, reaching 0.78 at the
  // centre. The first attempt gave it a 0.42 fan behind a 0.13 body, which read
  // as a small comb rather than the thing a child gasps at.
  const feathers = Array.from({ length: 21 }, (_, i) => ((i - 10) / 10) * 1.45)
  return (
    <group>
      {/* the train, set well behind the bird so the body reads in front of it */}
      <group ref={fan} position={[0, 0.05, -0.16]}>
        {feathers.map((a, i) => {
          // longest in the middle, shortening toward the edges, as a fan does
          const len = 0.78 - Math.abs(a) * 0.13
          return (
            <group key={i} rotation={[0, 0, a]}>
              {/* shaft */}
              <mesh position={[0, len * 0.5, 0]} material={M.peacockTeal}>
                <cylinderGeometry args={[0.005, 0.009, len, 5]} />
              </mesh>
              {/* barbs: a soft blade of feather along the upper shaft */}
              <mesh position={[0, len * 0.76, -0.004]} scale={[0.38, 1, 0.1]} material={M.peacockTeal}>
                <sphereGeometry args={[0.1, 10, 10]} />
              </mesh>
              {/* the eye at the tip: gold ring, blue heart, dark pupil */}
              <mesh position={[0, len, 0.004]} scale={[1, 1.2, 0.22]} material={M.peacockGold}>
                <sphereGeometry args={[0.058, 12, 12]} />
              </mesh>
              <mesh position={[0, len, 0.016]} scale={[1, 1.15, 0.22]} material={M.peacockEye}>
                <sphereGeometry args={[0.036, 12, 12]} />
              </mesh>
              <mesh position={[0, len + 0.004, 0.026]} scale={[1, 1.1, 0.22]} material={M.peacockBlue}>
                <sphereGeometry args={[0.019, 10, 10]} />
              </mesh>
            </group>
          )
        })}
      </group>
      {/* Body, then a LONG neck. A peacock's neck is nearly as long as its
          body and is the line that makes the silhouette regal — set the head
          straight on the shoulders and it reads as a duck. The teal breast is
          blended in as an overlapping mass rather than butted against the
          blue, which left a hard seam down the front. */}
      <mesh position={[0, -0.09, 0.02]} scale={[0.88, 1.05, 0.95]} material={M.peacockBlue}>
        <sphereGeometry args={[0.135, 18, 18]} />
      </mesh>
      <mesh position={[0, -0.1, 0.075]} scale={[0.7, 0.92, 0.6]} material={M.peacockTeal}>
        <sphereGeometry args={[0.125, 16, 16]} />
      </mesh>
      {/* the long neck, leaning forward */}
      <mesh position={[0, 0.07, 0.055]} rotation={[-0.22, 0, 0]} material={M.peacockBlue}>
        <capsuleGeometry args={[0.038, 0.17, 8, 12]} />
      </mesh>
      {/* shoulder fillet, so the neck grows out of the body */}
      <mesh position={[0, -0.02, 0.04]} scale={[0.75, 0.7, 0.75]} material={M.peacockBlue}>
        <sphereGeometry args={[0.085, 14, 14]} />
      </mesh>
      {/* head */}
      <group position={[0, 0.23, 0.085]}>
        <mesh scale={[0.9, 1, 0.9]} material={M.peacockBlue}>
          <sphereGeometry args={[0.062, 16, 16]} />
        </mesh>
        <mesh position={[0, -0.005, 0.07]} rotation={[1.5, 0, 0]} material={M.peacockGold}>
          <coneGeometry args={[0.018, 0.055, 8]} />
        </mesh>
        <Eyes y={0.015} z={0.05} r={0.015} spread={0.04} />
        {/* the crest: three stalked feathers */}
        {[-0.022, 0, 0.022].map((x, i) => (
          <group key={i} position={[x, 0.06, 0]} rotation={[0, 0, -x * 8]}>
            <mesh position={[0, 0.03, 0]} material={peacockCrest}>
              <cylinderGeometry args={[0.0035, 0.0035, 0.06, 4]} />
            </mesh>
            <mesh position={[0, 0.065, 0]} scale={[1, 1.3, 0.4]} material={peacockCrest}>
              <sphereGeometry args={[0.016, 8, 8]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* legs */}
      {[-0.045, 0.045].map((x) => (
        <mesh key={x} position={[x, -0.2, 0.04]} material={M.parrotBeak}>
          <cylinderGeometry args={[0.011, 0.011, 0.11, 6]} />
        </mesh>
      ))}
    </group>
  )
}

/** Pick the model for a surprise. */
export function SurpriseModel({ id }: { id: DiscoveryId }) {
  switch (id) {
    case 'butterfly':
      return <Butterfly />
    case 'bunny':
      return <Bunny />
    case 'parrot':
      return <Parrot />
    case 'sunflower':
      return <Sunflower />
    case 'puppy':
      return <Puppy />
    case 'kitten':
      return <Kitten />
    case 'squirrel':
      return <Squirrel />
    case 'duckling':
      return <Duckling />
    case 'ladybird':
      return <Ladybird />
    case 'peacock':
      return <Peacock />
  }
}
