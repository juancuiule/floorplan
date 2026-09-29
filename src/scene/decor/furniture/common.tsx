import { useMemo } from 'react'
import * as THREE from 'three'
import type { Vec3 } from '../../../model/types'
import { Box } from '../../Box'
import { sharedEdgeMaterial } from '../../materials'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { seeded } from '../plantGeometry'

// Shared building blocks for the furniture models.

/** Plywood / panel thickness. */
export const T = 0.018

const cache = new Map<string, THREE.MeshStandardMaterial>()

/** One cached material per color + finish, shared by every piece. */
export function mat(color: string, kind: 'wood' | 'metal' | 'fabric' | 'gloss' | 'matte' = 'wood'): THREE.MeshStandardMaterial {
  const key = `${color}|${kind}`
  let m = cache.get(key)
  if (!m) {
    const props: Record<typeof kind, THREE.MeshStandardMaterialParameters> = {
      wood: { roughness: 0.7 },
      metal: { roughness: 0.4, metalness: 0.6 },
      fabric: { roughness: 0.95 },
      gloss: { roughness: 0.2 },
      matte: { roughness: 0.85 },
    }
    m = new THREE.MeshStandardMaterial({ color, ...props[kind] })
    cache.set(key, m)
  }
  return m
}

interface BProps {
  s: Vec3
  p: Vec3
  m: THREE.Material
  r?: Vec3
  edges?: boolean
  shadow?: boolean
}

/** An outlined box: size, position, material. */
export function B({ s, p, m, r, edges = true, shadow = true }: BProps) {
  return <Box size={s} position={p} rotation={r} material={m} edgeMaterial={edges ? sharedEdgeMaterial() : undefined} castShadow={shadow} />
}

/** A cylinder between two points (legs, rods, rails). */
export function Rod({ a, b, radius, m, segments = 10 }: { a: Vec3; b: Vec3; radius: number; m: THREE.Material; segments?: number }) {
  const { position, quaternion, length } = useMemo(() => {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    return {
      length: dir.length(),
      position: va.clone().add(vb).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    }
  }, [a, b])
  return (
    <mesh position={position} quaternion={quaternion} material={m} castShadow>
      <cylinderGeometry args={[radius, radius, length, segments]} />
    </mesh>
  )
}

const BOOK_COLORS = ['#b34a3c', '#e2d4b7', '#2f4d6b', '#d7a13a', '#3f6b4f', '#f1ede4', '#6b3d57', '#1f2326', '#c97b4a', '#8aa3b8', '#e8e2d3', '#5a4632']

/**
 * A row of books filling a cell of the given size, standing on y = 0 and
 * centered on x, spines toward +z. Merged into one geometry with vertex colors.
 */
export function booksGeometry(w: number, h: number, d: number, seed: string): THREE.BufferGeometry | null {
  const r = seeded(seed)
  const parts: THREE.BufferGeometry[] = []
  let x = -w / 2 + 0.01
  const end = w / 2 - 0.01 - (r() > 0.5 ? w * 0.3 : 0.02)
  while (x < end) {
    const bw = 0.015 + r() * 0.03
    if (x + bw > end) break
    const bh = Math.min(h - 0.02, h * (0.62 + r() * 0.33))
    const bd = Math.min(d - 0.02, 0.15 + r() * 0.08)
    const g = new THREE.BoxGeometry(bw, bh, bd).toNonIndexed()
    g.translate(x + bw / 2, bh / 2, d / 2 - bd / 2 - 0.01)
    const c = new THREE.Color(BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)])
    const colors = new Float32Array(g.getAttribute('position').count * 3)
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i)
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    parts.push(g)
    x += bw + (r() > 0.9 ? 0.02 : 0.001)
  }
  if (!parts.length) return null
  const out = mergeBoxes(parts)
  parts.forEach((p) => p.dispose())
  return out
}

function mergeBoxes(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const total = parts.reduce((n, p) => n + p.getAttribute('position').count, 0)
  const out = new THREE.BufferGeometry()
  for (const name of ['position', 'normal', 'color'] as const) {
    const arr = new Float32Array(total * 3)
    let o = 0
    for (const p of parts) {
      const a = p.getAttribute(name).array as Float32Array
      arr.set(a, o)
      o += a.length
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3))
  }
  return out
}

