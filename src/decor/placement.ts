import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { DecorItem, Facing } from '../model/decor'
import type { Vec3 } from '../model/types'
import { project } from '../project'
import { LAMPS, PLANTS, type Mount } from './catalog'

export interface SurfaceHit {
  point: THREE.Vector3
  /** World-space face normal. */
  normal: THREE.Vector3
  kind: 'wall' | 'up' | 'down'
  host?: string
}

const tmpNormal = new THREE.Vector3()

/** Reads the surface under the pointer; null when the hit mesh is hidden (a faded wall). */
export function readHit(e: ThreeEvent<PointerEvent | MouseEvent>): SurfaceHit | null {
  const obj = e.object as THREE.Mesh
  const mat = obj.material as THREE.Material | undefined
  if (!obj.visible || (mat && !mat.visible) || !e.face) return null
  tmpNormal.copy(e.face.normal).transformDirection(obj.matrixWorld)
  let host: string | undefined
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
    if (o.userData.host) {
      host = o.userData.host as string
      break
    }
  }
  const kind = tmpNormal.y > 0.7 ? 'up' : tmpNormal.y < -0.7 ? 'down' : Math.abs(tmpNormal.y) < 0.3 ? 'wall' : null
  if (!kind) return null
  return { point: e.point.clone(), normal: tmpNormal.clone(), kind, host }
}

export function facingOf(n: THREE.Vector3): Facing {
  if (Math.abs(n.x) >= Math.abs(n.z)) return n.x >= 0 ? 'x+' : 'x-'
  return n.z >= 0 ? 'z+' : 'z-'
}

export const facingRotation: Record<Facing, number> = {
  'z+': 0,
  'x+': Math.PI / 2,
  'z-': Math.PI,
  'x-': -Math.PI / 2,
}

/** Horizontal unit vector along the wall for a facing (the item's local +x). */
export function alongWall(f: Facing): [number, number] {
  const r = facingRotation[f]
  return [Math.cos(r), -Math.sin(r)]
}

export function ceilingAt(x: number, z: number): number {
  for (const c of project.shell.ceilings) {
    const [x0, z0, x1, z1] = c.rect
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return c.height
  }
  return 2.6
}

export function mountOf(item: DecorItem): Mount {
  if (item.kind === 'artwork') return 'wall'
  if (item.kind === 'plant') return PLANTS[item.species].mount
  return LAMPS[item.type].mount
}

const round = (v: number) => Math.round(v * 100) / 100
const vec = (p: THREE.Vector3): Vec3 => [round(p.x), round(p.y), round(p.z)]

/** The patch that moves `item` to the hit, or null if it cannot go there. */
export function placeAt(item: DecorItem, hit: SurfaceHit): Partial<DecorItem> | null {
  const mount = mountOf(item)
  if (mount === 'wall') {
    if (hit.kind !== 'wall') return null
    return { at: vec(hit.point), facing: facingOf(hit.normal), host: hit.host } as Partial<DecorItem>
  }
  if (mount === 'surface') {
    if (hit.kind !== 'up') return null
    return { at: vec(hit.point) }
  }
  const p = hit.point
  return { at: [round(p.x), ceilingAt(p.x, p.z), round(p.z)] }
}
