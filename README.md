# Monoambiente

A real-time 3D model of the studio, for planning the interior.

```sh
pnpm install
pnpm dev            # http://localhost:5173
```

## Plans

Each apartment is a plan file in `src/plans/<id>.plan.json` (type in `src/model/plan.ts`): its walls and openings, rooms, floors and ceilings, fixed fittings, materials, where it is (for the sun), and design rules: which partitions can come out, which walls take an accent color, which wall is the facade, a raisable dropped ceiling, and optional camera presets. Anything the file leaves out is derived from its geometry (`src/project/derived.ts`).

- `?plan=<id>` opens another plan; the default is `monoambiente`. `loft` is a small test plan in Madrid.
- Each plan has its own layouts: another plan's main layout is `data/decor.plan-<id>.json`, and layout files record their `plan`, so the layouts menu only lists the open plan's.

## Where things live

- `src/plans/monoambiente.plan.json`: this apartment (see Plans above).
- `data/decor.json`: artwork, plants and lights you place in the app. The panel saves every change here, and editing the file by hand (or asking Claude to) updates open tabs live.
- `public/artwork/`: the image library. Uploads from the panel land here.

Coordinates: `x` runs from the inner face of the entry wall (0) to the balcony window (6.9). `z` runs from the bathroom side (0) to the kitchen side (3.0). `y` is up.

## Views

- **Dollhouse** cuts away the exterior walls facing the camera down to a 30 cm stub.
- **X-ray** makes every wall translucent.
- Presets: two isometric views, top, and eye level from the balcony and from the entry.
- URL params `?view=<preset>&mode=dollhouse|xray&light=evening&dims=0` open straight into a view; `?cam=x,y,z,tx,ty,tz[,fov]` sets an exact camera; `?sun=HH:MM&date=YYYY-MM-DD&facing=N` (or `facing=250`) sets the sun (`scripts/sun-shots.sh` shoots a set of them).

## Decor panel

- **Artwork:** pick an image (or upload one), click a wall to hang it, then choose the print size (A5 to A2, 50×70 or custom), orientation, crop or whole image, frame style (poster, thin, classic, box, float, canvas), frame color, mat width and center height.
- **Furniture:** platform bed with cubbies, raised sleeping platform (drawers underneath, storage steps on either side), wall bed, daybed, low sofa, window bench, motorized standing desk (sit/stand), ergonomic office chair, dining table with chairs, plywood chair, bent-tube chair or stool, BKF butterfly chair, cubby bookshelf, plywood wardrobe, sideboard, block-and-plank shelf, wire basket with a burlap coffee sack, reeded/frosted/clear glass room divider, rug. For the balcony: a slatted or pallet daybed with pillows, a cinder-block planter wall with succulents in the cells, and a folding drop-leaf table. On the walls: steel grid shelf, reeded-glass cabinets, floating shelf (bare or styled with mugs, jars, books and a plant), wire grid, hook rail or knife strip, fruit baskets, station clock, a red retro clock that shows the real time, a cross-stitch hoop. On a counter or shelf: a set of speckled stoneware mugs (optionally on a wood tray). From the ceiling: a grid rack. Appliances & electronics: Edifier R1700BT speakers, KitchenAid stand mixer, Oster espresso machine, Audio-Technica AT-LP120X turntable, split AC (indoor and outdoor units), and TVs from 32″ to 75″ on feet, a pedestal or the wall, screen on or off. Each piece has editable dimensions and wood, metal and fabric finishes. Floor pieces snap flush to the nearest wall; hold `Alt` to place freely.
- **Plants:** monstera, fiddle-leaf fig, snake plant, areca palm, Boston fern, olive tree, cactus, lavender box, rubber plant, croton, spider plant, jade, burro's tail, succulent, haworthia, aloe, herbs, a hanging pothos, a wall window box, and a *succulent collection* that fills a strip with small clay pots. Any plant can go in a standard 6, 8 or 12 cm clay pot. Plants can sit on furniture (shelves, desk, bed shelf).
- **Lights:** arc, tripod, table, mushroom and flowerpot lamps, dome, globe and paper-lantern pendants, a wall sconce, a red EXIT cube, a milk-glass EXIT sign for the ceiling, and string lights. Set on/off, brightness, warmth (2700–4000 K) and color.
- **Sun study** (the clock button in the toolbar): the real sun over Buenos Aires (UTC−3) for any date and time, through the balcony door. Scrub the time (sunrise and sunset are marked), pick a date or a solstice/equinox, set which way the balcony faces (N, NE… or any bearing; saved in the browser), or play a whole day in 12 s. Once the sun is 4° below the horizon it's night and the lamps and ceiling downlights take over. **Day / Evening** jump to today at 15:00 and 21:00. `src/sun/solar.ts` has the solar math; `src/scene/SunOccluders.tsx` adds shadow-only roof and walls so sunlight only enters through the balcony door even in dollhouse views (the balcony's side walls are assumed).
- Click to select, drag to move (a footprint turns red on overlaps; the wall it snaps to lights up), or turn it with the ring. The edit bar at the bottom has rotate, duplicate, delete, undo and redo.
- **Smart guides:** while dragging or placing, a piece's edges and center snap (within 3 cm) to those of other pieces on the same wall, or on the floor, with thin red guide lines; it also snaps to equal gaps along a row (the gaps show in cm), and artwork is pulled to the 150 cm gallery line (amber). Hold `Alt` or `Cmd/Ctrl` to drag freely. `src/decor/guides.ts` has the math.
- **Selections and groups:** `Shift`+click (or `Shift`+drag a rectangle over the room) selects several pieces; dragging any of them moves them all (wall pieces stay on their wall, and move to another wall together). The edit bar then has align (left, center, right, top, middle, bottom), distribute with equal gaps, match size and frame (artwork), group and ungroup; delete, duplicate, copy/paste, nudge and rotate act on the whole selection, and each is one undo step. `Cmd/Ctrl+G` groups: clicking a grouped piece picks up the group, `Alt`+click or a double-click picks one piece. Groups are saved in the layout file (`groupId` on items, names under `groups`) and show at the top of *In the room*, where they can be expanded; name one in the panel. **Hang as a gallery** (panel, for selected artwork on one wall) arranges them in a row or a grid with a 5, 8 or 10 cm gap, centered on a chosen line (150 cm by default).

