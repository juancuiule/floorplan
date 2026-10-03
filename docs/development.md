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
pnpm test:e2e       # browser tests (Playwright Test; starts its own dev server)
```

CI (`.github/workflows/ci.yml`) runs `pnpm check` and `pnpm build` on every push to `main` and every pull request. Formatting-only commits are listed in `.git-blame-ignore-revs`; run `git config blame.ignoreRevsFile .git-blame-ignore-revs` once so local blame skips them.

## Tests

| Level | Run | Where |
|---|---|---|
| Unit | `pnpm test` (also in `pnpm check` and CI) | `tests/unit/`: vitest + jsdom. They run against the `examples/monoambiente` workspace plus the loft plan (`vitest.config.ts`), because they are written for that apartment's walls and partitions. |
| Browser | `pnpm test:e2e` | `tests/e2e/*.spec.mjs`: Playwright Test (`playwright.config.ts`). It starts its own dev server on the monoambiente workspace (port 5199), or uses `BASE_URL` if you set it. `CHROME_PATH` runs an installed Chrome instead of Playwright's Chromium (`npx playwright install chromium`). |

The browser tests run one at a time (the scene is GPU-heavy and they time animations), take about four minutes and are not in CI yet: they need WebGL, which Linux runners only have in software. Each one uses `?decor=<name>` with a scratch name (`e2e-…`, `test-…`), which reads and writes a git-ignored `<layouts>/decor.<name>.json` instead of a real layout; they ask the dev server where `<layouts>` is (`GET /api/workspace`). Screenshots go to `test-results/` (git-ignored), and a failing test leaves its trace and screenshot in `test-results/e2e-output/`.

| Test | What it checks |
|---|---|
| `smoke` | Switches views, opens each panel tab and places an artwork, a plant, lamps and a desk through the UI, then checks the saved layout through the dev API; layouts menu, A/B, finishes. |
| `walk-measure` | Walks through the flat (entry, passage, balcony, walls), measures on the floor and checks the clearance overlay. |
| `walls` | Takes the hall ↔ main room wall out in the Room tab, checks the saved layout, walks through where it stood and puts it back. |
| `panel` | Breaks and fixes a layout file by hand (saving pauses, then resumes) and checks the edit bar clears the panel on a phone. |
| `shortcuts` | Every documented keyboard shortcut does what the shortcuts popover says. |
| `align` | Hangs three artworks, Shift-selects them, aligns, distributes, groups, drags the group, undoes, checks the smart guides and hangs them as a gallery, asserting the saved layout at each step. |
| `edit` | Place, drag, undo/redo, nudge, rotate, copy/paste and delete, checking what gets saved. |
| `render-on-demand` | Nothing renders while idle, and the x-ray fade, camera moves, a desk changing height and an orbit drag all get their frames. |

## Screenshots and dev tools

With the dev server running (`CHROME_PATH` is optional; it points Playwright at an installed Chrome):

```sh
node scripts/shoot.mjs test-results/shots http://localhost:5173 iso-balcony:dollhouse:evening
node scripts/shoot-gallery.mjs test-results/gallery http://localhost:5173   # gallery wall, align tools, floor guides
sh scripts/sun-shots.sh test-results/sun http://localhost:5173 N W          # sun studies across the year
node scripts/perf.mjs http://localhost:5173 "view=iso-balcony"              # draw calls, triangles, fps per view
node scripts/fps.mjs "view=iso-balcony&light=evening"
node scripts/census.mjs http://localhost:5173 "view=iso-balcony"            # visible meshes per decor item or wall
node scripts/decor-panel.mjs test-results/decor-panel http://localhost:5173  # clicks through the decor panel, with screenshots
node scripts/hunt.mjs test-results/hunt http://localhost:5173                # exploratory sweep, findings in findings.json
```

`shoot.mjs` also takes `DECOR=<name>` (a `?decor=` layout), `QUERY='sun=09:00&date=2026-06-21'` (extra URL params) and `TAG` (a file name suffix).
