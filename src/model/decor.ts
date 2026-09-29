import type { Vec3 } from './types'

// Movable decor, saved to data/decor.json. Positions are plan coordinates (meters).

/** Which way a wall-mounted item faces: the outward normal of the surface it hangs on. */
export type Facing = 'x+' | 'x-' | 'z+' | 'z-'

export type SizePreset = 'A5' | 'A4' | 'A3' | 'A2' | '50x70' | 'custom'
export type FrameStyle = 'none' | 'thin' | 'classic' | 'box' | 'float' | 'canvas'

export interface ArtworkItem {
  kind: 'artwork'
  id: string
  /** URL under /artwork. */
  image: string
  /** Center of the artwork, on the wall surface. */
  at: Vec3
  facing: Facing
  /** Wall id, so the piece hides with its wall in dollhouse mode. */
  host?: string
  /** Visible print size in meters, orientation already applied. */
  size: { preset: SizePreset; w: number; h: number }
  /** cover crops the image to the print size; contain letterboxes it on paper. */
  fit: 'cover' | 'contain'
  frame: { style: FrameStyle; color: string; /** Passe-partout width, meters. */ mat: number }
}

export type PlantSpecies = 'monstera' | 'snake' | 'fiddle' | 'olive' | 'fern' | 'palm' | 'cactus' | 'lavender' | 'pothos'
export type PotStyle = 'terracotta' | 'ceramic' | 'concrete' | 'basket' | 'black'

export interface PlantItem {
  kind: 'plant'
  id: string
  species: PlantSpecies
  pot: PotStyle
  /** Base of the pot (or the ceiling hook for hanging plants). */
  at: Vec3
  /** Degrees around y. */
  rotation: number
  scale: number
}

export type LampType = 'arc' | 'tripod' | 'table' | 'mushroom' | 'pendant' | 'globe' | 'sconce' | 'string'
export type Warmth = 2700 | 3000 | 4000

export interface LampItem {
  kind: 'lamp'
  id: string
  type: LampType
  /** Base on a surface, ceiling point for pendants, or wall point for wall lights. */
  at: Vec3
  rotation: number
  facing?: Facing
  host?: string
  on: boolean
  /** Multiplier on the lamp's nominal output. */
  brightness: number
  warmth: Warmth
  /** Body / shade color. */
  color: string
  /** String lights only: run length along the wall, meters. */
  length?: number
}

export type DecorItem = ArtworkItem | PlantItem | LampItem
export type DecorKind = DecorItem['kind']

export interface DecorFile {
  version: 1
  items: DecorItem[]
}
