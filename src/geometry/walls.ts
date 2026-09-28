import type { Opening, Vec2, Wall } from '../model/types'

/** A box in wall-local space: s along the wall from `a`, y up, centered on the centerline. */
export interface WallPiece {
  s0: number
  s1: number
  y0: number
  y1: number
  /** True for the part below the dollhouse cut height. */
  stub: boolean
}

export interface WallFrame {
  origin: Vec2
  /** Unit direction a→b in plan. */
  u: Vec2
  /** Unit normal that is wall-local +z after rotation by rotY. */
  n: Vec2
  length: number
  /** Rotation around y that maps local +x onto u. */
  rotY: number
}

export function wallFrame(w: Wall): WallFrame {
  const dx = w.b[0] - w.a[0]
  const dz = w.b[1] - w.a[1]
  const length = Math.hypot(dx, dz)
  const u: Vec2 = [dx / length, dz / length]
  return { origin: w.a, u, n: [-u[1], u[0]], length, rotY: Math.atan2(-u[1], u[0]) }
}

/** Splits a wall into solid boxes around its openings, cut at `stubHeight`. */
export function wallPieces(w: Wall, stubHeight: number): WallPiece[] {
  const { length } = wallFrame(w)
  const openings = [...(w.openings ?? [])].sort((p, q) => p.offset - q.offset)
  const raw: Omit<WallPiece, 'stub'>[] = []
  let cursor = 0

  for (const o of openings) {
    const start = Math.max(0, o.offset)
    const end = Math.min(length, o.offset + o.width)
    if (start > cursor) raw.push({ s0: cursor, s1: start, y0: 0, y1: w.height })
    const sill = o.sill ?? 0
    if (sill > 0) raw.push({ s0: start, s1: end, y0: 0, y1: sill })
    const top = sill + o.height
    if (top < w.height) raw.push({ s0: start, s1: end, y0: top, y1: w.height })
    cursor = Math.max(cursor, end)
  }
  if (cursor < length) raw.push({ s0: cursor, s1: length, y0: 0, y1: w.height })

  const pieces: WallPiece[] = []
  for (const p of raw) {
    if (p.y1 <= stubHeight) pieces.push({ ...p, stub: true })
    else if (p.y0 >= stubHeight) pieces.push({ ...p, stub: false })
    else {
      pieces.push({ ...p, y1: stubHeight, stub: true })
      pieces.push({ ...p, y0: stubHeight, stub: false })
    }
  }
  return pieces
}

/** The wall normal that points away from `inside` (a plan point known to be indoors). */
export function outwardNormal(w: Wall, inside: Vec2): Vec2 {
  const f = wallFrame(w)
  const mid: Vec2 = [(w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2]
  const toInside = (inside[0] - mid[0]) * f.n[0] + (inside[1] - mid[1]) * f.n[1]
  return toInside > 0 ? [-f.n[0], -f.n[1]] : f.n
}

export function openingById(w: Wall, id: string): Opening | undefined {
  return w.openings?.find((o) => o.id === id)
}
