# Model your own apartment

The app doesn't depend on any one apartment: an apartment is a JSON file, a furnished version of it is another JSON file, and both live in a **workspace**, a folder the dev server opens. This guide covers cloning the repo, starting your own workspace, describing your place, hanging your artwork and furnishing it. The last section describes how the same pieces could become a multi-user platform.

The repo has two example workspaces: `examples/loft`, a made-up 6 × 4.2 m flat in Madrid that opens by default, and `examples/monoambiente`, the studio the project was built for (`FLOORPLAN_WORKSPACE=examples/monoambiente pnpm dev`).

## 1. Clone and run

You need Node 20.19 or newer and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/juancuiule/floorplan.git
cd floorplan
pnpm install
pnpm dev            # http://localhost:5173
```

Everything you change in the app (furniture, artwork, finishes, layouts) is saved as files in the open workspace by the dev server.

Start your own workspace from the loft, and point the dev server at it in `.env.local` (git-ignored, so it stays on your machine):

```sh
cp -r examples/loft workspaces/myflat
rm workspaces/myflat/layouts/decor.json      # start empty
echo 'FLOORPLAN_WORKSPACE=workspaces/myflat' > .env.local
```

The workspace can live anywhere (`FLOORPLAN_WORKSPACE` is relative to the repo, or absolute). Keep it in its own git repo if you want history for your layouts, or in a fork of this one.

## 2. Measure and pick your axes

Before writing anything, get a plan with dimensions: the building's floor plan, a sketch with a tape measure, or a listing's plan redrawn to scale. You'll need:

- every wall: where it runs, how thick it is, how tall
- every opening: doors, windows, passages (position along the wall, width, height, sill)
- the rooms (rectangles), and any ceiling that's lower than the rest
- fixed fittings: toilet, basin, shower, kitchen counter, sink, cooktop, fridge, ceiling lights
- columns and beams that stick out of walls
- the city, and which way the main window faces

Then pick axes. All numbers are in **meters**:

- `x` runs along the apartment's length. Put the entrance at `x = 0` (the inner face of the entry wall) and the **main window or balcony at the far end, on +x**. The sun controls assume the facade faces +x: the "facing" setting in the app is the compass bearing of +x.
- `z` runs across, from `0` (the inner face of one long wall) to the apartment's width.
- `y` is up, `0` is the finished floor.

Walls are drawn by their **centerline**, so a 20 cm wall whose inner face is at `x = 0` has its centerline at `x = -0.1`. Rooms, floors and ceilings are rectangles `[x0, z0, x1, z1]` of inner, usable space.

## 3. Write the plan file

Rename the loft's plan in your workspace, and make it the default in `workspace.json` (`"defaultPlan": "myflat"`):

```sh
mv workspaces/myflat/plans/loft.plan.json workspaces/myflat/plans/myflat.plan.json
```

Set `id` to `myflat` (it must match the file name), plus `name`, `subtitle` and `location` (`lat`, `lon`, `tz` in hours from UTC, no daylight saving). Then replace the geometry. The full type, with comments, is in `src/model/plan.ts` and `src/model/types.ts`. What each part is for:

| Field | What goes there |
|---|---|
| `materials` | Named colors and surface patterns (`planks`, `tiles`, `herringbone`, `hex`, `concrete`, `quarter`). Walls, floors and fixtures refer to them by name. |
| `shell.walls` | One entry per straight wall: `a` and `b` (centerline ends), `thickness`, `height`, `kind` (`exterior` walls are cut away in dollhouse view), `material`, and its `openings`. |
| `openings` | `kind` (`door`, `window`, `passage`), `offset` (from the wall's `a` end to the near edge), `width`, `height`, `sill` for windows, `leaf` for a door (hinge side, swing, how open) and `glazing` for windows. |
| `shell.rooms` | Named rectangles with their own floor material, if any, and whether to show a label. |
| `shell.baseFloors` | The continuous floor under everything that has no room floor of its own. |
| `shell.ceilings` | Ceiling rectangles and heights (a dropped ceiling over an entry is a second, lower one). |
| `shell.bulges` | Columns, beams and soffits: boxes attached to a host wall. |
| `shell.accentPanels` | Wall faces that can be painted in an accent color. |
| `shell.slab` | The slab under the whole flat. |
| `fixtures` | Fittings that don't move: `toilet`, `basin`, `showerTray`, `counter`, `kitchenSink`, `cooktop`, `fridge`, `downlight`, `railing`, or a plain `box`. `position` is the footprint's center at floor level; local +z is the front; `rotation` is in degrees. |
| `walls.labels` | Readable names for walls in the UI. |
| `walls.roles` | Which wall is the `facade` and which are `party` walls shared with neighbors (used for sun shadows). |
| `walls.removable` | Partitions that can come out in a "what if" layout, what they take with them, and the floor patch left under them. |
| `walls.accent` | Walls offered as accent walls. |
| `cameras` | Optional camera presets. Missing ones are derived from the plan's bounds. |

A few material names are special: the Room tab controls them, so leave them undefined or give them a default and the app will swap in the chosen finish:

- `floorMain`, `floorHall`, `bathFloor`, `balconyFloor`: the four floor zones (main room, hall + kitchen, bathroom, balcony)
- `plaster`: wall paint
- `ceiling`, `tile` (bathroom wall tile)

## 4. Open it and check it

Open `http://localhost:5173`. The page reloads each time you save the plan file, and if something in it is wrong (an opening longer than its wall, a fixture of an unknown type, a reference to a wall that doesn't exist), the page lists the problems instead of drawing the plan. Things that help while you check it against reality:

