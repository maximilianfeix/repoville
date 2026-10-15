# Codex inventory (2026-10-16)

Raw output of a read-only `codex exec` review, followed by the maintainer triage. Line references are as of commit 44f27e7.

## Triage

- **Fix now (PR "hardening"):** 2.1 symlinks, 2.2 URL parsing + cache identity, 2.3 ref checkout sticking in the cache, 2.4 RCON deadlines/bounds, 2.5 content-hashed template names, 2.6 force-load cleanup in finally, 2.7 LOD budget for flat repos, 2.8 roof override validation, 2.10 chunk map retention; docs: determinism wording, "self-contained" vs Google Fonts, `--textured`, config keys, warm-cache qualifier, skill command.
- **Issues:** GitHub Action that publishes a city, open building in source, search inside merged towers, metric legend numbers, shareable view state, accessibility (district list, dialog focus, slider focus), mobile controls, history time-lapse, PR city diff, coverage overlay.
- **Not taken:** none rejected outright; "walk" wording stays (it is the brand verb) but the site says orbit/inspect/fly explicitly.

---

Read-only review completed. No files were written. Type-checking passed on the final run; in-memory checks reproduced the LOD-budget, URL-parsing, and roof-override defects below. I did not run the full suite or Paper/browser E2E because those write artifacts. `viewer/main.ts` changed externally during review, so references reflect the last inspected version.

## 1) Architecture summary

- **CLI and configuration:** `src/cli.ts` exposes build, tour, live, badge, and hidden analyze commands. `src/config.ts` merges local configuration with CLI options; remote repository configuration is ignored.
- **Source acquisition:** `src/source/resolve.ts` recognizes local paths, GitHub shorthand, and Git URLs; remote repositories use mutable cached clones with optional refresh/ref checkout.
- **Scanning:** `src/scan/` lists tracked and untracked files, applies exclusions, classifies languages/tests/docs, and counts nonblank lines and literal TODO markers. Binary, lock, oversized, and common generated files are skipped.
- **History:** `src/history/gitlog.ts` streams one Git log into per-file activity/age and distinct per-directory commit counts, with metric windows relative to HEAD.
- **Analysis model:** `src/analyze.ts` joins scanning and history into the versioned `CityTree` in `src/model/city.ts`. `src/summary.ts` derives tour highlights.
- **LOD and layout:** `src/model/lod.ts` collapses folders; `src/layout/` creates a squarified treemap, mirrors districts toward downtown, reserves roads/plazas, and retries constrained lots within 1024×1024.
- **Voxel generation:** `src/build/` turns lots into building families, roofs, palettes, canals, parks, signs, fire, moss, and ruins. Seeded randomness feeds a sparse section-based `VoxelGrid`.
- **Export orchestration:** `src/render.ts` runs analysis → LOD → layout → voxelization → requested writers. Even JSON-only output currently performs layout and voxelization.
- **Writers:** `src/write/` implements NBT, Sponge schematics, Litematica bit packing, Anvil world ZIPs, structure tiles, compressed HTML payloads, and software PNG thumbnails.
- **Browser viewer:** `viewer/format.ts` shares the payload contract; `mesher.ts` builds greedy geometry with AO; texture modules provide procedural/runtime textures. `main.ts` owns rendering, camera controls, HUD, search, metrics, tours, and screenshots.
- **Live mode:** `src/live/` writes structure files into a locally accessible server world directory, then uses its own RCON client to force-load chunks and place templates.
- **Delivery and validation:** tsup bundles CLI/viewer separately. Unit/property/golden tests and standalone E2E scripts exist. `scripts/` builds demos, imagery, branding, and Pages deployment; `site/`, `assets/`, `launch/`, and `skill/` supply distribution materials. CI exists only as a draft under `docs/ci/`.

## 2) Code quality: 10 most important concrete problems

