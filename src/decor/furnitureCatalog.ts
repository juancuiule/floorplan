import type { FurnitureOption, FurnitureType } from '../model/decor'
import type { Vec3 } from '../model/types'
import type { Mount } from './catalog'

export type OptionSpec = (
  | { key: string; label: string; kind: 'toggle' }
  | { key: string; label: string; kind: 'chips'; choices: { id: FurnitureOption; label: string }[] }
  | { key: string; label: string; kind: 'range'; min: number; max: number; step: number; unit?: string }
  | { key: string; label: string; kind: 'text'; placeholder?: string; hint?: string }
) & {
  /** Shown only while another option has this value. */
  when?: [key: string, value: FurnitureOption]
}

export interface FurnitureSpec {
  label: string
  note: string
  group: 'Sleep' | 'Sit' | 'Work & dine' | 'Storage' | 'Kitchen & wall' | 'Balcony' | 'Decor' | 'Appliances & electronics'
  mount: Mount
  /**
   * Small pieces that stand on counters, desks and shelves (a mixer, mugs,
   * speakers): they settle onto other furniture, unlike floor pieces, which
   * slide along the floor underneath it.
   */
  tabletop?: boolean
  /** Default [w, h, d] in meters. */
  size: Vec3
  /** Wall pieces: the usual height of the bottom edge; placing near it settles there. */
  mountHeight?: number
  /** Pieces whose size follows their options (a speaker pair's spacing): the size for these options. */
  sizeFor?: (options: Record<string, FurnitureOption>, size: Vec3) => Vec3
  presets?: { label: string; size: Vec3 }[]
  /** Body colors to offer instead of the wood and paint finishes (appliances). */
  bodyColors?: { label: string; color: string }[]
  /** Which of the three finish colors the piece uses. */
  uses: ('body' | 'metal' | 'fabric')[]
  finish: { body: string; metal: string; fabric: string }
  options: Record<string, FurnitureOption>
  optionSpecs: OptionSpec[]
  /** Size fields the inspector shows (height is fixed for some pieces). */
  editable: ('w' | 'h' | 'd')[]
}

export const BODY_FINISHES = [
  { label: 'Birch plywood', color: '#dcc196' },
  { label: 'Oak', color: '#c49c6c' },
  { label: 'Walnut', color: '#6a4731' },
  { label: 'White', color: '#f0eee9' },
  { label: 'Black', color: '#262625' },
  { label: 'Anthracite', color: '#3d3f42' },
  { label: 'Navy', color: '#2e4270' },
]

export const METAL_FINISHES = [
  { label: 'Black steel', color: '#1d1d1d' },
  { label: 'White', color: '#eeeeec' },
  { label: 'Brass', color: '#b8963e' },
  { label: 'Steel', color: '#b7babd' },
]

export const FABRIC_FINISHES = [
  { label: 'Linen', color: '#e6e0d4' },
  { label: 'Oat', color: '#d3c3a6' },
  { label: 'Charcoal', color: '#56585c' },
  { label: 'Terracotta', color: '#b3664b' },
  { label: 'Sage', color: '#9aab8e' },
  { label: 'Blue', color: '#8ea5c3' },
  { label: 'Leather', color: '#8a5634' },
]

const PLY = BODY_FINISHES[0].color
const BLACK = METAL_FINISHES[0].color
const LINEN = FABRIC_FINISHES[0].color

const finish = (body = PLY, metal = BLACK, fabric = LINEN) => ({ body, metal, fabric })

/** Width of one Edifier R1700BT speaker. */
export const SPEAKER_W = 0.155
/** Height of the AC condenser itself, without a bracket. */
export const CONDENSER_H = 0.55
const round2 = (v: number) => Math.round(v * 1000) / 1000

/** Common TV sizes, diagonal in inches. */
export const TV_INCHES = [32, 43, 50, 55, 65, 75]
/** Bezel on each side of the picture, meters. */
export const TV_BEZEL = 0.008
/** How high the feet / pedestal lift the panel off the surface. */
export const TV_LIFT = { feet: 0.07, pedestal: 0.1 } as const
/** Outer [width, height] in meters of a 16:9 panel with the given diagonal in inches. */
export function tvPanel(inches: number): [number, number] {
  const d = inches * 0.0254
  const k = Math.hypot(16, 9)
  return [round2((d * 16) / k + 2 * TV_BEZEL), round2((d * 9) / k + 2 * TV_BEZEL)]
}
const tvSizeChoices = TV_INCHES.map((n) => ({ id: n, label: `${n}″` }))
const tvScreen: OptionSpec = {
  key: 'screen',
  label: 'Screen',
  kind: 'chips',
  choices: [
    { id: 'off', label: 'Off' },
    { id: 'on', label: 'Picture' },
    { id: 'youtube', label: 'YouTube' },
  ],
}
const tvImage: OptionSpec = {
  key: 'image',
  label: 'Image link',
  kind: 'text',
  placeholder: 'https://…/photo.jpg',
  hint: 'Any image link, or /artwork/… from your library. Cropped to the screen; empty shows the skyline.',
  when: ['screen', 'on'],
}
const tvYouTube: OptionSpec = {
  key: 'youtube',
  label: 'YouTube link',
  kind: 'text',
  placeholder: 'https://youtu.be/…',
  hint: 'Plays on the screen. Drag the TV by its frame; clicks on the picture go to YouTube.',
  when: ['screen', 'youtube'],
}

