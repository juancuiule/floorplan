import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { PlantSpecies, PotStyle } from '../../model/decor'

// Procedural, stylized plants. Every species builds a handful of merged
// geometries (one per material) so a plant costs only a few draw calls.

export type PlantMat = 'leaf' | 'leafDark' | 'leafLight' | 'leafSilver' | 'stem' | 'trunk' | 'soil' | 'flower' | 'cactus' | 'pot' | 'cord'

export interface PlantPart {
  mat: PlantMat
  geometry: THREE.BufferGeometry
}

export interface PlantModel {
  parts: PlantPart[]
  /** Approximate height, for the panel. */
  height: number
}

// ---------- helpers ----------

export function seeded(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

type Rand = () => number
const range = (r: Rand, a: number, b: number) => a + (b - a) * r()
const UP = new THREE.Vector3(0, 1, 0)

class Bucket {
  private map = new Map<PlantMat, THREE.BufferGeometry[]>()
  add(mat: PlantMat, g: THREE.BufferGeometry) {
    const list = this.map.get(mat) ?? []
    // Normalize attributes so everything merges.
    const clean = g.index ? g.toNonIndexed() : g
    if (!clean.getAttribute('uv')) clean.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((clean.getAttribute('position').count) * 2), 2))
    list.push(clean)
    this.map.set(mat, list)
  }
  parts(): PlantPart[] {
    return [...this.map].map(([mat, list]) => ({ mat, geometry: mergeGeometries(list)! }))
  }
}

type LeafKind = 'oval' | 'lance' | 'heart' | 'split' | 'blade' | 'serrated'

/** A flat leaf pointing +y from its base at the origin, facing +z, bent by `curl`. */
function leaf(kind: LeafKind, len: number, wid: number, curl: number, fold = 0.25): THREE.BufferGeometry {
  const N = 14
  const right: THREE.Vector2[] = []
  for (let i = 0; i <= N; i++) {
    const t = i / N
    let r: number
    switch (kind) {
      case 'blade':
        r = (wid / 2) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1)), 0.4) * (1 - t * 0.6)
        break
      case 'lance':
        r = (wid / 2) * Math.sin(Math.PI * t) * (1 - t * 0.3)
        break
      case 'heart':
      case 'split':
        r = (wid / 2) * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1.05 - t * 0.35)
        if (kind === 'split' && i > 1 && i < N - 1 && i % 3 === 1) r *= 0.35
        break
      case 'serrated':
        r = (wid / 2) * Math.sin(Math.PI * t) * (i % 2 ? 0.55 : 1)
        break
      default:
        r = (wid / 2) * Math.sin(Math.PI * Math.pow(t, 0.9))
    }
    right.push(new THREE.Vector2(r, t * len))
  }
  const shape = new THREE.Shape()
  const baseNotch = kind === 'heart' || kind === 'split' ? len * 0.08 : 0
  shape.moveTo(0, baseNotch)
  for (const p of right) shape.lineTo(p.x, p.y)
  for (let i = right.length - 2; i >= 0; i--) shape.lineTo(-right[i].x, right[i].y)
  shape.lineTo(0, baseNotch)
  const g = new THREE.ShapeGeometry(shape, 2)
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const t = y / len
    // Bend toward +z along the length (droop when the leaf is pitched out) and fold along the midrib.
    pos.setZ(i, curl * len * t * t + fold * Math.abs(x))
  }
  g.computeVertexNormals()
  return g
}

/** Places a leaf so its length runs along `dir` and its face looks toward `faceHint`. */
function orient(g: THREE.BufferGeometry, origin: THREE.Vector3, dir: THREE.Vector3, faceHint: THREE.Vector3) {
  const y = dir.clone().normalize()
  let x = new THREE.Vector3().crossVectors(y, faceHint)
  if (x.lengthSq() < 1e-6) x = new THREE.Vector3().crossVectors(y, new THREE.Vector3(1, 0, 0))
  x.normalize()
  const z = new THREE.Vector3().crossVectors(x, y).normalize()
  const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(origin)
  return g.applyMatrix4(m)
}

