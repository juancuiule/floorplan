import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { DecorItem, Facing, FurnitureItem } from '../model/decor'
import type { Vec3 } from '../model/types'
import { project } from '../project'
import { LAMPS, PLANTS, type Mount } from './catalog'
import { FURNITURE } from './furnitureCatalog'

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
  if (item.kind === 'furniture') return FURNITURE[item.type].mount
  return LAMPS[item.type].mount
}

const round = (v: number) => Math.round(v * 100) / 100
const vec = (p: THREE.Vector3): Vec3 => [round(p.x), round(p.y), round(p.z)]

/** The patch that moves `item` to the hit, or null if it cannot go there. */
export function placeAt(item: DecorItem, hit: SurfaceHit, opts: { free?: boolean } = {}): Partial<DecorItem> | null {
  const mount = mountOf(item)
  if (mount === 'wall') {
    if (hit.kind !== 'wall') return null
    const at = vec(hit.point)
    // Wall furniture is anchored by its bottom edge; center it on the pointer.
    if (item.kind === 'furniture') at[1] = round(Math.max(0, hit.point.y - item.size[1] / 2))
    return { at, facing: facingOf(hit.normal), host: hit.host } as Partial<DecorItem>
  }
  if (mount === 'surface') {
    if (hit.kind !== 'up') return null
    if (item.kind === 'furniture' && !opts.free && SNAPS.has(item.type) && hit.point.y < 0.05) {
      const snapped = snapToWalls(hit.point.x, hit.point.z, item)
      if (snapped) return { at: [snapped.x, round(hit.point.y), snapped.z], rotation: snapped.rotation } as Partial<FurnitureItem>
    }
    return { at: vec(hit.point) }
  }
  const p = hit.point
  return { at: [round(p.x), ceilingAt(p.x, p.z), round(p.z)] }
}

// ---------- wall snapping for floor furniture ----------

/** Pieces that belong against a wall. Tables, chairs and rugs stay free. */
const SNAPS = new Set<FurnitureItem['type']>(['platformBed', 'murphyBed', 'daybed', 'sofa', 'standingDesk', 'bookshelf', 'wardrobe', 'sideboard', 'blockShelf'])
const SNAP_REACH = 0.45
const GAP = 0.004

interface Face {
  /** The face is the plane `axis = coord`. */
  axis: 'x' | 'z'
  coord: number
  /** Which way the face looks along its axis. */
  normal: 1 | -1
  /** Extent along the other horizontal axis. */
  min: number
  max: number
}

let faces: Face[] | null = null
function wallFaces(): Face[] {
  if (faces) return faces
  faces = []
  for (const w of project.shell.walls) {
    const alongZ = Math.abs(w.a[0] - w.b[0]) < 1e-6
    const t = w.thickness / 2
    if (alongZ) {
      const [min, max] = [Math.min(w.a[1], w.b[1]), Math.max(w.a[1], w.b[1])]
      faces.push({ axis: 'x', coord: w.a[0] + t, normal: 1, min, max }, { axis: 'x', coord: w.a[0] - t, normal: -1, min, max })
    } else {
      const [min, max] = [Math.min(w.a[0], w.b[0]), Math.max(w.a[0], w.b[0])]
      faces.push({ axis: 'z', coord: w.a[1] + t, normal: 1, min, max }, { axis: 'z', coord: w.a[1] - t, normal: -1, min, max })
    }
  }
  return faces
}

/**
 * Backs the piece onto the nearest wall face within reach, turns it to face the
 * room, then slides it out of any perpendicular wall it would cut into.
 */
export function snapToWalls(x: number, z: number, item: FurnitureItem): { x: number; z: number; rotation: number } | null {
  const [w, , d] = item.size
  let best: { face: Face; dist: number } | null = null
  for (const f of wallFaces()) {
    const along = f.axis === 'x' ? z : x
    if (along < f.min - 0.05 || along > f.max + 0.05) continue
    const dist = ((f.axis === 'x' ? x : z) - f.coord) * f.normal
    if (dist < -0.05 || dist > d / 2 + SNAP_REACH) continue
    if (!best || dist < best.dist) best = { face: f, dist }
  }
  if (!best) return null
  const f = best.face
  const off = f.coord + f.normal * (d / 2 + GAP)
  let nx = f.axis === 'x' ? off : x
  let nz = f.axis === 'z' ? off : z
  // Piece's local +z points along the face normal: rotation = atan2(nx, nz) in degrees.
  const rotation = f.axis === 'x' ? (f.normal === 1 ? 90 : 270) : f.normal === 1 ? 0 : 180

  // Perpendicular walls: keep the piece's sides clear of them (fits into corners).
  const perp = f.axis === 'x' ? 'z' : 'x'
  const depthMin = Math.min(f.coord, off + f.normal * (d / 2))
  const depthMax = Math.max(f.coord, off + f.normal * (d / 2))
  for (const g of wallFaces()) {
    if (g.axis !== perp) continue
    if (g.max < depthMin || g.min > depthMax) continue
    const center = perp === 'x' ? nx : nz
    const gap = (center - g.coord) * g.normal - w / 2
    if (gap < -w / 2 || gap > 0.25) continue
    const fixed = g.coord + g.normal * (w / 2 + GAP)
    if (perp === 'x') nx = fixed
    else nz = fixed
  }
  return { x: round(nx), z: round(nz), rotation }
}
