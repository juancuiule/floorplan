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
- URL params `?view=<preset>&mode=dollhouse|xray&dims=0` open straight into a view.

## Decor panel

- **Artwork:** pick an image (or upload one), click a wall to hang it, then choose the print size (A5 to A2, 50×70 or custom), orientation, crop or whole image, frame style (poster, thin, classic, box, float, canvas), frame color, mat width and center height.
- **Plants:** monstera, fiddle-leaf fig, snake plant, areca palm, Boston fern, olive tree, cactus, lavender planter box, and a hanging pothos that goes on the ceiling. Choose the pot, size and rotation.
- **Lights:** arc, tripod, table and mushroom lamps, dome and globe pendants, a wall sconce, and string lights. Set on/off, brightness, warmth (2700–4000 K) and color.
- **Day / Evening** in the toolbar switches the sun off so the lamps and the ceiling downlights take over.
- Drag any item to move it. `R` / `Shift+R` rotates, `Delete` removes, `Esc` cancels a placement.

## Screenshots

With the dev server running:

```sh
CHROME_PATH=/path/to/chrome node scripts/shoot.mjs shots http://localhost:5173 iso-balcony:dollhouse:evening
CHROME_PATH=/path/to/chrome node scripts/e2e-decor.mjs shots   # clicks through the panel
```

Test runs use `?decor=<name>`, which reads and writes `data/decor.<name>.json` (git-ignored) instead of your layout.