export const FURNITURE: Record<FurnitureType, FurnitureSpec> = {
  platformBed: {
    label: 'Platform bed',
    note: 'Plywood base with cubbies',
    group: 'Sleep',
    mount: 'surface',
    size: [1.56, 0.4, 2.04],
    presets: [
      { label: '90 × 190', size: [1.06, 0.4, 2.04] },
      { label: '140 × 190', size: [1.56, 0.4, 2.04] },
      { label: '160 × 200', size: [1.76, 0.4, 2.14] },
    ],
    uses: ['body', 'fabric'],
    finish: finish(),
    options: { headShelf: 'L', books: true },
    optionSpecs: [
      {
        key: 'headShelf',
        label: 'Head shelf',
        kind: 'chips',
        choices: [
          { id: 'none', label: 'None' },
          { id: 'head', label: 'Behind the head' },
          { id: 'L', label: 'L-shaped' },
        ],
      },
      { key: 'books', label: 'Books in the cubbies', kind: 'toggle' },
    ],
    editable: ['w', 'h', 'd'],
  },
  murphyBed: {
    label: 'Wall bed',
    note: 'Folds into a plywood cabinet',
    group: 'Sleep',
    mount: 'surface',
    size: [1.6, 2.3, 0.45],
    presets: [
      { label: '90 × 190', size: [1.1, 2.3, 0.45] },
      { label: '140 × 190', size: [1.6, 2.3, 0.45] },
    ],
    uses: ['body', 'fabric'],
    finish: finish(),
    options: { open: true, sideTowers: true },
    optionSpecs: [
      { key: 'open', label: 'Bed down', kind: 'toggle' },
      { key: 'sideTowers', label: 'Storage towers each side', kind: 'toggle' },
    ],
    editable: ['w', 'h'],
  },
  daybed: {
    label: 'Daybed',
    note: 'On casters, drawers and books',
    group: 'Sleep',
    mount: 'surface',
    size: [1.95, 0.46, 0.85],
    uses: ['body', 'metal', 'fabric'],
    finish: finish(PLY, '#5d6570', FABRIC_FINISHES[2].color),
    options: { drawers: true, pillows: true },
    optionSpecs: [
      { key: 'drawers', label: 'Flat-file drawers', kind: 'toggle' },
      { key: 'pillows', label: 'Back pillows', kind: 'toggle' },
    ],
    editable: ['w', 'd'],
  },
  sofa: {
    label: 'Low sofa',
    note: 'Box cushions, slim legs',
    group: 'Sit',
    mount: 'surface',
    size: [1.6, 0.7, 0.88],
    presets: [
      { label: '2 seats', size: [1.6, 0.7, 0.88] },
      { label: '3 seats', size: [2.1, 0.7, 0.88] },
    ],
    uses: ['fabric', 'metal'],
    finish: finish(PLY, BLACK, FABRIC_FINISHES[1].color),
    options: {},
    optionSpecs: [],
    editable: ['w', 'd'],
  },
  standingDesk: {
    label: 'Standing desk',
    note: 'Motorized, sit or stand',
    group: 'Work & dine',
    mount: 'surface',
    size: [1.4, 0.72, 0.7],
    presets: [
      { label: '120 × 60', size: [1.2, 0.72, 0.6] },
      { label: '140 × 70', size: [1.4, 0.72, 0.7] },
      { label: '160 × 80', size: [1.6, 0.72, 0.8] },
    ],
    uses: ['body', 'metal'],
    finish: finish(BODY_FINISHES[2].color, BLACK),
    options: { riser: true, monitor: true },
    optionSpecs: [
      { key: 'riser', label: 'Monitor riser (brass legs)', kind: 'toggle' },
      { key: 'monitor', label: 'Ultrawide monitor + keyboard', kind: 'toggle' },
    ],
    editable: ['w', 'd'],
  },
  diningTable: {
    label: 'Dining table',
    note: 'Round or rectangular',
    group: 'Work & dine',
    mount: 'surface',
    size: [1.2, 0.75, 0.75],
    presets: [
      { label: 'Round 90', size: [0.9, 0.75, 0.9] },
      { label: '120 × 75', size: [1.2, 0.75, 0.75] },
      { label: '140 × 80', size: [1.4, 0.75, 0.8] },
    ],
    uses: ['body', 'metal'],
    finish: finish(BODY_FINISHES[1].color, BLACK),
    options: { shape: 'rect', chairs: 2 },
    optionSpecs: [
      {
        key: 'shape',
        label: 'Shape',
        kind: 'chips',
        choices: [
          { id: 'rect', label: 'Rectangular' },
          { id: 'round', label: 'Round' },
        ],
      },
      {
        key: 'chairs',
        label: 'Chairs',
        kind: 'chips',
        choices: [
          { id: 0, label: 'None' },
          { id: 2, label: '2' },
          { id: 4, label: '4' },
        ],
      },
    ],
    editable: ['w', 'd'],
  },
  chair: {
    label: 'Plywood chair',
    note: 'Bent seat, steel legs',
    group: 'Sit',
    mount: 'surface',
    size: [0.45, 0.8, 0.5],
    uses: ['body', 'metal'],
    finish: finish(),
    options: {},
    optionSpecs: [],
    editable: [],
  },
  butterflyChair: {
    label: 'BKF butterfly chair',
    note: 'Argentine modernist classic',
    group: 'Sit',
    mount: 'surface',
    size: [0.78, 0.9, 0.8],
    uses: ['metal', 'fabric'],
    finish: finish(PLY, BLACK, FABRIC_FINISHES[6].color),
    options: {},
    optionSpecs: [],
    editable: [],
  },
  bookshelf: {
    label: 'Cubby bookshelf',
    note: 'Open plywood boxes',
    group: 'Storage',
    mount: 'surface',
    size: [1.05, 1.08, 0.33],
    presets: [
      { label: '3 × 3', size: [1.05, 1.08, 0.33] },
      { label: '4 × 2', size: [1.4, 0.72, 0.33] },
      { label: '2 × 5 tall', size: [0.72, 1.8, 0.33] },
    ],
    uses: ['body'],
    finish: finish(),
    options: { books: true },
    optionSpecs: [{ key: 'books', label: 'Books', kind: 'toggle' }],
    editable: ['w', 'h', 'd'],
  },
  wardrobe: {
    label: 'Plywood wardrobe',
    note: 'Finger-hole doors, open side',
    group: 'Storage',
    mount: 'surface',
    size: [1.6, 2.4, 0.6],
    uses: ['body'],
    finish: finish(),
    options: { sideShelf: true },
    optionSpecs: [{ key: 'sideShelf', label: 'Open shelf on the side', kind: 'toggle' }],
    editable: ['w', 'h', 'd'],
  },
  sideboard: {
    label: 'Low sideboard',
    note: 'Sliding doors, for a TV',
    group: 'Storage',
    mount: 'surface',
    size: [1.6, 0.5, 0.42],
    uses: ['body', 'metal'],
    finish: finish(BODY_FINISHES[1].color, BLACK),
    options: { legs: true },
    optionSpecs: [{ key: 'legs', label: 'Steel legs', kind: 'toggle' }],
    editable: ['w', 'h', 'd'],
  },
  blockShelf: {
    label: 'Block & plank shelf',
    note: 'Cinder blocks, wood planks',
    group: 'Storage',
    mount: 'surface',
    size: [1.2, 0.8, 0.3],
    presets: [
      { label: '2 levels', size: [1.2, 0.8, 0.3] },
      { label: '3 levels', size: [1.2, 1.2, 0.3] },
      { label: 'Long bench', size: [1.8, 0.4, 0.3] },
    ],
    uses: ['body'],
    finish: finish(BODY_FINISHES[1].color),
    options: { levels: 2 },
    optionSpecs: [{ key: 'levels', label: 'Levels', kind: 'range', min: 1, max: 4, step: 1 }],
    editable: ['w', 'h', 'd'],
  },
  rug: {
    label: 'Rug',
    note: 'Flat-woven',
    group: 'Decor',
    mount: 'surface',
    size: [2.0, 0.012, 1.4],
    presets: [
      { label: '120 × 170', size: [1.7, 0.012, 1.2] },
      { label: '140 × 200', size: [2.0, 0.012, 1.4] },
      { label: '160 × 230', size: [2.3, 0.012, 1.6] },
    ],
    uses: ['fabric'],
    finish: finish(PLY, BLACK, FABRIC_FINISHES[1].color),
    options: { border: true },
    optionSpecs: [{ key: 'border', label: 'Border stripe', kind: 'toggle' }],
    editable: ['w', 'd'],
  },
  loftBed: {
    label: 'Raised sleeping platform',
    note: 'Loft bed on drawers, storage steps',
    group: 'Sleep',
    mount: 'surface',
    size: [2.55, 1.0, 1.5],
    presets: [
      { label: '90 × 190', size: [2.45, 1.0, 0.98] },
      { label: '140 × 190', size: [2.55, 1.0, 1.5] },
      { label: '160 × 200', size: [2.65, 1.05, 1.7] },
    ],
    uses: ['body', 'fabric'],
    finish: finish(),
    options: { stairs: 'right', drawers: 3 },
    optionSpecs: [
      {
        key: 'stairs',
        label: 'Steps on the',
        kind: 'chips',
        choices: [
          { id: 'left', label: 'Left' },
          { id: 'right', label: 'Right' },
        ],
      },
      { key: 'drawers', label: 'Drawers under the bed', kind: 'range', min: 0, max: 4, step: 1 },
    ],
    editable: ['w', 'h', 'd'],
  },
  glassDivider: {
    label: 'Glass room divider',
    note: 'Plywood frame, fluted glass',
    group: 'Decor',
    mount: 'surface',
    size: [1.4, 2.1, 0.3],
    presets: [
      { label: '2 panels', size: [0.9, 2.1, 0.3] },
      { label: '3 panels', size: [1.4, 2.1, 0.3] },
      { label: '4 panels · full height', size: [1.8, 2.4, 0.3] },
    ],
    uses: ['body'],
    finish: finish(),
    options: { panels: 3, glass: 'reeded', transom: true },
    optionSpecs: [
      { key: 'panels', label: 'Panels', kind: 'range', min: 1, max: 6, step: 1 },
      {
        key: 'glass',
        label: 'Glass',
        kind: 'chips',
        choices: [
          { id: 'reeded', label: 'Reeded' },
          { id: 'frosted', label: 'Frosted' },
          { id: 'clear', label: 'Clear' },
        ],
      },
      { key: 'transom', label: 'Top rail (transom)', kind: 'toggle' },
    ],
    editable: ['w', 'h'],
  },
  officeChair: {
    label: 'Ergonomic office chair',
    note: 'Mesh back, headrest, on casters',
    group: 'Work & dine',
    mount: 'surface',
    size: [0.66, 1.22, 0.66],
    uses: ['metal'],
    finish: finish(PLY, BLACK),
    options: { color: 'black', seat: 48, headrest: true },
    optionSpecs: [
      {
        key: 'color',
        label: 'Mesh',
        kind: 'chips',
        choices: [
          { id: 'black', label: 'Black' },
          { id: 'grey', label: 'Grey' },
        ],
      },
      { key: 'seat', label: 'Seat height', kind: 'range', min: 42, max: 56, step: 1, unit: 'cm' },
      { key: 'headrest', label: 'Headrest', kind: 'toggle' },
    ],
    editable: [],
  },
  bistroChair: {
    label: 'Tube chair or stool',
    note: 'Bent steel tube, round wood seat',
    group: 'Sit',
    mount: 'surface',
    size: [0.42, 0.84, 0.44],
    // The footprint and height follow the type (the model itself is fixed-size).
    sizeFor: (o) => (o.variant === 'stool' ? [0.44, 0.46, 0.44] : o.variant === 'bar' ? [0.47, 0.66, 0.47] : [0.42, 0.84, 0.44]),
    uses: ['body'],
    finish: finish(BODY_FINISHES[1].color),
    options: { variant: 'chair', color: '#e0662f' },
    optionSpecs: [
      {
        key: 'variant',
        label: 'Type',
        kind: 'chips',
        choices: [
          { id: 'chair', label: 'Chair' },
          { id: 'stool', label: 'Stool' },
          { id: 'bar', label: 'Bar stool' },
        ],
      },
      {
        key: 'color',
        label: 'Tube color',
        kind: 'chips',
        choices: [
          { id: '#e0662f', label: 'Orange' },
          { id: '#3f8a57', label: 'Green' },
          { id: '#2f5fb3', label: 'Blue' },
          { id: '#e5b92e', label: 'Yellow' },
          { id: '#c93a36', label: 'Red' },
          { id: '#f0eee9', label: 'White' },
        ],
      },
    ],
    editable: [],
  },
  windowBench: {
    label: 'Window bench',
    note: 'Plywood box seat with cushion',
    group: 'Sit',
    mount: 'surface',
    size: [1.2, 0.46, 0.42],
    presets: [
      { label: '90 cm', size: [0.9, 0.46, 0.42] },
      { label: '120 cm', size: [1.2, 0.46, 0.42] },
      { label: '160 cm', size: [1.6, 0.46, 0.42] },
    ],
    uses: ['body', 'fabric'],
    finish: finish(PLY, BLACK, FABRIC_FINISHES[4].color),
    options: { front: 'open', cushion: true },
    optionSpecs: [
      {
        key: 'front',
        label: 'Front',
        kind: 'chips',
        choices: [
          { id: 'open', label: 'Open cubbies' },
          { id: 'closed', label: 'Closed' },
        ],
      },
      { key: 'cushion', label: 'Seat cushion', kind: 'toggle' },
    ],
    editable: ['w', 'h', 'd'],
  },
  wireBasket: {
    label: 'Wire basket',
    note: 'Lined with a burlap coffee sack',
    group: 'Storage',
    mount: 'surface',
    size: [0.42, 0.5, 0.42],
    presets: [
      { label: 'Small', size: [0.32, 0.36, 0.32] },
      { label: 'Laundry', size: [0.42, 0.5, 0.42] },
      { label: 'Tall', size: [0.4, 0.62, 0.4] },
    ],
    uses: ['metal'],
    finish: finish(PLY, BLACK),
    options: { sack: true, laundry: true },
    optionSpecs: [
      { key: 'sack', label: 'Burlap coffee sack', kind: 'toggle' },
      { key: 'laundry', label: 'Filled with laundry', kind: 'toggle' },
    ],
    editable: ['w', 'h'],
  },
  balconyBench: {
    label: 'Balcony daybed',
    note: 'Slats or pallets, cushions, pillows',
    group: 'Balcony',
    mount: 'surface',
    size: [1.6, 0.42, 0.7],
    presets: [
      { label: 'Bench 120', size: [1.2, 0.42, 0.6] },
      { label: 'Daybed 160', size: [1.6, 0.42, 0.7] },
      { label: 'Pallets 120 × 80', size: [1.2, 0.42, 0.8] },
    ],
    uses: ['body', 'fabric'],
    finish: finish(BODY_FINISHES[1].color, BLACK, FABRIC_FINISHES[0].color),
    options: { base: 'slats', pillows: 3 },
    optionSpecs: [
      {
        key: 'base',
        label: 'Base',
        kind: 'chips',
        choices: [
          { id: 'slats', label: 'Wood slats' },
          { id: 'pallet', label: 'Pallets' },
        ],
      },
      { key: 'pillows', label: 'Back pillows', kind: 'range', min: 0, max: 4, step: 1 },
    ],
    editable: ['w', 'h', 'd'],
  },
  planterWall: {
    label: 'Cinder-block planter wall',
    note: 'Staggered blocks, plants in the cells',
    group: 'Balcony',
    mount: 'surface',
    size: [1.2, 0.8, 0.2],
    presets: [
      { label: '3 × 4', size: [1.2, 0.8, 0.2] },
      { label: '4 × 6', size: [1.6, 1.2, 0.2] },
      { label: '2 × 3 low', size: [0.8, 0.6, 0.2] },
    ],
    uses: ['body'],
    finish: finish('#a9a6a0'),
    options: { plants: 60 },
    optionSpecs: [{ key: 'plants', label: 'Cells planted', kind: 'range', min: 0, max: 100, step: 10, unit: '%' }],
    editable: ['w', 'h'],
  },
  mugs: {
    label: 'Ceramic mugs',
    note: 'Speckled stoneware, a few colors',
    group: 'Kitchen & wall',
    mount: 'surface',
    tabletop: true,
    size: [0.44, 0.1, 0.15],
    sizeFor: (o, s) => [round2(Math.max(1, Math.min(6, Math.round(Number(o.count ?? 4)))) * 0.11), s[1], s[2]],
    uses: ['body'],
    finish: finish(BODY_FINISHES[1].color),
    options: { count: 4, glaze: 'mixed', tray: false },
    optionSpecs: [
      { key: 'count', label: 'Mugs', kind: 'range', min: 1, max: 6, step: 1 },
      { key: 'tray', label: 'On a wood tray', kind: 'toggle' },
      {
        key: 'glaze',
        label: 'Glaze',
        kind: 'chips',
        choices: [
          { id: 'mixed', label: 'Mixed colors' },
          { id: 'speckled', label: 'Speckled oat' },
          { id: 'white', label: 'Glossy white' },
        ],
      },
    ],
    editable: [],
  },

  gridShelf: {
    label: 'Grid wall shelf',
    note: 'Black steel frame, wood shelves',
    group: 'Kitchen & wall',
    mount: 'wall',
    size: [1.2, 0.9, 0.28],
    uses: ['body', 'metal'],
    finish: finish(BODY_FINISHES[1].color, BLACK),
    options: { shelves: 3 },
    optionSpecs: [{ key: 'shelves', label: 'Shelves', kind: 'range', min: 2, max: 5, step: 1 }],
    editable: ['w', 'h', 'd'],
  },
  upperCabinets: {
    label: 'Reeded glass cabinets',
    note: 'Sliding doors on a rail, LED below',
    group: 'Kitchen & wall',
    mount: 'wall',
    size: [1.45, 0.7, 0.34],
    uses: ['body', 'metal'],
    finish: finish(BODY_FINISHES[1].color, BLACK),
    options: { led: true, glass: 'reeded' },
    optionSpecs: [
      {
        key: 'glass',
        label: 'Glass',
        kind: 'chips',
        choices: [
          { id: 'reeded', label: 'Reeded' },
          { id: 'wired', label: 'Wired' },
          { id: 'clear', label: 'Clear' },
        ],
      },
      { key: 'led', label: 'LED strip underneath', kind: 'toggle' },
    ],
    editable: ['w', 'h', 'd'],
  },
  floatingShelf: {
    label: 'Floating shelf',
    note: 'Solid wood on brackets',
    group: 'Kitchen & wall',
    mount: 'wall',
    size: [0.9, 0.035, 0.22],
    uses: ['body', 'metal'],
    finish: finish(BODY_FINISHES[1].color, BLACK),
    options: { brackets: true, items: false },
    optionSpecs: [
      { key: 'brackets', label: 'Visible brackets', kind: 'toggle' },
      { key: 'items', label: 'Styled: mugs, jars, books, a plant', kind: 'toggle' },
    ],
    editable: ['w', 'd'],
  },
  pegGrid: {
    label: 'Wire grid',
    note: 'With S-hooks and utensils',
    group: 'Kitchen & wall',
    mount: 'wall',
    size: [0.9, 0.6, 0.02],
    uses: ['metal'],
    finish: finish(PLY, BLACK),
    options: { utensils: true },
    optionSpecs: [{ key: 'utensils', label: 'Hanging utensils', kind: 'toggle' }],
    editable: ['w', 'h'],
  },
  kitchenRail: {
    label: 'Rail',
    note: 'Hook rail or knife strip',
    group: 'Kitchen & wall',
    mount: 'wall',
    size: [0.6, 0.03, 0.04],
    uses: ['metal'],
    finish: finish(PLY, METAL_FINISHES[3].color),
    options: { variant: 'hooks' },
    optionSpecs: [
      {
        key: 'variant',
        label: 'Type',
        kind: 'chips',
        choices: [
          { id: 'hooks', label: 'Hooks + tools' },
          { id: 'knives', label: 'Knife strip' },
        ],
      },
    ],
    editable: ['w'],
  },
  fruitBaskets: {
    label: 'Fruit baskets',
    note: '3-tier wire, on the wall',
    group: 'Kitchen & wall',
    mount: 'wall',
    size: [0.42, 0.72, 0.24],
    uses: ['metal'],
    finish: finish(),
    options: { fruit: true },
    optionSpecs: [{ key: 'fruit', label: 'Filled with fruit', kind: 'toggle' }],
    editable: [],
  },
  stationClock: {
    label: 'Station clock',
    note: 'Double-sided, shows the time',
    group: 'Decor',
    mount: 'wall',
    size: [0.09, 0.17, 0.38],
    uses: ['metal'],
    finish: finish(PLY, BLACK),
    options: {},
    optionSpecs: [],
    editable: [],
  },
  retroClock: {
    label: 'Retro wall clock',
    note: 'Rounded red triangle, shows the time',
    group: 'Decor',
    mount: 'wall',
    size: [0.32, 0.3, 0.05],
    uses: ['metal'],
    finish: finish(PLY, '#c9302c'),
    options: { shape: 'triangle' },
    optionSpecs: [
      {
        key: 'shape',
        label: 'Shape',
        kind: 'chips',
        choices: [
          { id: 'triangle', label: 'Triangle' },
          { id: 'round', label: 'Round' },
        ],
      },
    ],
    editable: [],
  },
  railTable: {
    label: 'Folding rail table',
    note: 'Drop-leaf, on a wall or railing',
    group: 'Balcony',
    mount: 'wall',
    // Brackets 45 cm up put the leaf at table height (75 cm).
    mountHeight: 0.45,
    size: [0.6, 0.3, 0.4],
    presets: [
      { label: '60 × 40', size: [0.6, 0.3, 0.4] },
      { label: '80 × 40', size: [0.8, 0.3, 0.4] },
      { label: 'Bar 100 × 30', size: [1.0, 0.25, 0.3] },
    ],
    uses: ['body', 'metal'],
    finish: finish(BODY_FINISHES[1].color, BLACK),
    options: { open: true },
    optionSpecs: [{ key: 'open', label: 'Leaf up', kind: 'toggle' }],
    editable: ['w', 'd'],
  },
  embroideryHoop: {
    label: 'Cross-stitch hoop',
    note: 'Pixel art on linen, wood hoop',
    group: 'Decor',
    mount: 'wall',
    size: [0.2, 0.2, 0.015],
    presets: [
      { label: '15 cm', size: [0.15, 0.15, 0.015] },
      { label: '20 cm', size: [0.2, 0.2, 0.015] },
      { label: '30 cm', size: [0.3, 0.3, 0.015] },
    ],
    uses: ['body'],
    finish: finish(BODY_FINISHES[0].color),
    options: { motif: 'egg' },
    optionSpecs: [
      {
        key: 'motif',
        label: 'Motif',
        kind: 'chips',
        choices: [
          { id: 'egg', label: 'Fried egg' },
          { id: 'cherries', label: 'Cherries' },
          { id: 'cactus', label: 'Cactus' },
          { id: 'heart', label: 'Heart' },
        ],
      },
    ],
    editable: [],
  },
  hangingRack: {
    label: 'Ceiling grid rack',
    note: 'On chains, for plants and pans',
    group: 'Kitchen & wall',
    mount: 'ceiling',
    size: [0.9, 0.6, 0.45],
    uses: ['metal'],
    finish: finish(),
    options: {},
    optionSpecs: [],
    editable: ['w', 'h', 'd'],
  },

  // ---------- appliances & electronics (the owner's own models) ----------
  speakers: {
    label: 'Edifier R1700BT',
    note: 'Pair of bookshelf speakers',
    group: 'Appliances & electronics',
    mount: 'surface',
    tabletop: true,
    size: [round2(2 * SPEAKER_W + 0.6), 0.24, 0.2],
    sizeFor: (o, s) => [round2(2 * SPEAKER_W + Number(o.spacing ?? 60) / 100), s[1], s[2]],
    uses: ['body'],
    finish: finish('#8a5b3b'),
    options: { spacing: 60, grille: true },
    optionSpecs: [
      { key: 'spacing', label: 'Gap between speakers', kind: 'range', min: 10, max: 250, step: 5, unit: 'cm' },
      { key: 'grille', label: 'Grilles on', kind: 'toggle' },
    ],
    editable: [],
  },
  standMixer: {
    label: 'KitchenAid Artisan',
    note: 'Tilt-head stand mixer',
    group: 'Appliances & electronics',
    mount: 'surface',
    tabletop: true,
    size: [0.24, 0.36, 0.36],
    uses: ['metal'],
    finish: finish(PLY, '#dfe2e5'),
    options: { color: 'red' },
    optionSpecs: [
      {
        key: 'color',
        label: 'Color',
        kind: 'chips',
        choices: [
          { id: 'red', label: 'Empire red' },
          { id: 'white', label: 'White' },
          { id: 'black', label: 'Black' },
          { id: 'pistachio', label: 'Pistachio' },
          { id: 'almond', label: 'Almond cream' },
        ],
      },
    ],
    editable: [],
  },
  espressoMachine: {
    label: 'Oster Perfect Brew',
    note: 'Barista espresso machine',
    group: 'Appliances & electronics',
    mount: 'surface',
    tabletop: true,
    size: [0.22, 0.3, 0.28],
    uses: ['metal'],
    finish: finish(PLY, '#d9dcdf'),
    options: { cup: true },
    optionSpecs: [{ key: 'cup', label: 'Cup on the tray', kind: 'toggle' }],
    editable: [],
  },
  turntable: {
    label: 'Audio-Technica AT-LP120X',
    note: 'USB turntable, direct drive',
    group: 'Appliances & electronics',
    mount: 'surface',
    tabletop: true,
    size: [0.45, 0.157, 0.352],
    uses: ['metal'],
    finish: finish(PLY, '#d3d6d8'),
    options: { plinth: 'black', label: 'red', cover: 'closed' },
    optionSpecs: [
      {
        key: 'plinth',
        label: 'Plinth',
        kind: 'chips',
        choices: [
          { id: 'black', label: 'Black' },
          { id: 'silver', label: 'Silver' },
        ],
      },
      {
        key: 'label',
        label: 'Record label',
        kind: 'chips',
        choices: [
          { id: 'red', label: 'Red' },
          { id: 'yellow', label: 'Yellow' },
          { id: 'blue', label: 'Blue' },
          { id: 'white', label: 'White' },
          { id: 'green', label: 'Green' },
        ],
      },
      {
        key: 'cover',
        label: 'Dust cover',
        kind: 'chips',
        choices: [
          { id: 'closed', label: 'Closed' },
          { id: 'open', label: 'Open' },
          { id: 'removed', label: 'Removed' },
        ],
      },
    ],
    editable: [],
  },
  acIndoor: {
    label: 'Split AC, indoor unit',
    note: 'Wall unit, hung high',
    group: 'Appliances & electronics',
    mount: 'wall',
    size: [0.8, 0.28, 0.21],
    mountHeight: 2.1,
    uses: ['body'],
    finish: finish('#f3f3f0'),
    options: { display: true },
    optionSpecs: [{ key: 'display', label: 'Display lit', kind: 'toggle' }],
    editable: [],
  },
  acOutdoor: {
    label: 'Split AC, outdoor unit',
    note: 'Condenser, for the balcony',
    group: 'Appliances & electronics',
    mount: 'surface',
    size: [0.78, CONDENSER_H, 0.29],
    sizeFor: (o, s) => [s[0], round2(CONDENSER_H + (o.bracket === true ? Number(o.lift ?? 100) / 100 : 0)), s[2]],
    uses: ['body', 'metal'],
    finish: finish('#e6e4dd', METAL_FINISHES[3].color),
    options: { bracket: false, lift: 100 },
    optionSpecs: [
      { key: 'bracket', label: 'On a wall bracket', kind: 'toggle' },
      { key: 'lift', label: 'Bracket height', kind: 'range', min: 30, max: 180, step: 5, unit: 'cm' },
    ],
    editable: [],
  },
  tv: {
    label: 'TV on a stand',
    note: '16:9, for a sideboard or desk',
    group: 'Appliances & electronics',
    mount: 'surface',
    tabletop: true,
    size: [tvPanel(55)[0], round2(tvPanel(55)[1] + TV_LIFT.feet), 0.25],
    sizeFor: (o) => {
      const [w, h] = tvPanel(Number(o.inches ?? 55))
      return [w, round2(h + (o.stand === 'pedestal' ? TV_LIFT.pedestal : TV_LIFT.feet)), 0.25]
    },
    uses: ['metal'],
    finish: finish(PLY, '#161718'),
    options: { inches: 55, stand: 'feet', screen: 'off', youtube: '', image: '' },
    optionSpecs: [
      { key: 'inches', label: 'Size', kind: 'chips', choices: tvSizeChoices },
      {
        key: 'stand',
        label: 'Stand',
        kind: 'chips',
        choices: [
          { id: 'feet', label: 'Two feet' },
          { id: 'pedestal', label: 'Center pedestal' },
        ],
      },
      tvScreen,
      tvImage,
      tvYouTube,
    ],
    editable: [],
  },
  tvWall: {
    label: 'TV on the wall',
    note: '16:9, slim wall mount',
    group: 'Appliances & electronics',
    mount: 'wall',
    size: [...tvPanel(55), 0.06],
    // Bottom edge that puts a 55″ screen's center at a seated eye height of about 1.1 m.
    mountHeight: 0.75,
    sizeFor: (o) => [...tvPanel(Number(o.inches ?? 55)), 0.06],
    uses: ['metal'],
    finish: finish(PLY, '#161718'),
    options: { inches: 55, screen: 'off', youtube: '', image: '' },
    optionSpecs: [{ key: 'inches', label: 'Size', kind: 'chips', choices: tvSizeChoices }, tvScreen, tvImage, tvYouTube],
    editable: [],
  },
  fridge: {
    label: 'Fridge',
    note: 'Built-in look or retro, any color',
    group: 'Appliances & electronics',
    mount: 'surface',
    size: [0.6, 1.75, 0.62],
    presets: [
      { label: 'Compact 55', size: [0.55, 1.45, 0.6] },
      { label: 'Standard 60', size: [0.6, 1.75, 0.62] },
      { label: 'Tall 60', size: [0.6, 1.9, 0.66] },
      { label: 'Wide 70', size: [0.7, 1.9, 0.7] },
      { label: 'Retro FAB28', size: [0.6, 1.5, 0.73] },
    ],
    uses: ['body', 'metal'],
    bodyColors: [
      { label: 'White', color: '#e2e3e4' },
      { label: 'Stainless', color: '#c9ccce' },
      { label: 'Black', color: '#2a2b2d' },
      { label: 'Cream', color: '#efe3c8' },
      { label: 'Pastel blue', color: '#9fc3d6' },
      { label: 'Pastel green', color: '#b5d3b0' },
      { label: 'Pink', color: '#eab8c0' },
      { label: 'Red', color: '#b8322a' },
    ],
    finish: finish('#e2e3e4', METAL_FINISHES[3].color),
    options: { style: 'modern', freezer: 'top' },
    optionSpecs: [
      {
        key: 'style',
        label: 'Style',
        kind: 'chips',
        choices: [
          { id: 'modern', label: 'Modern' },
          { id: 'retro', label: 'Retro (rounded)' },
        ],
      },
      {
        key: 'freezer',
        label: 'Freezer',
        kind: 'chips',
        choices: [
          { id: 'top', label: 'On top' },
          { id: 'bottom', label: 'At the bottom' },
          { id: 'none', label: 'None (one door)' },
        ],
      },
    ],
    editable: ['w', 'h', 'd'],
  },
}