1. **High — Repository symlinks can escape the scan root.**  
   [src/scan/walk.ts:104](/Users/maximilian/code/repoville/src/scan/walk.ts:104) uses `stat`, followed by `readFile`, both following symlinks. A tracked link can therefore make a remote repository’s analysis read an unrelated local file. This leaks derived counts into output and makes results machine-dependent; it does **not** embed the file’s contents.  
   **Fix:** skip symlinks with `lstat`, or explicitly resolve and constrain targets to the repository root. Handle disappearance/read errors and enforce the size limit on the opened file.

2. **High — Remote identity is neither parsed nor cached safely.**  
   [src/source/resolve.ts:37](/Users/maximilian/code/repoville/src/source/resolve.ts:37) accepts a GitHub substring rather than an exact hostname; the reproduced input `https://notgithub.com/a/b.git` becomes `https://github.com/a/b.git`. At [line 69](/Users/maximilian/code/repoville/src/source/resolve.ts:69), non-GitHub repositories are cached by basename: GitLab `a/same` and `b/same` share a checkout. Existing origins are never checked.  
   **Fix:** parse supported URL/SCP forms explicitly, match exact hosts, hash the canonical full remote identity, and verify the cached origin before reuse.

3. **High — Cached checkout state silently changes later requests.**  
   [src/source/resolve.ts:88](/Users/maximilian/code/repoville/src/source/resolve.ts:88) only updates an existing clone with `--refresh`; [line 96](/Users/maximilian/code/repoville/src/source/resolve.ts:96) detaches it for `--ref`. A later ordinary build reuses that historical checkout. Concurrent commands can also reset/checkout the same directory while another scans it. Existing shallow clones are not deepened when the requested history window increases.  
   **Fix:** separate a locked fetch cache from immutable per-commit analysis checkouts; explicitly resolve the default ref and ensure its required history is available.

4. **High — RCON can hang indefinitely or crash on malformed framing.**  
   [src/live/rcon.ts:57](/Users/maximilian/code/repoville/src/live/rcon.ts:57) has no authentication/command deadline. The TCP connection timeout ends before authentication. At [line 78](/Users/maximilian/code/repoville/src/live/rcon.ts:78), packet length is trusted without minimum/maximum checks before reading fields.  
   **Fix:** bound packet and accumulated response sizes, validate packet structure/type, add per-request deadlines, and destroy the socket while rejecting all pending requests on protocol errors.

5. **High — Live builds reuse identifiers despite the template-cache requirement.**  
   [src/cli.ts:135](/Users/maximilian/code/repoville/src/cli.ts:135) derives `runId` solely from eight HEAD characters, or the constant `local`. Two builds at the same HEAD with different dirty files, windows, or budgets overwrite the same template names. `LiveOptions` explicitly says identifiers must prevent stale server template-cache reuse.  
   **Fix:** use a unique run namespace or a hash of actual tile content, then remove obsolete generated templates after placement.

6. **High — Force-load cleanup is incomplete and can alter pre-existing server state.**  
   [src/live/paste.ts:50](/Users/maximilian/code/repoville/src/live/paste.ts:50) ignores force-load command results. Removal at [line 61](/Users/maximilian/code/repoville/src/live/paste.ts:61) happens only on normal completion; `finally` merely closes RCON. Exceptions leave added chunks loaded. Successful completion removes the entire requested area, including chunks the operator may already have force-loaded.  
   **Fix:** track existing versus newly acquired chunk loads, check responses, and release only newly acquired loads in a `finally` path. Place and release bounded batches.

7. **Medium — `--max-buildings` is not an enforced upper bound.**  
   [src/model/lod.ts:60](/Users/maximilian/code/repoville/src/model/lod.ts:60) exits when no child directories remain, even if the budget is exceeded. An in-memory case with five root-level files and budget one returned five buildings. Root-level files plus collapsed folders produce the same failure.  
   **Fix:** add deterministic grouping of root siblings, or reject an unattainable budget explicitly. Test flat repositories and budgets smaller than the root’s child count.

