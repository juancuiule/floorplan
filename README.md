# Monoambiente

A real-time 3D model of a studio apartment, for planning the interior: hang artwork, place furniture, plants and lamps, try paint and floors, take a wall out, walk through it and watch the real sun move across the room.

![The web app: dollhouse view with the time and sun panel, the furniture and artwork libraries, and the room panel](docs/web-view.webp)

<table>
  <tr>
    <td width="50%"><img src="docs/iso-balcony.jpg" alt="The studio in dollhouse view, from the balcony"></td>
    <td width="50%"><img src="docs/iso-balcony-flipped.jpg" alt="The same layout from the opposite side"></td>
  </tr>
</table>

```sh
pnpm install
pnpm dev                                                # the loft example, http://localhost:5173
FLOORPLAN_WORKSPACE=examples/monoambiente pnpm dev      # the apartment in the screenshots
```

## Docs

- **[Model your own apartment](docs/your-own-floorplan.md)**: clone the repo, describe your place as a plan file, add your artwork and furnish it. Also covers how this could become a multi-user platform.
- **[Features](docs/features.md)**: views, the decor panel, layouts and finishes, keyboard shortcuts.
- **[Development](docs/development.md)**: project map, the dev API, tests, screenshot and performance tools.
- **[Architecture](docs/architecture.md)**: layers, state, the life of an edit, rendering. The decisions behind it are in [docs/adr](docs/adr/), and the vocabulary in [GLOSSARY.md](GLOSSARY.md).
- **[Contributing](CONTRIBUTING.md)**: conventions for code, commits and docs.

## Workspaces, plans and layouts

The app opens one **workspace**: a folder with an apartment's data, chosen by `FLOORPLAN_WORKSPACE` (set it in `.env.local` to keep it). The repo has two:

- `examples/loft`: a small, made-up flat in Madrid. It opens by default.
- `examples/monoambiente`: the studio apartment in Buenos Aires the project was built for, with its own layouts and artwork.

```
examples/loft/
  workspace.json        name, and the plan that opens by default
  plans/loft.plan.json  the apartment: walls, openings, rooms, fittings, materials, location, design rules
  layouts/decor.json    furnished versions of it: decor items, groups, finishes, walls taken out
  artwork/              the image library (uploads land here)
```

- A **plan** (type in `src/model/plan.ts`) describes the apartment; anything it leaves out is derived from its geometry (`src/project/derived.ts`). `?plan=<id>` opens another plan in the workspace.
- A **layout** is a furnished version of a plan: `layouts/decor.json` is the default plan's main one, `layouts/decor.<slug>.json` the others. The panel saves every change, and editing a file by hand (or asking Claude to) updates open tabs live.
- Both are checked when they load: a mistake shows up as a list of problems, not a broken scene.

To model your own apartment, see [docs/your-own-floorplan.md](docs/your-own-floorplan.md).
