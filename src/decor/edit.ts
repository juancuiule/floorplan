import * as THREE from 'three'
import { create } from 'zustand'
import type { SnapFace, SurfaceHit } from './placement'

// Transient editing state: what the pointer is over, what a drag is snapping to.
// Kept out of the decor store so none of it is saved or recorded in history.

export interface EditState {
  /** Decor item under the pointer (nearest visible one). */
  hoverId: string | null
  /** The pointer is over a surface where the moving item cannot go. */
  invalid: { point: THREE.Vector3; normal: THREE.Vector3 } | null
  /** Wall faces the moving floor piece is snapped against. */
  snap: SnapFace[]
  /** A rotate-ring gesture is in progress. */
  rotating: boolean
  /** The pointer is over the rotate handle. */
  handleHover: boolean
  set: (patch: Partial<Omit<EditState, 'set'>>) => void
}

export const useEdit = create<EditState>((set) => ({
  hoverId: null,
  invalid: null,
  snap: [],
  rotating: false,
  handleHover: false,
  set: (patch) => set(patch),
}))

/** Non-reactive bits the scene shares with DOM-side code (keyboard shortcuts, paste). */
export const editRefs: {
  camera: THREE.Camera | null
  /** Last surface under the pointer, and whether the pointer is over the canvas now. */
  lastHit: SurfaceHit | null
  lastFloorHit: SurfaceHit | null
  pointerInCanvas: boolean
} = { camera: null, lastHit: null, lastFloorHit: null, pointerInCanvas: false }

/** Camera-relative screen axes snapped to the nearest plan axis: [right, away] as [x, z] unit vectors. */
export function screenAxes(): { right: [number, number]; away: [number, number] } {
  const cam = editRefs.camera
  const f = new THREE.Vector3(0, 0, -1)
  if (cam) f.applyQuaternion(cam.quaternion)
  let fx = f.x
  let fz = f.z
  if (Math.abs(fx) < 1e-6 && Math.abs(fz) < 1e-6) {
    // Straight down: use the camera's up vector as "away".
    const u = new THREE.Vector3(0, 1, 0)
    if (cam) u.applyQuaternion(cam.quaternion)
    fx = u.x
    fz = u.z
  }
  const snap = (x: number, z: number): [number, number] => (Math.abs(x) >= Math.abs(z) ? [Math.sign(x) || 1, 0] : [0, Math.sign(z) || 1])
  const away = snap(fx, fz)
  const right = snap(-fz, fx)
  return { right, away }
}
