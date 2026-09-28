import type { Shell } from '../model/types'

// The built envelope of the unit. Dimensions come from the plan (≈120 px/m)
// and the known measurements: 6.9 m entry-to-window, main room 4.7 × 3.0,
// 3.0 m balcony opening, 1.0 m front door, 0.9 m bathroom door.
// Wall thicknesses and heights follow typical post-2020 Buenos Aires work:
// 0.20 exterior / party walls, 0.10 partitions, 2.60 slab-to-slab clear,
// 2.40 dropped ceiling over the entry zone.

const EXT = 0.2
const INT = 0.1
const H = 2.6
const CEIL_ENTRY = 2.4
/** Tile + adhesive build-up on bathroom walls. */
const TILE = 0.01

export const shell: Shell = {
  walls: [
    {
      id: 'entry',
      a: [-0.1, -0.2],
      b: [-0.1, 3.2],
      thickness: EXT,
      height: H,
      kind: 'exterior',
      material: 'plaster',
      openings: [
        {
          id: 'front-door',
          kind: 'door',
          offset: 1.6,
          width: 1.0,
          height: 2.05,
          leaf: { hinge: 'a', swing: -1, openDeg: 25, material: 'oakDoor', frameMaterial: 'oakDoor' },
        },
      ],
    },
    { id: 'side-bath', a: [0, -0.1], b: [7.1, -0.1], thickness: EXT, height: H, kind: 'exterior', material: 'plaster' },
    { id: 'side-kitchen', a: [0, 3.1], b: [7.1, 3.1], thickness: EXT, height: H, kind: 'exterior', material: 'plaster' },
    {
      id: 'facade',
      a: [7.0, 0],
      b: [7.0, 3.0],
      thickness: EXT,
      height: H,
      kind: 'exterior',
      material: 'plaster',
      openings: [
        {
          id: 'balcony-door',
          kind: 'window',
          offset: 0,
          width: 3.0,
          height: 2.2,
          sill: 0,
          glazing: { panels: 2, frameMaterial: 'aluminum' },
        },
      ],
    },

    // Partitions
    {
      id: 'bath-hall',
      a: [0, 1.35],
      b: [1.25, 1.35],
      thickness: INT,
      height: H,
      kind: 'interior',
      material: 'plaster',
      openings: [
        {
          id: 'bath-door',
          kind: 'door',
          offset: 0.3,
          width: 0.9,
          height: 2.05,
          leaf: { hinge: 'a', swing: -1, openDeg: 70, material: 'oakDoor', frameMaterial: 'steelFrame' },
        },
      ],
    },
    { id: 'bath-niche', a: [1.3, 0.7], b: [1.3, 1.4], thickness: INT, height: H, kind: 'interior', material: 'plaster' },
    { id: 'shower-niche', a: [1.35, 0.75], b: [2.1, 0.75], thickness: INT, height: H, kind: 'interior', material: 'plaster' },
    {
      id: 'entry-main',
      a: [2.15, 0],
      b: [2.15, 3.0],
      thickness: INT,
      height: H,
      kind: 'interior',
      material: 'plaster',
      openings: [{ id: 'passage', kind: 'passage', offset: 1.4, width: 1.0, height: 2.4 }],
    },
  ],

  bulges: [
    // Solid wall mass at the entry end of the kitchen run (where the plan draws a white block).
    { id: 'kitchen-pier', host: 'side-kitchen', min: [0, 0, 2.4], max: [0.6, H, 3.0], material: 'plaster' },
    // Column at the facade corner and the beam along the kitchen-side wall (seen in the photos, mirrored).
    { id: 'column-kitchen', host: 'side-kitchen', min: [6.45, 0, 2.88], max: [6.9, H, 3.0], material: 'plaster' },
    { id: 'beam-kitchen', host: 'side-kitchen', min: [2.2, 2.42, 2.8], max: [6.45, H, 3.0], material: 'plaster' },

    // Bathroom wall tiles, 60×30 laid horizontally, floor to dropped ceiling.
    { id: 'tile-entry', host: 'entry', min: [0, 0, 0], max: [TILE, CEIL_ENTRY, 1.3], material: 'tile' },
    { id: 'tile-side', host: 'side-bath', min: [TILE, 0, 0], max: [2.1, CEIL_ENTRY, TILE], material: 'tile' },
    { id: 'tile-shower-back', host: 'entry-main', min: [2.1 - TILE, 0, TILE], max: [2.1, CEIL_ENTRY, 0.7], material: 'tile' },
    { id: 'tile-shower-side', host: 'shower-niche', min: [1.35, 0, 0.7 - TILE], max: [2.1 - TILE, CEIL_ENTRY, 0.7], material: 'tile' },
    { id: 'tile-niche-wall', host: 'bath-niche', min: [1.25 - TILE, 0, 0.7], max: [1.25, CEIL_ENTRY, 1.3], material: 'tile' },
    { id: 'tile-door-l', host: 'bath-hall', min: [TILE, 0, 1.3 - TILE], max: [0.3, CEIL_ENTRY, 1.3], material: 'tile' },
    { id: 'tile-door-r', host: 'bath-hall', min: [1.2, 0, 1.3 - TILE], max: [1.25 - TILE, CEIL_ENTRY, 1.3], material: 'tile' },
    { id: 'tile-door-head', host: 'bath-hall', min: [0.3, 2.05, 1.3 - TILE], max: [1.2, CEIL_ENTRY, 1.3], material: 'tile' },
  ],

  rooms: [
    { id: 'bath', name: 'Bathroom', rect: [0, 0, 2.1, 0.7], floor: 'bathFloor' },
    { id: 'bath-2', name: 'Bathroom', rect: [0, 0.7, 1.25, 1.3], floor: 'bathFloor', label: true, labelAt: [0.75, 0.6], labelDims: '2.10 × 1.30' },
    { id: 'niche', name: 'Niche', rect: [1.35, 0.8, 2.1, 1.4], label: true },
    { id: 'hall', name: 'Hall + kitchen', rect: [0, 1.4, 2.1, 3.0], label: true, labelAt: [1.05, 1.9] },
    { id: 'main', name: 'Main room', rect: [2.2, 0, 6.9, 3.0], label: true },
    { id: 'balcony', name: 'Balcony', rect: [7.1, -0.2, 8.4, 3.2], floor: 'balconyFloor', label: true, labelAt: [7.75, 1.5], labelDims: '1.30 × 3.00' },
  ],

  ceilings: [
    { id: 'entry-dropped', rect: [0, 0, 2.1, 3.0], height: 2.4, material: 'ceiling' },
    { id: 'main', rect: [2.1, 0, 6.9, 3.0], height: H, material: 'ceiling' },
    { id: 'balcony', rect: [6.9, -0.2, 8.4, 3.2], height: H, material: 'ceiling' },
  ],

  baseFloor: { rect: [0, 0, 7.1, 3.0], material: 'oakFloor' },
  slab: { rect: [-0.2, -0.2, 8.4, 3.2], thickness: 0.18, material: 'concrete' },
}
