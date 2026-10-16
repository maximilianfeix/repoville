# Changelog

## 0.14.3 — 2026-10-16

- **Windows read as openings again:** window glass is a clear step darker than the pale walls in the graded palette.

## 0.14.2 — 2026-10-16

- **Phones:** the home view looks down more steeply on portrait screens, so the city fills the height, and small screens show at most five district labels.
- **Docs:** the building-family images use the current look.

## 0.14.1 — 2026-10-16

- **Quieter roofs:** a burning roof has one fire near its centre with one plume of flames, instead of specks over the whole deck; flat roofs carry one to four rooftop units instead of up to twelve.

## 0.14.0 — 2026-10-16

- **New look.** The viewer HUD is now paper by day and ink at night: opaque panels, hairline rules, a text wordmark, mono values, a compact phone toolbar with a bottom-sheet guide, and an Auto/Paper/Ink choice under View. The city sits on the same paper backdrop.
- **Calmer city.** Block colours are graded in the viewer (hue kept, chroma and value compressed, darker roofs, quieter textures and light), so a frame reads like an architectural model; fire and selection stay bright. Exports are unchanged.
- **Website and README** rebuilt in the same system, with an inspection strip of real React files, real CLI output and banners rendered from real captures.

## 0.13.0 — 2026-10-16

- **Framing:** the home view backs off until the tops of the tallest buildings are in frame, so small repos with one tall file are no longer cut off (large cities unchanged).
- **Docs:** [docs/BUILDINGS.md](docs/BUILDINGS.md) shows all nine building families with real renders.
- **Viewer:** Home/End and Escape in the search results.

## 0.12.0 — 2026-10-16

- **New themes:** Swift and Lua build a copper town (waxed copper, so worlds never oxidise it), C# and PHP a prismarine reef on sand. These languages used to fall back to plain stone.
- **Exports:** roof decks use tuff instead of gravel, which fell into hollow floors once the game updated it.

## 0.11.0 — 2026-10-16

- **Lighting:** the sun now lights the facades the home view sees (it used to sit behind them, so every visible wall was in shade). Towers read as lit and shaded faces; dark themes are legible.
- **C/C++ theme:** tuff walls instead of deepslate, plus a light calcite neighbourhood.
- Landing hero video, demos, README screenshots and flyover re-rendered.

## 0.10.0 — 2026-10-16

- **Suburb greens:** the space around small houses is lawn with trees instead of the district's road surface (deep folders showed as wide dirt-path areas).
- **Framing:** the home view includes building height, so a tall tower on a small map is no longer cut off at the top.

## 0.9.0 — 2026-10-16

- **Terraces:** a folder made mostly of small files (townhouse class) is laid out as rows along lanes, back gardens meeting, files in path order, instead of scattered lots.
- **Test labs:** each lab picks one of three whites, an accent stripe and roof furniture, so test-heavy districts are no longer one white field.
- Export palettes no longer contain unused block states.

## 0.8.0 — 2026-10-16

- **Facades with depth:** wide towers get trim piers on every third column, vertical glass strips between them and a two-block cornice; midrises get recessed ribbon windows, one glass row per floor. The skyline reads as framed buildings instead of boxes with dot grids.
- **Exports:** iron bars and fences get the connection states the game derives. The Paper end-to-end tests now check one cell of every distinct block state (159 in the test town) and pass for WorldEdit paste, world zip and live builds.

## 0.7.1 — 2026-10-16

- **Exports match the game exactly:** stair corners get the inner/outer shapes the game derives, leaves get the right `distance`, and grass under solid blocks is written as dirt. Before this, a WorldEdit paste or live build changed a few blocks on the first block update (found by re-running the Paper 1.21.11 e2e: now WorldEdit 66/66, world 64/64, live 64/64).

## 0.7.0 — 2026-10-16

- **Roofscapes:** flat roofs get gravel, green or pale decks, stair housings, HVAC units scaled to the roof and timber water tanks; landmark crowns get roof-material caps.
- **Streets:** zebra crossings at junctions, worn sidewalk slabs, plaza benches and lawn beds.
- **Viewer:** animated pixel-art water ripples (still under reduced motion), warmer night windows, a soft day backdrop (also in Photo exports), district labels no longer overlap, and the whole city fits on portrait phone screens.

## 0.6.0 — 2026-10-16

- **Pixel textures v2** in the viewer: every block state gets a procedurally painted 16×16 tile (hue-shifted colour ramps, grass sides, log rings, per-family facades). Still no Mojang assets bundled. `?textures=classic` restores the old look; GPUs with too few texture layers fall back automatically.
- README screenshots, flyover GIF and the demo site re-rendered with the new textures.

## 0.5.0 — 2026-10-16

- **Diff view** (`--diff <ref>`): what a branch changed, as a city. New buildings glow Diamond, changed ones Lava; deleted files are listed. The GitHub Action gains `diff` and `timelapse` inputs for pull-request previews.

## 0.4.0 — 2026-10-16

- **History time-lapse** (`--timelapse`): a History view where the city grows commit by commit, with play, scrubber and date.
- Landing page: dedicated portrait hero on phones; avatar PNG in `assets/brand/`; Fly is hidden on touch-only devices.

## 0.3.0 — 2026-10-16

- **GitHub Action** `maximilianfeix/repoville@v0`: render your repo's city on every push and publish it to Pages.
- **Viewer:** "Open source ↗" on building cards (GitHub/GitLab at the rendered commit), search finds files inside merged landmark towers, shareable view state in the URL, numeric metric legend, Photo button (branded PNG), keyboard district list and card focus handling.
- **Hardening** (from an independent review): symlinks are never followed, exact-host URL parsing and collision-free clone cache, per-ref checkouts, RCON deadlines and packet limits, content-hashed live templates with guaranteed force-load cleanup, stricter palette validation, accurate docs.

## 0.2.0 — 2026-10-16

- **Night mode** in the viewer (View → Night or `?time=night`): moonlight and windows lit one by one.
- **Massing:** small files become compact houses with roofs instead of thin posts (footprint widens up to height / 1.8; height is still the LOC metric).
- Badge links for repos that are not in the gallery yet open a page with the one-line `npx` command and a prefilled render request.
- Quick start uses `npx` straight from the GitHub release.

## 0.1.0 — 2026-10-16

First public release.

- **City generator:** folders → districts (squarified treemap, downtown mirroring, canals between top-level districts, street hierarchy, plazas with name signs), files → buildings in nine families (house, townhouse, mid-rise, tower, library, lighthouse, test lab, workshop, landmark) with height `4 + 4·√(LOC/10)`. Churn → fire / soul fire, TODO density → ruins, untouched > 1 year → moss and vines, largest file per folder → gold crown. Language themes, neighbourhood facade variants, trees, pocket parks and ponds. Deterministic.
- **Viewer (`city.html`):** single self-contained file; greedy-meshed voxels with procedural pixel textures, optional runtime Minecraft textures, lights, static soft shadows, baked AO for small/mid cities, district labels, search, building card, metric view (churn / age / TODO), tour, fly mode, keyboard shortcuts.
- **Minecraft:** Sponge `.schem` v3 (WorldEdit-tested), `.litematic` v6 (litemapy round-trip), ready-to-open world zip and live building over RCON (both tested on Paper 1.21.11).
- **CLI:** `repoville [build]`, `live`, `tour`, `badge`; `--gallery` isometric PNG; `repoville.config.json` (ignored for remote repos).
- **Big repos:** LOD folds folders into landmark towers above 4,000 buildings; Linux renders in ~25 s warm.