export const FURNITURE_GROUPS: FurnitureSpec['group'][] = ['Sleep', 'Sit', 'Work & dine', 'Storage', 'Kitchen & wall', 'Balcony', 'Decor', 'Appliances & electronics']

/** Presentation only: extra words the panel search matches. */
export const FURNITURE_KEYWORDS: Partial<Record<FurnitureType, string>> = {
  platformBed: 'double single mattress',
  murphyBed: 'murphy fold',
  daybed: 'sofa bed guest',
  sofa: 'couch settee',
  standingDesk: 'office work table',
  diningTable: 'dinner eat',
  chair: 'seat',
  butterflyChair: 'bkf hardoy seat lounge',
  bookshelf: 'books cubes shelving',
  wardrobe: 'closet clothes',
  sideboard: 'tv cabinet credenza',
  blockShelf: 'bricks books shelving',
  rug: 'carpet',
  gridShelf: 'wall shelving',
  upperCabinets: 'kitchen wall cupboard glass',
  floatingShelf: 'wall',
  pegGrid: 'pegboard kitchen wall',
  kitchenRail: 'hooks knives utensils',
  fruitBaskets: 'kitchen wire',
  stationClock: 'wall time',
  hangingRack: 'pots pans ceiling kitchen',
  speakers: 'edifier r1700bt bookshelf audio music sound',
  standMixer: 'kitchenaid artisan baking kitchen',
  espressoMachine: 'oster coffee barista cafe kitchen',
  turntable: 'audio-technica at-lp120x record player vinyl music',
  acIndoor: 'air conditioner split aire acondicionado',
  acOutdoor: 'air conditioner condenser compressor split balcony',
  tv: 'television tele screen smart tv 32 43 50 55 65 75 inch pulgadas',
  tvWall: 'television tele screen smart tv wall mounted 32 43 50 55 65 75 inch pulgadas',
  fridge: 'refrigerator heladera freezer smeg retro kitchen',
  loftBed: 'loft mezzanine high bed stairs steps drawers',
  glassDivider: 'partition screen reeded fluted glass wall',
  officeChair: 'desk task swivel ergonomic mesh',
  bistroChair: 'stool cafe metal tube stacking',
  windowBench: 'kitchen seat banquette storage',
  wireBasket: 'laundry hamper burlap coffee sack jute',
  balconyBench: 'outdoor pallet sofa daybed terrace',
  planterWall: 'cinder concrete blocks plants succulents',
  retroClock: 'wall time red kitsch',
  railTable: 'folding drop leaf balcony bar table railing',
  embroideryHoop: 'embroidery cross stitch wall art egg',
  mugs: 'cups coffee tea ceramic stoneware kitchen',
}