## Layouts and finishes

- **Layouts:** the menu at the top of the panel lists every saved arrangement: *Current* is `data/decor.json`, named ones are `data/decor.<slug>.json` (each file keeps its display name, items and finishes). Switch, save the current one as a new layout, rename or delete (with confirmation). Switching updates `?decor=` without a reload and starts a fresh undo history. **A/B** (or `B`) flips between the open layout and the previous one, or the one picked with the compare button in the menu. Files starting with `e2e` or `test` are left out of the list.
- **Room tab (finishes):** floors for the main room, the hall + kitchen zone, the bathroom and the balcony (light or natural oak, walnut, oak herringbone, polished concrete, grey or charcoal hexagons, terracotta, blue/cream quarter-circle cement tiles), with an option to scatter the hall's hexagons into the main room past the passage. Wall paint for the whole apartment, an optional accent wall in the main room (bath side, kitchen side, entry wall) and the bathroom wall tile layout and color. Finishes are saved in the layout file (`finishes`, only when they differ from the original look) and apply in place: materials and textures change, meshes and draw calls do not. `Cmd/Ctrl+Z` undoes a finish or a wall taken out like any other edit (a color picker drag is one step).
- **What if without this wall** (Room tab → *Walls*): a small plan of the flat where the four interior partitions can be clicked out and back (bathroom ↔ hall, bathroom ↔ niche, shower ↔ niche, hall ↔ main room), with the same switches in a list. The entry wall, the party walls, the facade, the columns and the beam are structural or exterior: they show locked. A removed partition takes what it carried with it (door leaf and frame, bathroom tiles, accent paint, the passage header); the hall ↔ main room wall keeps its first 80 cm, the shower's back (plumbing) wall. The 2.40 dropped ceiling over the entry zone stays by default (it hides services), closed by a bulkhead where the wall stood; **Raise the entry ceiling to 2.60** is a separate option that moves the downlights up too. The floor under a removed wall is finished like the room on each side up to the old centerline, and an optional dashed outline marks where the wall was. Walk mode, wall snapping, overlap and clearance checks, the measure tool and shadows all follow the removed walls. Decor hung on a removed wall stays where it was, marked *Wall removed* in the room list and the inspector, until you move it. The choice is saved per layout in `finishes.structure` (`{ "removedWalls": ["entry-main"], "raiseEntryCeiling": false }`, only written when something differs), so A/B compares the flat with and without a wall. `src/project/structure.ts` builds the active shell; code that reads walls goes through `activeWalls()` / `activeShell()`.
- Dev API: `GET /api/layouts`, `POST /api/layouts {name, data}`, `PATCH /api/layouts?file=<slug> {name}`, `DELETE /api/layouts?file=<slug>` (see `server/layouts.ts`).
- Named layouts are versioned like `data/decor.json`. Only scratch files used by tests are git-ignored (`e2e*`, `test*`, `snap`, `furn`, `edit`, `objects`, `devices`).

