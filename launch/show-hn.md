# Show HN outline

> **HN requires the author to write and post this himself.** HN asks that Show HN posts and comments come from the maker in their own words, not generated text. Everything below is only an outline of facts and talking points for Maxi to write from. Do not paste it as-is.

Timing idea: Tue–Thu, around 13:30 UTC. Be around for a few hours to answer questions.

## Title (suggested)

```
Show HN: Repoville – turn any Git repo into a walkable Minecraft-style city
```

(80 characters max on HN; this one is 75. "Repoville" stays the product name; "Minecraft-style" only describes the look.)

**URL:** https://maximilianfeix.github.io/repoville/ (demos first; the repo is linked from there)

## First comment: outline (write it in your own words)

1. **Why you built it.** One or two sentences in your voice: wanting to see a codebase like a city from a plane, where the big districts are, where work is happening now, which corners nobody has touched.

2. **What it does** (facts from README):
   - Reads the repo locally: file sizes plus `git log`.
   - Folders become districts (squarified treemap, roads, plazas, name signs). Files become buildings.
   - Height: `min(250, 4 + round(4·√(lines/10)))` from non-blank lines.
   - Churn: top 10 % of files by commits in the last year burn on the roof, top 2 % get soul fire.
   - TODO/FIXME/HACK/XXX density turns that share of the walls into ruins. No commit for over a year: moss and vines.
   - Say it plainly: fire is activity, not bad code; moss is stable, not rotten.

3. **What's new in v0.6.0:** procedural pixel textures v2. Every block state gets its own 16×16 tile with hue-shifted colour ramps, grass sides, log rings and per-family facades. No Mojang assets bundled; `?textures=classic` restores the old look.
   - v0.7.0 adds roofscapes (gravel/green decks, HVAC units, water tanks), crosswalks and plaza benches, animated water; the demos show them.

4. **Output:**
   - One self-contained HTML file with a three.js viewer: search, building cards, metric views (churn / age / TODO), night mode, History time-lapse, Diff view for branches.
   - Numbers you can quote (README, Apple Silicon Mac, headless Chromium at 1280×720): React, 7,165 files, ~2 s warm, 1.9 MB, 60 fps without shadows. Linux, 95,948 files, ~25 s warm, 2.0 MB, 57 fps without shadows.
   - Minecraft exports: `.schem` (pasted with WorldEdit 7.3.19 on Paper 1.21.11), `.litematic` (round-trip checked with litemapy), a world zip and live building over RCON (both tested on Paper 1.21.11).
   - If you describe the Minecraft export, add: "Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft."

5. **Privacy:** everything runs locally, no telemetry, the HTML holds paths and counts, never file contents.

6. **Honest limits:**
   - npm package not published yet; `npx` runs the GitHub release tarball.
   - Windows untested.
   - Big repos: above 4,000 buildings the deepest folders merge into landmark towers; footprint capped at 1024×1024. Linux cold clone takes about 4.5 minutes.
   - GitHub Action tested locally, not yet on hosted runners.
   - docs/PROGRESS.md lists re-running the Paper e2e tests after the latest geometry changes as open. Re-run them, or say the export tests predate the newest geometry.

7. **Close with a question.** For example, which repo you should render next, or what metric people would want on the buildings.

## Command to quote (README Quick start, verified wording)

```sh
npx --package=https://github.com/maximilianfeix/repoville/releases/latest/download/repoville.tgz repoville facebook/react --open
```