8. **Medium — Palette validation rejects valid roof overrides and accepts invalid generated states.**  
   [src/config.ts:77](/Users/maximilian/code/repoville/src/config.ts:77) validates every palette slot as a complete `minecraft:` block state. But `Palette.roof` is a material stem. `spruce` is rejected; accepted `minecraft:spruce` becomes `minecraft:minecraft:spruce_stairs[...]` through [src/build/palette.ts:118](/Users/maximilian/code/repoville/src/build/palette.ts:118). Both behaviors were reproduced.  
   **Fix:** validate slot-specific types, whitelist biome/slot names, and represent roof stairs/slabs as explicit validated states or a supported material enum.

9. **Medium — Picking and focus bounds disagree with displayed geometry.**  
   [viewer/main.ts:547](/Users/maximilian/code/repoville/viewer/main.ts:547) builds permanent hitboxes from wall height. Metric columns use different heights at [line 503](/Users/maximilian/code/repoville/viewer/main.ts:503), so clicks can hit empty space or miss visible columns. Roof/crown height is also omitted from the payload at [src/write/html.ts:112](/Users/maximilian/code/repoville/src/write/html.ts:112), affecting selection, framing, and flame placement.  
   **Fix:** serialize visual bounds separately from metric height; use the active view’s bounds for picking/outlines and roof-surface positions for particles.

10. **Medium — Region merging retains the original CPU geometry arrays.**  
    [viewer/main.ts:255](/Users/maximilian/code/repoville/viewer/main.ts:255) stores every original mesh in `chunkOf`. [The merge loop](/Users/maximilian/code/repoville/viewer/main.ts:284) removes and disposes geometry but never clears those strong references. Disposing GPU resources does not remove the typed arrays still reachable through the old meshes. Merged buffers therefore coexist with retained originals.  
    **Fix:** clear/delete `chunkOf` entries after merging, or store coordinates on short-lived records. Measure retained heap after loading a large demo.

## 3) Refactoring candidates

| Candidate | Expected benefit |
|---|---|
| Extract a shared `prepareCity(source, options)` pipeline from build/live | Removes duplicated analysis/layout/build logic; makes validation, palette, filtering, and seed behavior consistent. |
| Introduce explicit source identity, resolved commit, and history-completeness records | Prevents cache/ref ambiguity and makes reproducibility diagnosable. |
| Replace config casts with slot-aware runtime parsing | Catches invalid seeds, booleans, scalar types, palette names, and roof materials before expensive work. |
| Split `viewer/main.ts` into renderer, camera, interaction, HUD, and state modules | Makes metric bounds, texture loading, tour cancellation, and accessibility independently testable. |
| Decode positional `BuildingRow` tuples into named browser objects once | Eliminates widespread `b[5]`/`b[9]` coupling while retaining compact transport. |
| Extract shared block-state NBT and sign conversion helpers | Reduces duplicated conversion logic across world, structure, and Litematica exporters. |
| Make exporters declare required stages | JSON analysis can skip voxelization; thumbnails and structures can avoid unnecessary work and retained intermediates. |
| Centralize brand assets/tokens and generate embedded variants | Prevents drift among the large inline viewer SVG, favicon, website styles, and checked-in brand assets. |

## 4) Missing or weak features versus backlog and README

