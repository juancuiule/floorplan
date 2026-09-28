import * as THREE from 'three'
import type { MaterialDef, Vec3 } from '../model/types'
import { project } from '../project'
import { planks, tiles, type Pattern } from './patterns'

export const EDGE_COLOR = '#5f5a52'

/** Real-world [u, v] extent of the largest face of a box, for pattern repeats. */
export function faceDims([sx, sy, sz]: Vec3): [number, number] {
  if (sy <= sx && sy <= sz) return [sx, sz]
  if (sx <= sz) return [sz, sy]
  return [sx, sy]
}

function patternFor(def: MaterialDef): Pattern | null {
  const p = def.pattern
  if (!p) return null
  if (p.kind === 'planks') return planks(def.color, p.width, p.length)
  return tiles(def.color, p.grout, p.width, p.height)
}

/**
 * A fresh material. Pass the surface's real-world `dims` to get its pattern
 * (planks, tiles) repeated at true scale; without dims the plain color is used.
 */
export function makeMaterial(id: string, dims?: [number, number]): THREE.MeshStandardMaterial {
  const def: MaterialDef = project.materials[id] ?? { color: '#ff00ff' }
  const opacity = def.opacity ?? 1
  const pattern = dims ? patternFor(def) : null
  let map: THREE.Texture | null = null
  if (pattern && dims) {
    map = pattern.texture.clone()
    map.repeat.set(dims[0] / pattern.size[0], dims[1] / pattern.size[1])
    map.needsUpdate = true
  }
  const m = new THREE.MeshStandardMaterial({
    map,
    color: map ? '#ffffff' : def.color,
    roughness: def.roughness ?? 0.8,
    metalness: def.metalness ?? 0,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
  })
  if (def.emissive) {
    m.emissive = new THREE.Color(def.emissive)
    m.emissiveIntensity = 1.2
  }
  m.userData.baseOpacity = opacity
  return m
}

export function makeEdgeMaterial(opacity = 0.55): THREE.LineBasicMaterial {
  const m = new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity })
  m.userData.baseOpacity = opacity
  return m
}

const shared = new Map<string, THREE.MeshStandardMaterial>()

/** Cached material for things that never fade (fixtures, floors). */
export function sharedMaterial(id: string): THREE.MeshStandardMaterial {
  let m = shared.get(id)
  if (!m) {
    m = makeMaterial(id)
    shared.set(id, m)
  }
  return m
}

let sharedEdges: THREE.LineBasicMaterial | undefined
export function sharedEdgeMaterial(): THREE.LineBasicMaterial {
  sharedEdges ??= makeEdgeMaterial(0.45)
  return sharedEdges
}

/** Sets a fade factor (0–1) on materials that remember their base opacity. */
export function applyFade(mats: Iterable<THREE.Material>, alpha: number) {
  for (const m of mats) {
    const base = (m.userData.baseOpacity as number | undefined) ?? 1
    const o = base * alpha
    const transparent = o < 0.999
    if (m.transparent !== transparent) {
      m.transparent = transparent
      m.needsUpdate = true
    }
    m.opacity = o
    m.depthWrite = !transparent
    m.visible = o > 0.005
  }
}
