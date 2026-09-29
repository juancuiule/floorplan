import * as THREE from 'three'
import { firstSolid } from './decor/DecorLayer'

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()

/** The first surface the eye sees under a DOM pointer event (faded walls and helpers are looked past). */
export function pick(e: { clientX: number; clientY: number }, dom: HTMLElement, camera: THREE.Camera, scene: THREE.Scene): THREE.Intersection | null {
  const r = dom.getBoundingClientRect()
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  return firstSolid(raycaster.intersectObjects(scene.children, true)) ?? null
}

/** World-space normal of an intersection's face. */
export function worldNormal(i: THREE.Intersection): THREE.Vector3 {
  const n = i.face ? i.face.normal.clone() : new THREE.Vector3(0, 1, 0)
  return n.transformDirection(i.object.matrixWorld)
}