export const bookMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })

export function Books({ w, h, d, seed, p }: { w: number; h: number; d: number; seed: string; p: Vec3 }) {
  const geometry = useMemo(() => booksGeometry(w, h, d, seed), [w, h, d, seed])
  if (!geometry) return null
  return <mesh geometry={geometry} material={bookMaterial} position={p} castShadow receiveShadow />
}

const softCache = new Map<string, THREE.BufferGeometry>()

/** Smooth normals across a box's face seams; keeps a (flat) uv so it batches with plain boxes. */
function smoothed(g: THREE.BufferGeometry): THREE.BufferGeometry {
  g.deleteAttribute('normal')
  g.deleteAttribute('uv')
  const out = mergeVertices(g, 1e-4)
  g.dispose()
  out.clearGroups()
  out.computeVertexNormals()
  out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.getAttribute('position').count * 2), 2))
  return out
}

/**
 * A plump pillow, w × h, t thick in the middle and thinning to a seam at the
 * edges, with slightly pinched corners. Centered on the origin, faces ±z.
 * Cached per size (shared, never disposed: a handful of sizes).
 */
export function pillowGeometry(w: number, h: number, t: number): THREE.BufferGeometry {
  const key = `p${w.toFixed(3)}|${h.toFixed(3)}|${t.toFixed(3)}`
  let g = softCache.get(key)
  if (g) return g
  const box = new THREE.BoxGeometry(1, 1, 1, 14, 14, 2)
  const pos = box.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) * 2
    const v = pos.getY(i) * 2
    const puff = Math.pow(Math.max(0, (1 - u * u) * (1 - v * v)), 0.45)
    pos.setXYZ(i, (pos.getX(i) * (1 - 0.07 * v * v)) * w, (pos.getY(i) * (1 - 0.07 * u * u)) * h, pos.getZ(i) * t * Math.max(0.12, puff))
  }
  g = smoothed(box)
  softCache.set(key, g)
  return g
}

/** A soft pillow (see pillowGeometry): position, rotation, material. */
export function Pillow({ s, p, r, m }: { s: Vec3; p: Vec3; r?: Vec3; m: THREE.Material }) {
  return <mesh geometry={pillowGeometry(s[0], s[1], s[2])} position={p} rotation={r} material={m} castShadow receiveShadow />
}

/**
 * An upholstered slab: w × h × d with rounded corners in plan and a soft
 * rounded edge, bottom on y = 0, centered on x and z. Cached per size.
 */
export function cushionGeometry(w: number, h: number, d: number, radius = 0.05): THREE.BufferGeometry {
  const key = `c${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${radius.toFixed(3)}`
  let g = softCache.get(key)
  if (g) return g
  const bevel = Math.min(h * 0.4, 0.02)
  const hw = w / 2 - bevel
  const hd = d / 2 - bevel
  const r = Math.max(0.001, Math.min(radius, hw, hd))
  const s = new THREE.Shape()
  s.moveTo(-hw + r, -hd)
  s.lineTo(hw - r, -hd)
  s.absarc(hw - r, -hd + r, r, -Math.PI / 2, 0, false)
  s.lineTo(hw, hd - r)
  s.absarc(hw - r, hd - r, r, 0, Math.PI / 2, false)
  s.lineTo(-hw + r, hd)
  s.absarc(-hw + r, hd - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(-hw, -hd + r)
  s.absarc(-hw + r, -hd + r, r, Math.PI, Math.PI * 1.5, false)
  const e = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 8 })
  // Shape in XY, extruded along z: lay it flat with the extrusion going up.
  e.rotateX(-Math.PI / 2)
  e.translate(0, bevel, 0)
  g = smoothed(e)
  softCache.set(key, g)
  return g
}

/** Dark oval finger-pull cut into a door. */
export function FingerHole({ p, vertical = true }: { p: Vec3; vertical?: boolean }) {
  return (
    <mesh position={p} rotation={[Math.PI / 2, 0, 0]} scale={vertical ? [1, 1, 2.2] : [2.2, 1, 1]} material={mat('#1b1714', 'matte')}>
      <cylinderGeometry args={[0.012, 0.012, 0.004, 16]} />
    </mesh>
  )
}