- `?view=top` shows the plan from above, and `M` toggles dimensions.
- `T` is the measure tool: click two points to take a dimension, snapping to edges.
- `X` makes the walls translucent; the dollhouse view cuts away the walls facing the camera.
- `W` (or double-click the floor) walks through it at eye level.

A workspace can hold several plans (`?plan=<id>` switches). The default plan's main layout is `layouts/decor.json`; any other plan's is `layouts/decor.plan-<id>.json`.

**Let Claude Code do the transcription.** Give it the plan image and your measurements and ask it to write `workspaces/myflat/plans/myflat.plan.json` following `examples/loft/plans/loft.plan.json` and the types in `src/model/plan.ts`. Then check it in the app with the measure tool and ask for fixes ("the bathroom door opens the other way", "the window sill is at 90 cm").

## 5. Hang your artwork

Put images in your workspace's `artwork/` folder, or upload them in the Artwork tab (they're saved there). Pick an image, click a wall to hang it, then choose print size, crop, frame and height. See [features.md](features.md#decor-panel) for everything the panel does.

If your workspace is public, only commit images you have the right to share.

## 6. Furnish it

The Furniture, Plants and Lights tabs place pieces from the built-in catalog. Every change is saved to the open layout file in your workspace's `layouts/`, so you can:

- keep several layouts (the menu at the top of the panel) and flip between two with `B`,
- try taking a partition out (Room tab → *Walls*) and compare it with the original,
- edit a layout file by hand, or ask Claude Code to ("move the sofa 20 cm toward the window"), and watch the app update live.

## 7. Add a piece that isn't in the catalog

Furniture is parametric code, not imported 3D models. Each piece is built from boxes and simple shapes, with editable dimensions and finishes. Adding one takes four changes:

1. Add its name to `FurnitureType` in `src/model/decor.ts`.
2. Describe it in its catalog group's file under `src/decor/furniture/` (`sleep.ts`, `sit.ts`, `devices.ts`…; the type is `FurnitureSpec` in `spec.ts`): label, group, how it mounts (floor, wall, ceiling), default size, which finishes it uses, and its options (toggles, choices, ranges).
3. Draw it: a component in the matching file under `src/scene/decor/furniture/` (`Seating.tsx`, `Storage.tsx`, `Devices.tsx`…), registered in `VIEWS` in `Furniture.tsx`. Look at a similar piece first; `common.tsx` has the shared helpers.
4. Run `pnpm test`: `tests/unit/catalog.test.ts` checks every catalog entry.

This is a good job for Claude Code: give it a product link or photo and dimensions, and point it at a similar existing piece.

## 8. Share it

For now, saving, uploads and layouts only work under `pnpm dev`: they go through a small API in the dev server (`server/studioApi.ts`). `pnpm build` makes a static site that renders any plan but opens with an empty room and doesn't save. To show your apartment to someone today, share screenshots (`scripts/shoot.mjs`, see [development.md](development.md#screenshots-and-dev-tools)) or run the dev server where they can reach it.

## Toward a platform

The app already separates the data one person owns from what everyone shares. A multi-user version keeps these boundaries and moves the data out of the repo into a backend:

| Today (files in a workspace) | On a platform | Owned by |
|---|---|---|
| `plans/<id>.plan.json` | **Plan**: one apartment's geometry and design rules | a user (or a building, shared by its tenants) |
| `layouts/decor*.json` | **Layout**: a furnished version of a plan; holds items, groups, finishes and removed walls, and names its plan | a user; shareable by link to view or edit |
| `artwork/` | **Assets**: uploaded images | a user |
| `FURNITURE`, plants, lamps (code) | **Catalog**: pieces anyone can place | shared |
| A new catalog entry (a pull request) | **Furniture request**: a link or photo plus dimensions; someone (or Claude) builds the piece, and it joins the catalog | requested by a user, shared once built |
| `server/studioApi.ts` routes | **API**: the same routes (`/api/decor`, `/api/layouts`, `/api/artwork`), backed by a database and object storage instead of the file system | — |

Where the code already fits that shape:

- **The app talks to an API, not to files.** The routes in [development.md](development.md#dev-api) are the contract. A hosted backend that answers the same routes (per user, with auth) works with the current front end with small changes, mostly in `src/decor/store.ts` and `src/decor/layouts.ts`, which build the request URLs.
- **Plans are data.** Everything about a specific apartment comes from the plan file or is derived from it (`src/project/derived.ts`), so plans can be loaded at runtime instead of bundled from the workspace (`virtual:workspace`, read in `src/project/plan.ts`).
- **Layouts name their plan**, and a layout without finishes renders the plan's original look, so old layouts keep working as options are added.

What's still missing:

- **A way to make plans without writing JSON**: a plan editor (draw walls on a traced image), or an import from a floor plan image with Claude doing the first pass and the user correcting it in the app.
- **Stricter validation for uploaded plans**: plans and layouts are already checked on load (`src/model/validate.ts`, `src/decor/validateLayout.ts`: shapes, ranges, openings that fit their walls, references), but not that walls meet or rooms don't overlap.
- **A read-only mode** for shared links, and view/edit permissions.
- **Catalog as data**: furniture specs (size, options, finishes) could live in a database, but the geometry is code; a request flow could produce a pull request, or pieces could be described in a small declarative format.
- **Some assumptions from the original flat** still live in the code: the four floor zones in the Room tab (`src/model/finishes.ts`), the bathroom tile and shower options, and a Buenos Aires-style balcony in the sun shadows (`src/scene/SunOccluders.tsx`). A plan without a bathroom or balcony works, but those options still show.
- **Asset rights**: user uploads need storage limits and a way to report or remove images.