| Claim or backlog item | Verified implementation / gap |
|---|---|
| **“Same commit and options give the same city.”** | Too broad. The scanner includes untracked files and working-tree modifications. Remote history completeness also depends on cache history and a wall-clock shallow-clone cutoff. Seeded voxel generation is deterministic given identical inputs; commit identity alone is insufficient. |
| **“One self-contained HTML file,” offline/private.** | Geometry, data, and JavaScript are embedded. However, [HTML generation](/Users/maximilian/code/repoville/src/write/html.ts:140) always requests Google Fonts. Offline fallback works, but “self-contained” does not mean zero network requests. Optional Minecraft textures require network access as documented. |
| **`--textured` support.** | The CLI sets it and the writer serializes it, but [viewer initialization](/Users/maximilian/code/repoville/viewer/main.ts:790) only checks `?mc=1`. The payload’s `textured` flag is unused. |
| **Packed vertex attributes marked complete.** | Incorrect in [PROGRESS.md:24](/Users/maximilian/code/repoville/docs/PROGRESS.md:24): positions, normals, colors, and texture attributes remain `Float32Array`. Worker meshing and shader-generated facade windows are also absent. AO, static shadows, and region merging do exist. |
| **Composition, canals, and class massing.** | More complete than some unchecked entries imply: downtown mirroring, pocket parks, ponds, canals/quays, and height-aware widening exist. Class massing is both checked and unchecked in the backlog. Consolidate these into specific remaining acceptance criteria. |
| **Suburb rows.** | Basic grid packing exists, including progressively denser fallbacks down to one-block footprints. The remaining feature should specify the desired street-facing row architecture; “suburb rows” alone obscures what is already implemented. |
| **CI and cross-platform assurance.** | No active `.github/workflows` configuration is tracked. The matrix and E2E jobs are only in `docs/ci/ci.yml`; DECISIONS’ statement that Windows correctness is “covered by the CI matrix” overstates current assurance. |
| **Exporter verification.** | Independent-reader and Paper checks exist, but `npm test` excludes standalone E2E scripts. The litemapy round-trip silently skips without its Python environment. The backlog itself says post-geometry-change Paper verification remains outstanding. |
| **“Show it off” README badge.** | [badge.ts](/Users/maximilian/code/repoville/src/badge.ts:3) links arbitrary repositories to `/r/owner/repo`; the site builder publishes only six fixed demos. For most users, the badge leads to the “city not built yet” page, not their locally generated city. |
| **File search on large repositories.** | Search indexes rendered buildings and surviving districts only. Once LOD merges a folder, its constituent filenames disappear from the viewer payload and cannot be found individually. |
| **Legend accuracy.** | Height uses **nonblank LOC**, with separate house and merged-folder formulas. Fire percentiles consider positive-churn rendered nodes, use inclusive ties, and require minimum counts of 3/10. TODOs count marker occurrences anywhere, not TODO-bearing lines or comments, and ruin share caps at 60%. Plazas and crowns are conditional. README/site legends omit these qualifications. |
| **“Config can set the same keys.”** | [README.md:122](/Users/maximilian/code/repoville/README.md:122) is inaccurate: output/open/gallery/ref/refresh are not supported config keys. Live mode bypasses local config entirely. |
| **“Walk” and live-server support.** | Browser movement is free flight without collision or gravity; mobile has no walking controls. Live mode is a one-shot paste requiring local/shared filesystem access to `--world-dir`, not a remote-only RCON workflow or continuous synchronization. |
| **Release/brand completion.** | Local docs still list npm publishing, cold-package validation, avatar PNG, visual-audit document, and portrait presets as outstanding. `skill/SKILL.md` nevertheless leads with `npx repoville`, inconsistent with README’s release-tarball workaround. External publication status was not checked. |

## 5) UX/branding weaknesses

These are source-based findings, not a new visual browser audit.

1. **The first-run path makes users render React before their own repository.** [README.md:80](/Users/maximilian/code/repoville/README.md:80) follows several image sections with a long tarball command targeting React. Lead with “run inside your repo” using `. --open --format html`; keep the hosted React demo as the instant exploration path.

2. **The landing page’s CLI example is awkward to copy.** [site/index.html:229](/Users/maximilian/code/repoville/site/index.html:229) mixes command and output, has no copy button, and ends with non-executable `--package=…`. Provide separate complete commands and copy actions.

3. **The prominent two-second claim omits its qualification.** [site/index.html:132](/Users/maximilian/code/repoville/site/index.html:132) says React renders in two seconds; README qualifies that as a warm clone. Add “warm cache” and distinguish cloning from generation.

4. **Portrait imagery remains a crop, not a portrait composition.** The mobile hero uses a 4:3 box with `object-fit: cover` and adjusted positioning. Add a dedicated portrait render/video source with the relevant buildings framed intentionally.