## Keyboard

| Keys | Action |
|---|---|
| `1`–`5` | Camera presets |
| `X` · `M` · `L` | X-ray · dimensions · day/evening |
| `,` · `.` | Sun 15 minutes earlier · later |
| `B` | Flip A/B between two layouts |
| `\` · `?` · `/` | Toggle panel · shortcuts · search |
| `W` · `T` · `C` | Walk mode (or double-click the floor) · measure · clearances around the selection |
| `WASD` / `↑` `↓` (`Shift` = faster) · `←` `→` · drag | Walk mode: move · turn · look around; `Esc` goes back to the orbit view |
| Click, click (`Shift` = straight) · `Delete` | Measure tool: take a dimension (snaps to edges within 5 cm) · remove the hovered or last one |
| `Cmd/Ctrl+Z` · `Shift+Cmd/Ctrl+Z` (or `Ctrl+Y`) | Undo · redo |
| `Cmd/Ctrl+C` · `V` · `D` | Copy · paste at the pointer · duplicate |
| Arrows (`Shift` = 10 cm) | Nudge 1 cm; wall items slide along their wall |
| `PageUp`/`PageDown` or `[` `]` | Raise / lower wall items |
| `R` / `Shift+R` | Rotate (quarter turns for furniture) |
| `Delete` · `Esc` | Remove · cancel a placement or drag |
| `Alt` while placing · `Cmd/Ctrl` while dragging | Skip wall snapping and smart guides · skip smart guides |
| `Shift`+click · `Shift`+drag on the room | Add to / remove from the selection · rubber-band select |
| `Cmd/Ctrl+A` | Select everything on the selected piece's wall (or everything of its kind) |
| `Cmd/Ctrl+G` · `Shift+Cmd/Ctrl+G` | Group · ungroup the selection |
| `Alt`+click (or double-click) | Pick one piece inside a group |
| `Alt+A` · `Alt+H` · `Alt+D` | Align left · centers · right (along the wall, or left to right on screen) |
| `Alt+W` · `Alt+V` · `Alt+S` | Align tops · middles · bottoms (height on a wall, far to near on the floor) |
| `Alt+Shift+H` · `Alt+Shift+V` | Distribute with equal gaps across · up and down |

## Screenshots

With the dev server running:

```sh
CHROME_PATH=/path/to/chrome node scripts/shoot.mjs shots http://localhost:5173 iso-balcony:dollhouse:evening
CHROME_PATH=/path/to/chrome node scripts/e2e-decor.mjs shots   # clicks through the panel
CHROME_PATH=/path/to/chrome node scripts/shoot-gallery.mjs shots http://localhost:5173   # gallery wall, align tools, floor guides
```

Test runs use `?decor=<name>` with a scratch name (`e2e-…`, `test-…`, `furn`, …), which reads and writes a git-ignored `data/decor.<name>.json` instead of your layout.

## Tests

```sh
pnpm test           # unit tests (vitest + jsdom): geometry, placement, store, catalogs, plants, dev API
pnpm test:types     # type-checks the tests
BASE_URL=http://localhost:5184 CHROME_PATH=/path/to/chrome pnpm test:e2e   # needs a running dev server
```

Unit tests live in `tests/unit`. The e2e smoke test (`tests/e2e/smoke.mjs`) switches views, opens each panel tab and places an artwork, a plant, lamps and a desk through the UI, then checks `data/decor.e2e-smoke.json` through the dev API. `tests/e2e/walk-measure.mjs` walks through the flat (entry, passage, balcony, walls), measures on the floor and checks the clearance overlay. `tests/e2e/walls.mjs` takes the hall ↔ main room wall out in the Room tab, checks the saved layout, walks straight through where it stood and puts it back. `scripts/e2e-align.mjs <outDir> <baseUrl>` hangs three artworks, Shift-selects them, aligns, distributes, groups, drags the group, undoes, checks the smart guides and hangs them as a gallery, asserting `data/decor.test-align.json` at each step. `scripts/hunt.mjs <outDir> <baseUrl>` is an exploratory sweep over a scratch copy of your layout (`data/decor.test-hunt.json`): every tab and inspector, junk in number fields, undo/redo after each kind of edit, layouts, groups, walk, measure, the sun, `?plan=loft` and phone/wide viewports; it records console errors, failed requests and idle frames in `findings.json` next to its screenshots. Screenshots go to `test-results/e2e/` (ignored by version control).
