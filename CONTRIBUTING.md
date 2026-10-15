# Contributing to Repoville

Thanks for helping build the city.

## Setup

```sh
git clone https://github.com/maximilianfeix/repoville
cd repoville
npm ci
npm run build      # dist/cli.js + dist/viewer.js
npm test           # unit, property and golden tests
```

Node 22+ and git are required. `npx tsx test/e2e/viewer-check.ts <city.html> <out.png>` screenshots a rendered city in headless Chromium (`npx playwright install chromium` once). The Paper e2e scripts in `test/e2e/` download Paper and need Java 21.

## How the code is organised

| Folder | What lives there |
|---|---|
| `src/scan`, `src/history` | file walk, LOC/TODO counting, one streamed `git log` |
| `src/model`, `src/layout` | CityTree, LOD, squarified treemap, downtown mirroring |
| `src/build` | voxel grid, building families, palettes, fire/moss/ruins, trees |
| `src/write` | NBT, `.schem`, `.litematic`, world zip, structure tiles, HTML, PNG |
| `src/live` | RCON client and live placement |
| `viewer/` | three.js viewer bundled into each `city.html` |

`docs/DECISIONS.md` explains non-obvious choices. Please add to it when you make one.

## Rules of thumb

- **Deterministic output.** Same repo, commit and options must give the same city. Use the seeded RNG in `src/build/rng.ts`, never `Math.random` or the wall clock.
- **Honest metrics.** Visual metaphors may change; the numbers behind them may not. Tests guard the height formula and the decorator thresholds.
- **No game assets in the repo.** Textures are procedural; original Minecraft textures are only fetched at runtime when a viewer opts in.
- **Small PRs with a screenshot.** For visual changes, attach a before/after render.

Commits follow Conventional Commits (`feat(viewer): …`, `fix(layout): …`).
