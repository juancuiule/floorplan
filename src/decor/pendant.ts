import type { DecorItem, FurnitureItem, LampItem, LampType } from '../model/decor'

// How far a pendant hangs. A lamp's `drop` is its cord: from the ceiling to the
// top of the shade. Left unset it follows the room: over a dining table the
// shade hangs a comfortable 70 cm above the top; anywhere else its bottom stays
// at 1.95 m or higher, clear of heads (and of the walk-mode eye at 1.60).

/** Height of the fitting under its cord (dome, globe, lantern). */
export const PENDANT_BODY: Partial<Record<LampType, number>> = { pendant: 0.22, globe: 0.32, lantern: 0.6 }
/** Horizontal radius of the fitting. */
export const PENDANT_RADIUS: Partial<Record<LampType, number>> = { pendant: 0.22, globe: 0.16, lantern: 0.3 }
/** Lowest a pendant's bottom hangs by default where people walk. */
export const HEAD_CLEARANCE = 1.95
/** Gap from a table top to the bottom of a pendant hung over it. */
export const OVER_TABLE = 0.7
export const MIN_CORD = 0.05
export const MAX_CORD = 1.6

export const isPendant = (type: LampType): boolean => type in PENDANT_BODY

const clampCord = (v: number) => Math.min(MAX_CORD, Math.max(MIN_CORD, v))

/** The dining table under a plan point, if any. */
export function tableUnder(x: number, z: number, items: DecorItem[]): FurnitureItem | null {
  for (const i of items) {
    if (i.kind !== 'furniture' || i.type !== 'diningTable' || i.at[1] < -1) continue
    const a = (i.rotation * Math.PI) / 180
    const dx = x - i.at[0]
    const dz = z - i.at[2]
    // Into the table's own axes: local +x is (cos, -sin), local +z is (sin, cos) in plan.
    const lx = dx * Math.cos(a) - dz * Math.sin(a)
    const lz = dx * Math.sin(a) + dz * Math.cos(a)
    if (Math.abs(lx) <= i.size[0] / 2 && Math.abs(lz) <= i.size[2] / 2) return i
  }
  return null
}

/** The cord a pendant gets when none is set: clear of heads, or low over a table. */
export function autoDrop(item: LampItem, items: DecorItem[]): number {
  const body = PENDANT_BODY[item.type] ?? 0
  const ceiling = item.at[1]
  const table = tableUnder(item.at[0], item.at[2], items)
  const bottom = table ? table.at[1] + table.size[1] + OVER_TABLE : HEAD_CLEARANCE
  return Math.round(clampCord(ceiling - bottom - body) * 100) / 100
}

/** The pendant's cord length: the one set in the inspector, else the automatic one. */
export function pendantDrop(item: LampItem, items: DecorItem[]): number {
  return item.drop !== undefined ? clampCord(item.drop) : autoDrop(item, items)
}

/** Height of the pendant's lowest point above the floor. */
export function pendantBottom(item: LampItem, items: DecorItem[]): number {
  return item.at[1] - pendantDrop(item, items) - (PENDANT_BODY[item.type] ?? 0)
}
