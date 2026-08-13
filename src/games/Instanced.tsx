import { useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

/**
 * Draws many fixed copies of one shape in a single draw call.
 *
 * The 360 scenes are built from hundreds of individual `<mesh>`es, each with
 * its own geometry AND its own material, so each one costs a draw call —
 * doubled per eye inside a headset. Scenery the child never interacts with was
 * most of that budget, and a headset that misses its frame deadline samples
 * input late, which is what makes a press feel unanswered.
 *
 * The children are the ordinary `<geometry>` / `<material>` elements the mesh
 * would have had, so converting a group of meshes to instances stays a local
 * change: the shape and the look remain written where they were.
 *
 * Only for scenery that never moves — the transforms are written once on mount.
 * Anything articulated or animated (the kids, the blocks in a tower) wants to
 * stay an ordinary mesh.
 */

/** one placed copy of an instanced shape */
export interface Placement {
  pos: [number, number, number]
  /** yaw in radians; ignored when `rot` is given */
  rotY?: number
  /** full euler rotation, for copies that need more than a yaw */
  rot?: [number, number, number]
  /** uniform scale */
  scale?: number
  /** per-instance tint; only meaningful when the material is left uncoloured */
  color?: string
}

const UP_AXIS = new THREE.Vector3(0, 1, 0)

export function Instanced({ items, children }: { items: Placement[]; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const p = new THREE.Vector3()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    const s = new THREE.Vector3()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      p.set(it.pos[0], it.pos[1], it.pos[2])
      if (it.rot != null) q.setFromEuler(e.set(it.rot[0], it.rot[1], it.rot[2]))
      else q.setFromAxisAngle(UP_AXIS, it.rotY ?? 0)
      s.setScalar(it.scale ?? 1)
      mesh.setMatrixAt(i, m.compose(p, q, s))
      if (it.color != null) mesh.setColorAt(i, c.set(it.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Recompute the bounds now that the copies are actually placed.
    //
    // Frustum culling tests an InstancedMesh against a bounding sphere derived
    // from its instance matrices, and three caches that sphere the first time
    // it needs it. That first test happens on the frame the mesh mounts —
    // before this effect has run — so the cached sphere is the one implied by
    // the zeroed matrices: a dot at the origin. The whole batch then gets
    // culled the moment that dot leaves the view, and every copy disappears at
    // once, however much of the room they actually cover. That is exactly what
    // happened to the playroom's bunting. Clearing it forces an honest recompute.
    mesh.computeBoundingSphere()
  }, [items])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      {children}
    </instancedMesh>
  )
}
