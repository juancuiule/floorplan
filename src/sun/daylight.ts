// How the light looks for a sun elevation: noon → golden hour → twilight →
// night. Keyframes are interpolated linearly, so scrubbing the time blends
// smoothly. Pure: no scene access, safe to unit test.

import * as THREE from 'three'

/** Below this elevation it's night: lamps and downlights take over. */
export const NIGHT_BELOW = -4

export interface Daylight {
  sunIntensity: number
  sunColor: THREE.Color
  skyColor: THREE.Color
  groundColor: THREE.Color
  hemiIntensity: number
  ambient: number
  background: THREE.Color
  /** 0 in daylight, 1 at night: how much lamps' shades glow. */
  dusk: number
}

interface Key {
  el: number
  sun: number
  hemi: number
  ambient: number
  sky: string
  ground: string
  bg: string
}

// The top row is the old fixed "day" look; the bottom row the old "evening".
const KEYS: Key[] = [
  { el: -12, sun: 0, hemi: 0.12, ambient: 0.04, sky: '#9fb2d6', ground: '#2a2622', bg: '#1d1f24' },
  { el: -6, sun: 0, hemi: 0.22, ambient: 0.06, sky: '#7f90c0', ground: '#2f2b2a', bg: '#272b38' },
  { el: -3, sun: 0, hemi: 0.45, ambient: 0.14, sky: '#95a0cc', ground: '#4a4040', bg: '#454a5e' },
  { el: 0, sun: 0, hemi: 0.8, ambient: 0.26, sky: '#c8c0d6', ground: '#8a7666', bg: '#9d97a0' },
  { el: 3, sun: 1.3, hemi: 1.0, ambient: 0.36, sky: '#f1d9c6', ground: '#b49a80', bg: '#d6c5b6' },
  { el: 9, sun: 2.0, hemi: 1.22, ambient: 0.46, sky: '#faeadb', ground: '#c9b59c', bg: '#e4dbcf' },
  { el: 20, sun: 2.35, hemi: 1.42, ambient: 0.56, sky: '#ffffff', ground: '#d9cfc0', bg: '#ecebe7' },
  { el: 50, sun: 2.55, hemi: 1.5, ambient: 0.6, sky: '#ffffff', ground: '#d9cfc0', bg: '#ecebe7' },
]

// Correlated color temperature of direct sun by elevation (K).
const KELVIN: [el: number, k: number][] = [
  [0, 2000],
  [3, 2500],
  [8, 3300],
  [15, 4200],
  [25, 4900],
  [40, 5400],
  [60, 5700],
]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function piecewise<T>(table: T[], el: (t: T) => number, x: number): [T, T, number] {
  if (x <= el(table[0])) return [table[0], table[0], 0]
  for (let i = 1; i < table.length; i++) {
    const b = table[i]
    if (x <= el(b)) {
      const a = table[i - 1]
      return [a, b, (x - el(a)) / (el(b) - el(a))]
    }
  }
  const last = table[table.length - 1]
  return [last, last, 0]
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mixHex = (out: THREE.Color, a: string, b: string, t: number) => out.set(a).lerp(new THREE.Color(b), t)

/** Blackbody color (Tanner Helland's fit), as sRGB 0–1. */
export function kelvinToRgb(kelvin: number): [number, number, number] {
  const t = kelvin / 100
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * (t - 60) ** -0.0755148492
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)]
}

export function sunKelvin(elevation: number): number {
  const [a, b, t] = piecewise(KELVIN, (k) => k[0], elevation)
  return lerp(a[1], b[1], t)
}

export function daylight(elevation: number, out?: Daylight): Daylight {
  const d = out ?? {
    sunIntensity: 0,
    sunColor: new THREE.Color(),
    skyColor: new THREE.Color(),
    groundColor: new THREE.Color(),
    hemiIntensity: 0,
    ambient: 0,
    background: new THREE.Color(),
    dusk: 0,
  }
  const [a, b, t] = piecewise(KEYS, (k) => k.el, elevation)
  d.sunIntensity = lerp(a.sun, b.sun, t)
  d.hemiIntensity = lerp(a.hemi, b.hemi, t)
  d.ambient = lerp(a.ambient, b.ambient, t)
  mixHex(d.skyColor, a.sky, b.sky, t)
  mixHex(d.groundColor, a.ground, b.ground, t)
  mixHex(d.background, a.bg, b.bg, t)
  const [r, g, bl] = kelvinToRgb(sunKelvin(elevation))
  d.sunColor.setRGB(r, g, bl, THREE.SRGBColorSpace)
  d.dusk = duskLevel(elevation)
  return d
}

/** Lamp glow from 0 (sun 2° up) to 1 (civil twilight over, −6°), in 0.1 steps so lamps re-render rarely. */
export function duskLevel(elevation: number): number {
  return Math.round(clamp01((2 - elevation) / 8) * 10) / 10
}
