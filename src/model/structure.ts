// "What if" structure: interior partitions taken out and the entry ceiling
// raised, per layout. Saved inside the layout's `finishes` as `structure`, and
// only when something differs from the built flat, so old files keep their shape.

/** Partitions that carry no load and can come out. Exterior, party walls, the facade, columns and beams stay. */
export const REMOVABLE_WALLS = ['bath-hall', 'bath-niche', 'shower-niche', 'entry-main'] as const
export type RemovableWall = (typeof REMOVABLE_WALLS)[number]

export interface Structure {
  /** Partitions taken out, in REMOVABLE_WALLS order. */
  removedWalls: RemovableWall[]
  /** The 2.40 services ceiling over the entry zone raised to the slab (2.60). */
  raiseEntryCeiling: boolean
}

export const DEFAULT_STRUCTURE: Structure = { removedWalls: [], raiseEntryCeiling: false }

export const isRemovableWall = (id: string): id is RemovableWall => (REMOVABLE_WALLS as readonly string[]).includes(id)

/** Reads `finishes.structure`: unknown ids and values are dropped, missing means the built flat. */
export function normalizeStructure(raw: unknown): Structure {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const list = Array.isArray(r.removedWalls) ? r.removedWalls : []
  return {
    removedWalls: REMOVABLE_WALLS.filter((id) => list.includes(id)),
    raiseEntryCeiling: r.raiseEntryCeiling === true,
  }
}

export const isDefaultStructure = (s: Structure | undefined) => !s || (s.removedWalls.length === 0 && !s.raiseEntryCeiling)

/** Takes a partition out, or puts it back. */
export function toggleWall(s: Structure, id: RemovableWall, removed = !s.removedWalls.includes(id)): Structure {
  const next = new Set(s.removedWalls)
  if (removed) next.add(id)
  else next.delete(id)
  return { ...s, removedWalls: REMOVABLE_WALLS.filter((w) => next.has(w)) }
}
