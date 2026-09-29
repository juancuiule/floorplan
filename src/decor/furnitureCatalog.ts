import type { FurnitureOption, FurnitureType } from '../model/decor'
import type { Vec3 } from '../model/types'
import type { Mount } from './catalog'

export type OptionSpec =
  | { key: string; label: string; kind: 'toggle' }
  | { key: string; label: string; kind: 'chips'; choices: { id: FurnitureOption; label: string }[] }
  | { key: string; label: string; kind: 'range'; min: number; max: number; step: number; unit?: string }

export interface FurnitureSpec {
  label: string
  note: string
  group: 'Sleep' | 'Sit' | 'Work & dine' | 'Storage' | 'Kitchen & wall' | 'Decor' | 'Appliances & electronics'
  mount: Mount
  /** Default [w, h, d] in meters. */
  size: Vec3
  /** Wall pieces: the usual height of the bottom edge; placing near it settles there. */
  mountHeight?: number
  /** Pieces whose size follows their options (a speaker pair's spacing): the size for these options. */
  sizeFor?: (options: Record<string, FurnitureOption>, size: Vec3) => Vec3
  presets?: { label: string; size: Vec3 }[]
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
    options: { brackets: true },
    optionSpecs: [{ key: 'brackets', label: 'Visible brackets', kind: 'toggle' }],
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
}

export const FURNITURE_GROUPS: FurnitureSpec['group'][] = ['Sleep', 'Sit', 'Work & dine', 'Storage', 'Kitchen & wall', 'Decor', 'Appliances & electronics']

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
}
