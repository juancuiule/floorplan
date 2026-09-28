import * as THREE from 'three'

// Procedural canvas textures, kept pale on purpose. Each texture covers a
// known real-world size so it can be repeated per surface in meters.

export interface Pattern {
  texture: THREE.CanvasTexture
  /** Real-world size one texture repeat covers: [along x, along z]. */
  size: [number, number]
}

const PX_PER_M = 700
const cache = new Map<string, Pattern>()

function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function shade(hex: string, amount: number) {
  const c = new THREE.Color(hex)
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amount)))
  return `#${c.getHexString()}`
}

function finish(canvas: HTMLCanvasElement, size: [number, number]): Pattern {
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { texture, size }
}

/** Oak planks running along x, staggered. */
export function planks(base: string, plankW = 0.19, plankL = 1.2, rows = 5): Pattern {
  const key = `planks:${base}:${plankW}:${plankL}:${rows}`
  const hit = cache.get(key)
  if (hit) return hit
  const size: [number, number] = [plankL * 2, plankW * rows]
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size[0] * PX_PER_M)
  canvas.height = Math.round(size[1] * PX_PER_M)
  const g = canvas.getContext('2d')!
  const r = rand(7)
  const pw = plankW * PX_PER_M
  const pl = plankL * PX_PER_M
  const offsets = [0, 0.5, 0.25, 0.75, 0.4, 0.9, 0.15]
  for (let row = 0; row < rows; row++) {
    const y = row * pw
    const start = -offsets[row % offsets.length] * pl
    for (let x = start; x < canvas.width; x += pl) {
      // A plank starting left of 0 wraps around to the right edge.
      const copies = x < 0 ? [x, x + canvas.width] : [x]
      g.fillStyle = shade(base, (r() - 0.5) * 0.05)
      for (const cx of copies) g.fillRect(cx, y, pl, pw)
      g.globalAlpha = 0.05
      g.fillStyle = shade(base, -0.25)
      for (let k = 0; k < 6; k++) {
        const gy = y + r() * pw
        const gh = 1 + r() * 1.5
        for (const cx of copies) g.fillRect(cx, gy, pl, gh)
      }
      g.globalAlpha = 1
      g.fillStyle = shade(base, -0.14)
      g.fillRect(((x % canvas.width) + canvas.width) % canvas.width, y, 2, pw)
    }
    g.fillStyle = shade(base, -0.12)
    g.fillRect(0, y, canvas.width, 2)
  }
  const p = finish(canvas, size)
  cache.set(key, p)
  return p
}

/** Square or rectangular tiles with thin grout lines. */
export function tiles(base: string, grout: string, tileW: number, tileH: number): Pattern {
  const key = `tiles:${base}:${grout}:${tileW}:${tileH}`
  const hit = cache.get(key)
  if (hit) return hit
  const size: [number, number] = [tileW * 2, tileH * 2]
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size[0] * PX_PER_M)
  canvas.height = Math.round(size[1] * PX_PER_M)
  const g = canvas.getContext('2d')!
  const r = rand(3)
  const tw = tileW * PX_PER_M
  const th = tileH * PX_PER_M
  g.fillStyle = grout
  g.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = shade(base, (r() - 0.5) * 0.02)
      g.fillRect(i * tw + 1.5, j * th + 1.5, tw - 3, th - 3)
    }
  const p = finish(canvas, size)
  cache.set(key, p)
  return p
}
