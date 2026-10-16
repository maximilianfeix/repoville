# dev.to article outline

> **AI-assistance disclosure (required by dev.to):** dev.to's guidelines require that posts written with AI assistance say so. This outline was drafted with AI help. If any of the final article comes from it, keep a line like this at the top of the published post: *"This post was written with help from an AI assistant; the project, numbers and screenshots are my own."* Adjust the wording to match how much you actually used it.

This is an outline, not a finished article. Write the prose yourself. Every number below comes from README.md, CHANGELOG.md or docs/; nothing else is claimed.

## Working title options

- "I turned Git repos into cities you can walk through"
- "Painting 16×16 pixel textures in code: Repoville v0.6.0"
- "React as a city: what fire, ruins and moss say about a codebase"

Tags: `#typescript`, `#threejs`, `#visualization`, `#opensource`

Cover image: `docs/media/react-hero-v2.png` or `docs/media/hero-react.jpg`. Embed `docs/media/flyover.gif` near the top.

## 1. Hook (2–3 sentences)

- Open on the flyover: the React repo as a city, flying into ReactFiberWorkLoop.js, a tower with soul fire (5,268 lines, 46 TODOs).
- One line on what Repoville is: a CLI that turns a Git repo into a city in one HTML file.

## 2. The mapping

- Folders → districts (squarified treemap, downtown mirroring, canals, plazas with name signs).
- Files → buildings in nine families (house, townhouse, mid-rise, tower, library, lighthouse, test lab, workshop, landmark).
- Height formula: `min(250, 4 + round(4·√(lines/10)))` from non-blank lines. Why a square root (big files don't swallow the skyline).
- Churn → fire (top 10 %) and soul fire (top 2 %). TODO density → ruins. Untouched for a year → moss.
- Language themes: TS/JS plains, Rust nether, Python jungle, Go frozen peaks, etc.
- The rule from VOICE.md: fire is activity, moss is stability, ruins are honest notes. Never mock a codebase.
- Screenshot: legend in action, `docs/media/react-ui.jpg` and `docs/media/react-churn.jpg`.

## 3. v0.6.0: pixel textures v2

- Every block state gets a procedurally painted 16×16 tile: hue-shifted colour ramps, grass sides, log rings, per-family facades.
- No Mojang assets bundled. Optional Minecraft textures can be switched on (`?mc=1`); the browser fetches them at runtime (© Mojang, not bundled).
- `?textures=classic` restores the old look; GPUs with too few texture layers fall back automatically.
- Before/after: `docs/media/textures-closeup.png`, `docs/media/minecraft-textures-closeup.png`, `docs/media/before-react-closeup.png` vs `docs/media/after-react-closeup.png`.
- Your notes: how the ramps are built in code (pull from `viewer/` source and PR #54).

## 4. Roofscapes (only if released by then)

- Flat decks on mid-rises and towers get gravel, green or pale decks, a stair housing, HVAC units scaled to roof area, timber water tanks on wide roofs. Landmark crowns get roof-material caps.
- Status: shipped in v0.7.0 (with crosswalks, plaza benches, animated water); visible in the live demos.
- Image: `docs/media/roofscape.jpg`.

## 5. Scaling to Linux

- 95,948 files, LOD folds the deepest folders into landmark towers above 4,000 buildings, footprint capped at 1024×1024.
- Measured on an Apple Silicon Mac: ~25 s warm render, 2.0 MB HTML, 57 fps without shadows (headless Chromium, 1280×720).
- Blobless clone, only as far back as the churn window needs (731 MB, about 4.5 minutes cold).
- Image: `docs/media/linux-merged-search.png`.

## 6. Viewer features in one paragraph each (pick 2–3)

- Night mode, History time-lapse (`--timelapse`), Diff view for branches (`--diff <ref>`), GitHub Action that publishes your repo's city to Pages.

## 7. Minecraft export (short)

- `.schem` v3 pasted with WorldEdit 7.3.19 on Paper 1.21.11; `.litematic` v6 round-trip checked with litemapy; world zip and live RCON building tested on Paper 1.21.11.
- docs/PROGRESS.md lists re-running these e2e tests after the latest geometry changes as open. Re-run first or say when they were last run.
- Include the disclaimer here: "Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft."

## 8. Try it

- Demos: https://maximilianfeix.github.io/repoville/ (React, Linux, ripgrep, Flask, fzf, Repoville itself).
- Command (README Quick start; needs Node.js 22+ and git):

  ```sh
  npx --package=https://github.com/maximilianfeix/repoville/releases/latest/download/repoville.tgz repoville facebook/react --open
  ```

- Honest limits: not on npm yet, Windows untested, Action not yet run on hosted runners.

## 9. Close

- What's next from the README roadmap: npm release, and coding agents walking the city as villagers.
- Ask readers which repo to render next. Link the repo: https://github.com/maximilianfeix/repoville (MIT).