/** A cylinder between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, seg = 6) {
  const len = a.distanceTo(b)
  const g = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true)
  g.translate(0, len / 2, 0)
  const q = new THREE.Quaternion().setFromUnitVectors(UP, b.clone().sub(a).normalize())
  g.applyQuaternion(q)
  g.translate(a.x, a.y, a.z)
  return g
}

function tube(points: THREE.Vector3[], r: number, seg = 16) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, 6, false)
}

/** Direction pitched `pitch` radians from vertical toward yaw `yaw`. */
function dirFrom(yaw: number, pitch: number) {
  return new THREE.Vector3(Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), Math.cos(yaw) * Math.sin(pitch))
}

// ---------- pots ----------

export interface PotSize {
  r: number
  h: number
}

export const POT_SIZES: Record<PlantSpecies, PotSize> = {
  monstera: { r: 0.17, h: 0.3 },
  fiddle: { r: 0.17, h: 0.32 },
  snake: { r: 0.12, h: 0.24 },
  palm: { r: 0.2, h: 0.34 },
  fern: { r: 0.15, h: 0.24 },
  olive: { r: 0.24, h: 0.4 },
  cactus: { r: 0.11, h: 0.18 },
  lavender: { r: 0.35, h: 0.22 },
  pothos: { r: 0.12, h: 0.14 },
}

function pot(b: Bucket, style: PotStyle, { r, h }: PotSize, box = false) {
  if (box) {
    const g = new THREE.BoxGeometry(r * 2, h, 0.22)
    g.translate(0, h / 2, 0)
    b.add('pot', g)
    const soil = new THREE.BoxGeometry(r * 2 - 0.03, 0.01, 0.19)
    soil.translate(0, h - 0.02, 0)
    b.add('soil', soil)
    return
  }
  const profile: THREE.Vector2[] = []
  if (style === 'terracotta') {
    profile.push(new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.72, 0), new THREE.Vector2(r * 0.9, h * 0.8), new THREE.Vector2(r * 1.02, h * 0.8), new THREE.Vector2(r * 1.02, h), new THREE.Vector2(r * 0.9, h), new THREE.Vector2(r * 0.86, h * 0.86))
  } else if (style === 'basket') {
    profile.push(new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.85, 0), new THREE.Vector2(r, h * 0.92), new THREE.Vector2(r * 1.02, h), new THREE.Vector2(r * 0.95, h))
  } else if (style === 'ceramic') {
    profile.push(new THREE.Vector2(0, 0), new THREE.Vector2(r * 0.7, 0), new THREE.Vector2(r * 0.98, h * 0.35), new THREE.Vector2(r, h * 0.75), new THREE.Vector2(r * 0.92, h), new THREE.Vector2(r * 0.86, h))
  } else {
    profile.push(new THREE.Vector2(0, 0), new THREE.Vector2(r, 0), new THREE.Vector2(r, h), new THREE.Vector2(r * 0.9, h))
  }
  b.add('pot', new THREE.LatheGeometry(profile, 28))
  const soil = new THREE.CircleGeometry(r * 0.88, 24)
  soil.rotateX(-Math.PI / 2)
  soil.translate(0, h - 0.025, 0)
  b.add('soil', soil)
}

// ---------- species ----------

