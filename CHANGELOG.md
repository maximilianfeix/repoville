# Changelog

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
