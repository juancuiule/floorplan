# Development

## Project map

| Path | What it is |
|---|---|
| `examples/<name>/` | Example workspaces: `workspace.json`, `plans/<id>.plan.json` (type in `src/model/plan.ts`), `layouts/decor*.json`, `artwork/`. The dev server opens the one in `FLOORPLAN_WORKSPACE` (default `examples/loft`). |
| `src/project/` | The launch options read from the URL (`launch.ts`), the open plan (`plan.ts`), and everything derived from it: the active shell after walls are removed (`structure.ts`), finishes applied to materials, camera sides, defaults for what the plan leaves out (`derived.ts`). |
| `src/model/` | Data types: plan geometry (`types.ts`, `plan.ts`), decor items (`decor.ts`), finishes and structure choices. |
| `src/decor/` | Decor logic without React: the store and the modules behind it (API client, undo history, saving, the layout file format), placement and wall snapping, smart guides, selection, arranging, the catalogs of plants, lamps and furniture (`catalog.ts`, `furnitureCatalog.ts`). |
| `src/scene/` | The three.js scene (React Three Fiber): walls, floors, fixtures, lights and shadows, and every decor model under `scene/decor/`. |
| `src/ui/` | Panels, toolbar, inspector, edit bar. |
| `src/sun/` | Solar position and daylight. |
| `src/plan/` | Walk mode, the measure tool, clearances and obstacles. |
| `server/` | Vite plugins: the open workspace (`workspace.ts`: its plans as `virtual:workspace`, its artwork at `/artwork/`) and the dev API for saving layouts and uploading images (`studioApi.ts`, only under `pnpm dev`). |
| `scripts/` | Screenshot and performance tools. |
| `tests/unit/`, `tests/e2e/` | Unit tests (vitest) and browser tests (Playwright). |

Coordinates are meters: `x` and `z` on the floor, `y` up. Each plan sets its own origin; see [your-own-floorplan.md](your-own-floorplan.md#2-measure-and-pick-your-axes).

## Dev API

`server/studioApi.ts` adds these routes to the Vite dev server so the browser can write back into the open workspace (`<layouts>` and `<artwork>` are its folders):

| Route | Does |
|---|---|
| `GET /api/workspace` | `{ name, defaultPlan, layouts }`, for scripts and browser tests that seed layout files. |
| `GET /api/decor` · `PUT /api/decor` | Read or replace `<layouts>/decor.json`. `?file=<slug>` uses `<layouts>/decor.<slug>.json` instead. |
| `GET /api/layouts` | List layouts (main first; `?all=1` includes `e2e*`/`test*` files). |
| `POST /api/layouts` | `{ name, data? \| from? }` saves a new layout, returns `{ slug, name }`. |
| `PATCH /api/layouts?file=<slug>` | `{ name }` renames (no `?file=` renames the main one). |
| `DELETE /api/layouts?file=<slug>` | Deletes a named layout. |
| `GET /api/artwork` · `POST /api/artwork?name=…` | List `<artwork>` · upload one image (raw body). |
| `GET /api/image?url=<link>` | Fetches a remote image for the TV screen (public http(s) only, 15 MB). |

Changes to decor files on disk are pushed to open tabs (`decor:changed`, `layouts:changed`), so editing a layout by hand updates the app live. A production build (`pnpm build`) has no API: the app opens with an empty room and doesn't save.

## Checks

```sh
pnpm check          # everything CI runs: typecheck, lint, format check, unit tests
pnpm typecheck      # tsc over the app, the dev server and the tests
pnpm lint           # oxlint, warnings fail
pnpm format         # Prettier (code and config; Markdown is left as written)
pnpm test           # unit tests (vitest + jsdom): geometry, placement, store, catalogs, plants, dev API
BASE_URL=http://localhost:5184 CHROME_PATH=/path/to/chrome pnpm test:e2e   # needs a running dev server
```

CI (`.github/workflows/ci.yml`) runs `pnpm check` and `pnpm build` on every push to `main` and every pull request. Formatting-only commits are listed in `.git-blame-ignore-revs`; run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once so local blame skips them.

## Tests

Unit tests run against the `examples/monoambiente` workspace, plus the loft plan (`vitest.config.ts`), because they are written for that apartment's walls and partitions. So are the browser tests: start their dev server with `FLOORPLAN_WORKSPACE=examples/monoambiente`.

Browser tests use `?decor=<name>` with a scratch name (`e2e-…`, `test-…`), which reads and writes a git-ignored `<layouts>/decor.<name>.json` instead of a real layout; they ask the dev server where `<layouts>` is (`GET /api/workspace`). Screenshots go to `test-results/` (git-ignored).

| Test | What it checks |
|---|---|
| `tests/e2e/smoke.mjs` (`pnpm test:e2e`) | Switches views, opens each panel tab and places an artwork, a plant, lamps and a desk through the UI, then checks the saved `e2e-smoke` layout through the dev API. |
| `tests/e2e/walk-measure.mjs` | Walks through the flat (entry, passage, balcony, walls), measures on the floor and checks the clearance overlay. |
| `tests/e2e/walls.mjs` | Takes the hall ↔ main room wall out in the Room tab, checks the saved layout, walks through where it stood and puts it back. |
| `tests/e2e/panel.mjs` | Breaks and fixes the `e2e-panel` layout file by hand (saving pauses, then resumes) and checks the edit bar clears the panel on a phone. |
| `tests/e2e/shortcuts.mjs` | Every documented keyboard shortcut does what the shortcuts popover says. |
| `tests/e2e/align.mjs [outDir] [baseUrl]` | Hangs three artworks, Shift-selects them, aligns, distributes, groups, drags the group, undoes, checks the smart guides and hangs them as a gallery, asserting the saved `test-align` layout at each step. |
| `tests/e2e/edit.mjs [outDir] [baseUrl]` | Place, drag, undo/redo, nudge, rotate, copy/paste and delete, checking what gets saved. |
| `tests/e2e/decor-panel.mjs [outDir] [baseUrl]` | Clicks through the decor panel and saves screenshots. |
| `tests/e2e/render-on-demand.mjs [outDir] [baseUrl]` | On-demand rendering still animates: x-ray fade, camera moves, dollhouse cut-away, desk height. |
| `tests/e2e/hunt.mjs [outDir] [baseUrl]` | An exploratory sweep over a scratch copy of your layout: every tab and inspector, junk in number fields, undo/redo after each kind of edit, layouts, groups, walk, measure, the sun, `?plan=loft` and phone/wide viewports. Records console errors, failed requests and idle frames in `findings.json`. |

## Screenshots and dev tools

With the dev server running (`CHROME_PATH` is optional; it points Playwright at an installed Chrome):

```sh
node scripts/shoot.mjs test-results/shots http://localhost:5173 iso-balcony:dollhouse:evening
node scripts/shoot-gallery.mjs test-results/gallery http://localhost:5173   # gallery wall, align tools, floor guides
sh scripts/sun-shots.sh test-results/sun http://localhost:5173 N W          # sun studies across the year
node scripts/perf.mjs http://localhost:5173 "view=iso-balcony"              # draw calls, triangles, fps per view
node scripts/fps.mjs "view=iso-balcony&light=evening"
node scripts/census.mjs http://localhost:5173 "view=iso-balcony"            # visible meshes per decor item or wall
```

`shoot.mjs` also takes `DECOR=<name>` (a `?decor=` layout), `QUERY='sun=09:00&date=2026-06-21'` (extra URL params) and `TAG` (a file name suffix).
