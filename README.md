# Monoambiente

A real-time 3D model of the studio, for planning the interior.

```sh
pnpm install
pnpm dev            # http://localhost:5173
```

## Where things live

- `src/project/shell.ts`: walls, openings (doors, the balcony slider, the passage), columns, beams, bathroom tiles, rooms and ceilings. All in meters.
- `src/project/objects.ts`: fixtures and, later, furniture and decor.
- `src/project/materials.ts`: named colors, plus plank and tile patterns.
- `data/decor.json`: artwork, plants and lights you place in the app. The panel saves every change here, and editing the file by hand (or asking Claude to) updates open tabs live.
- `public/artwork/`: the image library. Uploads from the panel land here.

Coordinates: `x` runs from the inner face of the entry wall (0) to the balcony window (6.9). `z` runs from the bathroom side (0) to the kitchen side (3.0). `y` is up.

## Views

- **Dollhouse** cuts away the exterior walls facing the camera down to a 30 cm stub.
- **X-ray** makes every wall translucent.
- Presets: two isometric views, top, and eye level from the balcony and from the entry.
- URL params `?view=<preset>&mode=dollhouse|xray&light=evening&dims=0` open straight into a view; `?cam=x,y,z,tx,ty,tz[,fov]` sets an exact camera.

## Decor panel

- **Artwork:** pick an image (or upload one), click a wall to hang it, then choose the print size (A5 to A2, 50×70 or custom), orientation, crop or whole image, frame style (poster, thin, classic, box, float, canvas), frame color, mat width and center height.
- **Furniture:** platform bed with cubbies, wall bed, daybed, low sofa, motorized standing desk (sit/stand), dining table with chairs, plywood chair, BKF butterfly chair, cubby bookshelf, plywood wardrobe, sideboard, block-and-plank shelf, rug. On the walls: steel grid shelf, reeded-glass cabinets, floating shelf, wire grid, hook rail or knife strip, fruit baskets, station clock. From the ceiling: a grid rack. Each piece has editable dimensions and wood, metal and fabric finishes. Floor pieces snap flush to the nearest wall; hold `Alt` to place freely.
- **Plants:** monstera, fiddle-leaf fig, snake plant, areca palm, Boston fern, olive tree, cactus, lavender box, rubber plant, croton, spider plant, jade, burro's tail, succulent, haworthia, aloe, herbs, a hanging pothos, a wall window box, and a *succulent collection* that fills a strip with small clay pots. Any plant can go in a standard 6, 8 or 12 cm clay pot. Plants can sit on furniture (shelves, desk, bed shelf).
- **Lights:** arc, tripod, table, mushroom and flowerpot lamps, dome, globe and paper-lantern pendants, a wall sconce, a red EXIT cube, and string lights. Set on/off, brightness, warmth (2700–4000 K) and color.
- **Day / Evening** in the toolbar switches the sun off so the lamps and the ceiling downlights take over.
- Click to select, drag to move (a footprint turns red on overlaps; the wall it snaps to lights up), or turn it with the ring. The edit bar at the bottom has rotate, duplicate, delete, undo and redo.

## Layouts and finishes

- **Layouts:** the menu at the top of the panel lists every saved arrangement: *Current* is `data/decor.json`, named ones are `data/decor.<slug>.json` (each file keeps its display name, items and finishes). Switch, save the current one as a new layout, rename or delete (with confirmation). Switching updates `?decor=` without a reload and starts a fresh undo history. **A/B** (or `B`) flips between the open layout and the previous one, or the one picked with the compare button in the menu. Files starting with `e2e` or `test` are left out of the list.
- **Room tab (finishes):** floors for the main room, the hall + kitchen zone, the bathroom and the balcony (light or natural oak, walnut, oak herringbone, polished concrete, grey or charcoal hexagons, terracotta, blue/cream quarter-circle cement tiles), with an option to scatter the hall's hexagons into the main room past the passage. Wall paint for the whole apartment, an optional accent wall in the main room (bath side, kitchen side, entry wall) and the bathroom wall tile layout and color. Finishes are saved in the layout file (`finishes`, only when they differ from the original look) and apply in place: materials and textures change, meshes and draw calls do not.
- Dev API: `GET /api/layouts`, `POST /api/layouts {name, data}`, `PATCH /api/layouts?file=<slug> {name}`, `DELETE /api/layouts?file=<slug>` (see `server/layouts.ts`).
- Named layouts are versioned like `data/decor.json`. Only scratch files used by tests are git-ignored (`e2e*`, `test*`, `snap`, `furn`, `edit`, `objects`, `devices`).

## Keyboard

| Keys | Action |
|---|---|
| `1`–`5` | Camera presets |
| `X` · `M` · `L` | X-ray · dimensions · day/evening |
| `B` | Flip A/B between two layouts |
| `\` · `?` · `/` | Toggle panel · shortcuts · search |
| `Cmd/Ctrl+Z` · `Shift+Cmd/Ctrl+Z` (or `Ctrl+Y`) | Undo · redo |
| `Cmd/Ctrl+C` · `V` · `D` | Copy · paste at the pointer · duplicate |
| Arrows (`Shift` = 10 cm) | Nudge 1 cm; wall items slide along their wall |
| `PageUp`/`PageDown` or `[` `]` | Raise / lower wall items |
| `R` / `Shift+R` | Rotate (quarter turns for furniture) |
| `Delete` · `Esc` | Remove · cancel a placement or drag |
| `Alt` while placing | Skip wall snapping |

## Screenshots

With the dev server running:

```sh
CHROME_PATH=/path/to/chrome node scripts/shoot.mjs shots http://localhost:5173 iso-balcony:dollhouse:evening
CHROME_PATH=/path/to/chrome node scripts/e2e-decor.mjs shots   # clicks through the panel
```

Test runs use `?decor=<name>` with a scratch name (`e2e-…`, `test-…`, `furn`, …), which reads and writes a git-ignored `data/decor.<name>.json` instead of your layout.

## Tests

```sh
pnpm test           # unit tests (vitest + jsdom): geometry, placement, store, catalogs, plants, dev API
pnpm test:types     # type-checks the tests
BASE_URL=http://localhost:5184 CHROME_PATH=/path/to/chrome pnpm test:e2e   # needs a running dev server
```

Unit tests live in `tests/unit`. The e2e smoke test (`tests/e2e/smoke.mjs`) switches views, opens each panel tab and places an artwork, a plant, lamps and a desk through the UI, then checks `data/decor.e2e-smoke.json` through the dev API. Screenshots go to `test-results/e2e/` (git-ignored).
