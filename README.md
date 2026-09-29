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
- **Furniture:** platform bed with cubbies, raised sleeping platform (drawers underneath, storage steps on either side), wall bed, daybed, low sofa, window bench, motorized standing desk (sit/stand), ergonomic office chair, dining table with chairs, plywood chair, bent-tube chair or stool, BKF butterfly chair, cubby bookshelf, plywood wardrobe, sideboard, block-and-plank shelf, wire basket with a burlap coffee sack, reeded/frosted/clear glass room divider, rug. For the balcony: a slatted or pallet daybed with pillows, a cinder-block planter wall with succulents in the cells, and a folding drop-leaf table. On the walls: steel grid shelf, reeded-glass cabinets, floating shelf (bare or styled with mugs, jars, books and a plant), wire grid, hook rail or knife strip, fruit baskets, station clock, a red retro clock, a cross-stitch hoop. From the ceiling: a grid rack. Each piece has editable dimensions and wood, metal and fabric finishes. Floor pieces snap flush to the nearest wall; hold `Alt` to place freely.
- **Plants:** monstera, fiddle-leaf fig, snake plant, areca palm, Boston fern, olive tree, cactus, lavender box, rubber plant, croton, spider plant, jade, burro's tail, succulent, haworthia, aloe, herbs, a hanging pothos, a wall window box, and a *succulent collection* that fills a strip with small clay pots. Any plant can go in a standard 6, 8 or 12 cm clay pot. Plants can sit on furniture (shelves, desk, bed shelf).
- **Lights:** arc, tripod, table, mushroom and flowerpot lamps, dome, globe and paper-lantern pendants, a wall sconce, a red EXIT cube, a milk-glass EXIT sign for the ceiling, and string lights. Set on/off, brightness, warmth (2700–4000 K) and color.
- **Day / Evening** in the toolbar switches the sun off so the lamps and the ceiling downlights take over.
- Click to select, drag to move (a footprint turns red on overlaps; the wall it snaps to lights up), or turn it with the ring. The edit bar at the bottom has rotate, duplicate, delete, undo and redo.

## Keyboard

| Keys | Action |
|---|---|
| `1`–`5` | Camera presets |
| `X` · `M` · `L` | X-ray · dimensions · day/evening |
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

Test runs use `?decor=<name>`, which reads and writes `data/decor.<name>.json` (git-ignored) instead of your layout.

## Tests

```sh
pnpm test           # unit tests (vitest + jsdom): geometry, placement, store, catalogs, plants, dev API
pnpm test:types     # type-checks the tests
BASE_URL=http://localhost:5184 CHROME_PATH=/path/to/chrome pnpm test:e2e   # needs a running dev server
```

Unit tests live in `tests/unit`. The e2e smoke test (`tests/e2e/smoke.mjs`) switches views, opens each panel tab and places an artwork, a plant, lamps and a desk through the UI, then checks `data/decor.e2e-smoke.json` through the dev API. Screenshots go to `test-results/e2e/` (git-ignored).