5. **“Walk” promises more than the Fly control delivers.** The headline emphasizes walking, while the viewer exposes pointer-lock flight and keyboard movement. Explain “orbit, inspect, or fly” immediately, and reserve walking language for a collision-aware mode.

6. **Mobile controls lose labels and retain desktop interaction assumptions.** [HUD CSS](/Users/maximilian/code/repoville/src/write/html.ts:268) hides tool labels below 720px; the dock still contains Fly despite lacking touch movement controls. Use a smaller labeled primary set and a touch-oriented overflow menu.

7. **Metric legends lack numerical anchors.** The viewer caps metric height at the 98th percentile and applies a square-root color mapping, but shows only explanatory text and an unlabeled gradient. Show zero, midpoint, cap, units, and an explicit “values above X share this height.”

8. **Copy-link does not preserve the selected presentation.** The button copies `location.href`, but changing metric/night/texture controls does not update query state. A shared “night churn view” can reopen as daytime city view. Serialize the active scene state before copying.

9. **Accessible navigation is incomplete.** District-label buttons are placed inside `aria-hidden="true"` and excluded from tab order. The details dialog does not receive focus or restore it on close. Provide a keyboard-accessible district list and deliberate focus movement for details.

10. **The comparison slider’s focus indicator is invisible.** [site/index.html:65](/Users/maximilian/code/repoville/site/index.html:65) makes the range input fully transparent, including its outline. Draw focus on the visible comparison container/handle with `:focus-within`.

## 6) Fifteen feature ideas ranked by adoption/GitHub-star impact

Ranks are product judgments based on this repository’s current gaps, not traffic forecasts. **S/M/L** indicate relative engineering effort.

| Rank | Feature | Effort | Implementation sketch |
|---:|---|:---:|---|
| 1 | Reliable `npx repoville . --open` release | S | Package CLI plus viewer, validate a cold tarball invocation, and make this the consistent README/site/skill entry point. |
| 2 | GitHub Action that publishes a repository city | M | Analyze the checked-out commit, upload HTML/thumbnail artifacts, publish Pages, and output a badge targeting the actual deployment. |
| 3 | One-click share cards and flyover clips | M | Promote existing screenshot/recording scripts into branded 16:9, square, and portrait exports with commit and repository attribution. |
| 4 | Commit-history time-lapse | L | Analyze sampled refs, assign persistent path-based lots, and animate construction, demolition, and activity changes. |
| 5 | Pull-request “city diff” | L | Render base/head on one layout with additions, removals, and changed towers highlighted; publish the result as a PR artifact. |
| 6 | Search inside merged folder towers | M | Retain a compact file-to-aggregate index so any filename locates its tower and exposes constituent metrics. |
| 7 | Open selected buildings in source | S | Attach source-origin/ref metadata and generate encoded GitHub/GitLab blob links or opt-in local editor links. |
| 8 | Mobile exploration mode | M | Add touch navigation, portrait camera presets, labeled controls, and a bottom-sheet inspector. |
| 9 | Continuous local watch mode | L | Watch source changes and Git HEAD, recompute affected metrics, and update geometry while preserving camera and lot identity. |
| 10 | Faster large-city startup | L | Move chunk decoding/meshing to a worker, transfer packed buffers, and merge regions incrementally within a frame budget. |
| 11 | User-contributed city gallery | M | Accept generated HTML/metadata/thumbnail submissions, validate them, and build the gallery from a manifest rather than six hardcoded demos. |
| 12 | Explainable hotspot explorer | M | Add sortable churn, age, LOC, and marker-density tables linked to buildings, with visible threshold and aggregation explanations. |
| 13 | Coverage and complexity overlays | M | Import LCOV/Cobertura plus a defined complexity JSON format, mapping uncovered code and complexity to selectable views. |
| 14 | Actual street-level walking | L | Add voxel collision, gravity, spawn selection, and pedestrian routes through bridges and districts. |
| 15 | Coding-agent villagers | L | Define an opt-in local event stream mapping active file paths to moving villagers; require explicit tool events instead of inferring activity from arbitrary logs. |