export function buildPlant(species: PlantSpecies, potStyle: PotStyle, seed: string): PlantModel {
  const r = seeded(seed + species)
  const b = new Bucket()
  const ps = POT_SIZES[species]
  const soilY = ps.h - 0.025
  let height = 1

  switch (species) {
    case 'monstera': {
      pot(b, potStyle, ps)
      const count = 9
      for (let i = 0; i < count; i++) {
        const yaw = (i / count) * Math.PI * 2 + range(r, -0.3, 0.3)
        const pitch = range(r, 0.2, 0.75)
        const L = range(r, 0.35, 0.7)
        const base = new THREE.Vector3(range(r, -0.04, 0.04), soilY, range(r, -0.04, 0.04))
        const tip = base.clone().addScaledVector(dirFrom(yaw, pitch), L)
        b.add('stem', rod(base, tip, 0.009, 0.006))
        const out = dirFrom(yaw, Math.min(1.45, pitch + range(r, 0.6, 0.9)))
        const size = range(r, 0.26, 0.36)
        b.add(r() > 0.5 ? 'leafDark' : 'leaf', orient(leaf('split', size, size * 0.95, 0.25, 0.12), tip, out, UP))
      }
      height = 0.95
      break
    }

    case 'fiddle': {
      pot(b, potStyle, ps)
      const top = 1.25
      const lean = new THREE.Vector3(range(r, -0.05, 0.05), 0, range(r, -0.05, 0.05))
      const trunkTop = new THREE.Vector3(0, top, 0).add(lean)
      b.add('trunk', rod(new THREE.Vector3(0, soilY, 0), trunkTop, 0.022, 0.012, 8))
      const count = 24
      for (let i = 0; i < count; i++) {
        const t = 0.35 + (i / count) * 0.65
        const at = new THREE.Vector3(0, soilY, 0).lerp(trunkTop, t)
        const yaw = i * 2.4
        const pitch = range(r, 0.7, 1.25) - t * 0.3
        const size = range(r, 0.22, 0.3) * (1.1 - t * 0.3)
        b.add(r() > 0.4 ? 'leafDark' : 'leaf', orient(leaf('oval', size, size * 0.72, 0.15, 0.1), at, dirFrom(yaw, pitch), UP))
      }
      height = 1.45
      break
    }

    case 'snake': {
      pot(b, potStyle, ps)
      const count = 13
      for (let i = 0; i < count; i++) {
        const yaw = range(r, 0, Math.PI * 2)
        const base = new THREE.Vector3(Math.sin(yaw) * range(r, 0, 0.07), soilY, Math.cos(yaw) * range(r, 0, 0.07))
        const L = range(r, 0.4, 0.75)
        const face = new THREE.Vector3(Math.sin(yaw + 1.5), 0, Math.cos(yaw + 1.5))
        b.add(r() > 0.35 ? 'leafDark' : 'leafLight', orient(leaf('blade', L, range(r, 0.05, 0.08), 0.04, 0.35), base, dirFrom(yaw, range(r, 0.03, 0.22)), face))
      }
      height = 0.75
      break
    }

    case 'palm': {
      pot(b, potStyle, ps)
      const stems = 7
      for (let i = 0; i < stems; i++) {
        const yaw = (i / stems) * Math.PI * 2 + range(r, -0.3, 0.3)
        let pitch = range(r, 0.15, 0.45)
        const L = range(r, 0.8, 1.15)
        const steps = 12
        const pts: THREE.Vector3[] = [new THREE.Vector3(range(r, -0.03, 0.03), soilY, range(r, -0.03, 0.03))]
        const dirs: THREE.Vector3[] = []
        for (let s = 0; s < steps; s++) {
          const d = dirFrom(yaw, pitch)
          dirs.push(d)
          pts.push(pts[pts.length - 1].clone().addScaledVector(d, L / steps))
          pitch += 0.11
        }
        b.add('stem', tube(pts, 0.006, 20))
        const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw))
        for (let s = 3; s < steps; s++) {
          const scale = 1 - Math.abs(s - steps * 0.55) / steps
          for (const sgn of [1, -1]) {
            const dir = side.clone().multiplyScalar(sgn).addScaledVector(dirs[s], 0.5).add(new THREE.Vector3(0, -0.35, 0))
            b.add('leaf', orient(leaf('lance', 0.22 * scale + 0.05, 0.028, 0.25, 0.3), pts[s], dir, UP))
          }
        }
      }
      height = 1.2
      break
    }

    case 'fern': {
      pot(b, potStyle, ps)
      const count = 24
      for (let i = 0; i < count; i++) {
        const yaw = range(r, 0, Math.PI * 2)
        const pitch = range(r, 0.35, 1.15)
        const base = new THREE.Vector3(range(r, -0.03, 0.03), soilY, range(r, -0.03, 0.03))
        b.add(r() > 0.5 ? 'leafLight' : 'leaf', orient(leaf('serrated', range(r, 0.38, 0.55), range(r, 0.09, 0.13), 0.55, 0.15), base, dirFrom(yaw, pitch), UP))
      }
      height = 0.5
      break
    }

    case 'olive': {
      pot(b, potStyle, ps)
      const pts = [new THREE.Vector3(0, soilY, 0)]
      for (let i = 1; i <= 5; i++) pts.push(new THREE.Vector3(range(r, -0.05, 0.05), soilY + i * 0.2, range(r, -0.05, 0.05)))
      b.add('trunk', tube(pts, 0.03, 24))
      const crown = pts[pts.length - 1]
      const blobs = 10
      for (let i = 0; i < blobs; i++) {
        const yaw = range(r, 0, Math.PI * 2)
        const d = range(r, 0.08, 0.3)
        const c = crown.clone().add(new THREE.Vector3(Math.sin(yaw) * d, range(r, -0.05, 0.35), Math.cos(yaw) * d))
        b.add('trunk', rod(crown.clone().setY(crown.y - 0.15), c, 0.012, 0.006))
        const g = new THREE.IcosahedronGeometry(range(r, 0.12, 0.2), 1)
        g.scale(1, 0.75, 1)
        g.translate(c.x, c.y, c.z)
        b.add(r() > 0.35 ? 'leafSilver' : 'leaf', g)
      }
      height = 1.5
      break
    }

    case 'cactus': {
      pot(b, potStyle, ps)
      const body = new THREE.CapsuleGeometry(0.055, 0.42, 6, 12)
      body.translate(0, soilY + 0.26, 0)
      b.add('cactus', body)
      for (const [side, y, len] of [
        [1, 0.28, 0.16],
        [-1, 0.36, 0.12],
      ]) {
        const elbow = new THREE.CapsuleGeometry(0.035, 0.07, 4, 10)
        elbow.rotateZ(Math.PI / 2)
        elbow.translate(side * 0.08, soilY + y, 0)
        b.add('cactus', elbow)
        const arm = new THREE.CapsuleGeometry(0.035, len, 4, 10)
        arm.translate(side * 0.12, soilY + y + len / 2 + 0.02, 0)
        b.add('cactus', arm)
      }
      height = 0.62
      break
    }

    case 'lavender': {
      pot(b, potStyle, ps, true)
      for (let i = 0; i < 16; i++) {
        const g = new THREE.IcosahedronGeometry(range(r, 0.05, 0.08), 0)
        g.scale(1, 0.7, 1)
        g.translate(range(r, -0.3, 0.3), soilY + 0.04, range(r, -0.06, 0.06))
        b.add('leafSilver', g)
      }
      for (let i = 0; i < 70; i++) {
        const base = new THREE.Vector3(range(r, -0.31, 0.31), soilY, range(r, -0.07, 0.07))
        const tip = base.clone().addScaledVector(dirFrom(range(r, 0, 6.28), range(r, 0, 0.3)), range(r, 0.25, 0.42))
        b.add('stem', rod(base, tip, 0.003, 0.002, 4))
        const spike = new THREE.CapsuleGeometry(0.009, 0.06, 2, 5)
        spike.translate(tip.x, tip.y + 0.03, tip.z)
        b.add('flower', spike)
      }
      height = 0.6
      break
    }

    case 'pothos': {
      // Local origin is the ceiling hook; everything hangs below it.
      const drop = 0.62
      const potY = -drop - ps.h
      const potParts = new Bucket()
      pot(potParts, potStyle, ps)
      for (const part of potParts.parts()) {
        part.geometry.translate(0, potY, 0)
        b.add(part.mat, part.geometry)
      }
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2
        b.add('cord', rod(new THREE.Vector3(Math.sin(a) * ps.r * 0.95, potY + ps.h, Math.cos(a) * ps.r * 0.95), new THREE.Vector3(0, 0, 0), 0.003, 0.003, 4))
      }
      const vines = 8
      for (let i = 0; i < vines; i++) {
        const a = (i / vines) * Math.PI * 2 + range(r, -0.2, 0.2)
        const L = range(r, 0.35, 0.95)
        const start = new THREE.Vector3(Math.sin(a) * ps.r * 0.8, potY + ps.h, Math.cos(a) * ps.r * 0.8)
        const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
        const pts: THREE.Vector3[] = []
        for (let s = 0; s <= 10; s++) {
          const t = s / 10
          // Spill over the rim first, then fall mostly straight down.
          const spread = 0.1 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5) + 0.03 * t
          pts.push(start.clone().addScaledVector(out, spread).add(new THREE.Vector3(0, -L * Math.pow(t, 1.4) - 0.02, 0)))
        }
        b.add('stem', tube(pts, 0.003, 14))
        for (let s = 1; s <= 10; s++) {
          const p = pts[s]
          const dir = out.clone().multiplyScalar(range(r, -0.2, 1)).add(new THREE.Vector3(range(r, -0.6, 0.6), range(r, -0.6, 0.2), range(r, -0.6, 0.6)))
          b.add(r() > 0.5 ? 'leafLight' : 'leaf', orient(leaf('heart', range(r, 0.06, 0.09), 0.06, 0.2, 0.15), p, dir, out))
        }
      }
      height = 1.4
      break
    }
  }

  return { parts: b.parts(), height }
}
