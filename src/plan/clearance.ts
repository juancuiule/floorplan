import { footprintOf, isFloorPiece } from '../decor/placement'
import type { DecorItem, FurnitureItem } from '../model/decor'
import type { Vec2 } from '../model/types'
import { axesOf, furnitureObstacles, passable, rayHit, shellObstacles, type Obstacle } from './obstacles'

// An architect's clearance check: from each side of a floor piece, how much
// free floor there is to the nearest wall or piece of furniture.

/** Below this a passage is tight (amber); below `TIGHT` it is too narrow to use comfortably (red). */
export const COMFORT = 0.6
export const TIGHT = 0.45
/** Sides closer than this are flush against something and are not reported. */
export const FLUSH = 0.02
/** Rays stop looking past this. */
export const MAX_REACH = 4

export type Side = 'front' | 'back' | 'left' | 'right'

export interface Clearance {
  side: Side
  /** Point on the piece's edge and the point it runs into, in plan. */
  from: Vec2
  to: Vec2
  dist: number
  /** What it runs into. */
  hit: string
  level: 'ok' | 'tight' | 'blocked'
}

export function levelOf(dist: number): Clearance['level'] {
  return dist < TIGHT ? 'blocked' : dist < COMFORT ? 'tight' : 'ok'
}

const SAMPLES = 9

/**
 * Clearances on the four sides of a floor piece (its own front, back, left and
 * right). Each side casts rays from points along its edge; the shortest wins.
 * Flush sides and sides with nothing within reach are left out.
 */
export function clearancesOf(item: FurnitureItem, items: DecorItem[]): Clearance[] {
  if (!isFloorPiece(item)) return []
  const fp = footprintOf(item)
  const obstacles: Obstacle[] = [...shellObstacles(passable), ...furnitureObstacles(items, item.id)]
  const { ux, uz } = axesOf(fp)
  const sides: { side: Side; n: Vec2; t: Vec2; half: number; reach: number }[] = [
    { side: 'front', n: uz, t: ux, half: fp.hw, reach: fp.hd },
    { side: 'back', n: [-uz[0], -uz[1]], t: ux, half: fp.hw, reach: fp.hd },
    { side: 'right', n: ux, t: uz, half: fp.hd, reach: fp.hw },
    { side: 'left', n: [-ux[0], -ux[1]], t: uz, half: fp.hd, reach: fp.hw },
  ]
  const out: Clearance[] = []
  for (const s of sides) {
    let best: { dist: number; from: Vec2; hit: string } | null = null
    for (let i = 0; i < SAMPLES; i++) {
      // Stay a hair inside the corners so a neighbor touching the corner still counts.
      const k = (-1 + (2 * i) / (SAMPLES - 1)) * s.half * 0.98
      const from: Vec2 = [fp.cx + s.n[0] * s.reach + s.t[0] * k, fp.cz + s.n[1] * s.reach + s.t[1] * k]
      for (const o of obstacles) {
        const d = rayHit(o, from, s.n)
        if (d <= MAX_REACH && (!best || d < best.dist)) best = { dist: d, from, hit: o.id }
      }
    }
    if (!best || best.dist < FLUSH) continue
    out.push({
      side: s.side,
      from: best.from,
      to: [best.from[0] + s.n[0] * best.dist, best.from[1] + s.n[1] * best.dist],
      dist: best.dist,
      hit: best.hit,
      level: levelOf(best.dist),
    })
  }
  return out
}
