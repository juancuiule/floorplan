import type { OpeningKind, Sketch, SketchRoom } from '../../model/sketch'
import type { Rect, Vec2 } from '../../model/types'

// The floor plan editor's geometry: snapping, hit tests and checks, kept apart
// from the component so they can be tested on their own. Meters, plan axes.

/** What a click on the drawing does. */
export type Tool = 'select' | 'room' | OpeningKind | 'fitting'
/** The selected room, opening or fitting. */
export type Selection = { kind: 'room' | 'opening' | 'fitting'; id: string } | null

/** Default opening widths, meters. */
export const OPENING_WIDTH: Record<OpeningKind, number> = { door: 0.9, window: 1.2, glassDoor: 2, passage: 1 }

/** The drawing grid. */
export const GRID = 0.05
/** How close an edge must be to pull a dragged edge onto it. */
const EDGE_SNAP = 0.15
/** Smallest room side. */
export const MIN_SIDE = 0.6

export const round = (v: number) => Math.round(v * 1000) / 1000
export const toGrid = (v: number) => round(Math.round(v / GRID) * GRID)

/**
 * Snaps a coordinate: to the nearest of `lines` (other rooms' edges) when one is
 * close, so rooms meet exactly and share their wall; otherwise to the grid.
 */
export function snap(v: number, lines: number[]): number {
  let best: number | null = null
  for (const l of lines)
    if (Math.abs(l - v) <= EDGE_SNAP && (best === null || Math.abs(l - v) < Math.abs(best - v))) best = l
  return best ?? toGrid(v)
}

/** Every room's x edges and z edges, except one room's own. */
export function edgeLines(rooms: SketchRoom[], except?: string): { x: number[]; z: number[] } {
  const others = rooms.filter((r) => r.id !== except)
  return { x: others.flatMap((r) => [r.rect[0], r.rect[2]]), z: others.flatMap((r) => [r.rect[1], r.rect[3]]) }
}

/** A rectangle from two corners, ordered, with each side at least MIN_SIDE. */
export function rectFrom(a: Vec2, b: Vec2): Rect {
  const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])]
  const [z0, z1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])]
  return [x0, z0, Math.max(x1, x0 + MIN_SIDE), Math.max(z1, z0 + MIN_SIDE)].map(round) as Rect
}

const area = (r: Rect) => (r[2] - r[0]) * (r[3] - r[1])

/** Rooms that overlap another room (sharing an edge is fine; sharing floor is not). */
export function overlapping(rooms: SketchRoom[]): string[] {
  const out = new Set<string>()
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const [a, b] = [rooms[i].rect, rooms[j].rect]
      const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0])
      const h = Math.min(a[3], b[3]) - Math.max(a[1], b[1])
      if (w > 1e-6 && h > 1e-6) {
        out.add(rooms[i].id)
        out.add(rooms[j].id)
      }
    }
  return [...out]
}

/** The room under a point; the smallest wins where they nest. */
export function roomAt(rooms: SketchRoom[], p: Vec2): SketchRoom | undefined {
  return rooms
    .filter((r) => p[0] >= r.rect[0] && p[0] <= r.rect[2] && p[1] >= r.rect[1] && p[1] <= r.rect[3])
    .sort((a, b) => area(a.rect) - area(b.rect))[0]
}

/**
 * Where an opening of `width` goes for a pointer at `p`: on the nearest room edge
 * within reach, its center slid so the opening stays on that edge. Null when no
 * edge is close.
 */
export function openingSpot(rooms: SketchRoom[], p: Vec2, width: number, reach = 0.4): Vec2 | null {
  let best: { at: Vec2; d: number } | null = null
  for (const r of rooms) {
    const [x0, z0, x1, z1] = r.rect
    const edges: [Vec2, Vec2][] = [
      [
        [x0, z0],
        [x1, z0],
      ],
      [
        [x0, z1],
        [x1, z1],
      ],
      [
        [x0, z0],
        [x0, z1],
      ],
      [
        [x1, z0],
        [x1, z1],
      ],
    ]
    for (const [a, b] of edges) {
      const alongX = a[1] === b[1]
      const [lo, hi] = alongX ? [a[0], b[0]] : [a[1], b[1]]
      if (hi - lo < width + 0.1) continue
      const t = alongX ? p[0] : p[1]
      const c = Math.min(hi - width / 2 - 0.05, Math.max(lo + width / 2 + 0.05, t))
      const at: Vec2 = alongX ? [toGrid(c), a[1]] : [a[0], toGrid(c)]
      // Distance to the wall itself, and the pointer must be alongside it.
      if (t < lo - reach || t > hi + reach) continue
      const d = alongX ? Math.abs(p[1] - a[1]) : Math.abs(p[0] - a[0])
      if (d <= reach && (!best || d < best.d)) best = { at, d }
    }
  }
  return best?.at ?? null
}

/** The sketch's extent, for framing the view (a default area when it is empty). */
export function extent(sketch: Sketch): Rect {
  if (!sketch.rooms.length) return [0, 0, 8, 6]
  return sketch.rooms.reduce<Rect>(
    (u, r) => [
      Math.min(u[0], r.rect[0]),
      Math.min(u[1], r.rect[1]),
      Math.max(u[2], r.rect[2]),
      Math.max(u[3], r.rect[3]),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  )
}

let counter = 0
/** A fresh id for a room, opening or fitting. */
export const freshId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`
