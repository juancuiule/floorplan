import type { DecorItem } from '../model/decor'
import type { Vec2 } from '../model/types'
import { furnitureObstacles, pushOut, shellObstacles, walkable, type Obstacle } from './obstacles'

/** Half the width of a person's shoulders, roughly: how close the eye gets to a wall. */
export const BODY_RADIUS = 0.2
/** Where walk mode starts when no spot is picked: inside the front door, looking down the flat. */
export const ENTRY_SPOT: Vec2 = [0.55, 1.9]

/** Floor you can stand on: the flat and the balcony (x 0–8.4, z −0.2–3.2). */
const BOUNDS = { x0: 0, x1: 8.4, z0: -0.2, z1: 3.2 }
const STEP = 0.05
const ITERATIONS = 4

export function walkObstacles(items: DecorItem[]): Obstacle[] {
  return [...shellObstacles(walkable), ...furnitureObstacles(items)]
}

export function insideFlat(x: number, z: number): boolean {
  return x >= BOUNDS.x0 && x <= BOUNDS.x1 && z >= BOUNDS.z0 && z <= BOUNDS.z1
}

/** Moves the disc out of every obstacle it touches (a few passes settle corners). */
export function resolve(p: Vec2, obstacles: Obstacle[], radius = BODY_RADIUS): Vec2 {
  let q: Vec2 = [p[0], p[1]]
  for (let k = 0; k < ITERATIONS; k++) {
    let moved = false
    for (const o of obstacles) {
      const r = pushOut(o, q, radius)
      if (r) {
        q = r
        moved = true
      }
    }
    if (!moved) break
  }
  q[0] = Math.min(BOUNDS.x1 - radius, Math.max(BOUNDS.x0 + radius, q[0]))
  q[1] = Math.min(BOUNDS.z1 - radius, Math.max(BOUNDS.z0 + radius, q[1]))
  return q
}

/**
 * Walks from `p` by `delta`, sliding along whatever is in the way. Long moves
 * are split into short steps so a fast frame cannot tunnel through a partition.
 */
export function walk(p: Vec2, delta: Vec2, obstacles: Obstacle[], radius = BODY_RADIUS): Vec2 {
  const len = Math.hypot(delta[0], delta[1])
  const n = Math.max(1, Math.ceil(len / STEP))
  let q: Vec2 = [p[0], p[1]]
  for (let i = 0; i < n; i++) q = resolve([q[0] + delta[0] / n, q[1] + delta[1] / n], obstacles, radius)
  return q
}
