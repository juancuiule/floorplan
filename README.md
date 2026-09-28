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

Coordinates: `x` runs from the inner face of the entry wall (0) to the balcony window (6.9). `z` runs from the bathroom side (0) to the kitchen side (3.0). `y` is up.

## Views

- **Dollhouse** cuts away the exterior walls facing the camera down to a 30 cm stub.
- **X-ray** makes every wall translucent.
- Presets: two isometric views, top, and eye level from the balcony and from the entry.
- URL params `?view=<preset>&mode=dollhouse|xray&dims=0` open straight into a view.

## Screenshots

With the dev server running:

```sh
CHROME_PATH=/path/to/chrome node scripts/shoot.mjs shots
```
