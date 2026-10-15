# Progress

Updated by each autopilot iteration. Newest notes at the top of each section.

## Needs Maxi
- `gh auth refresh -h github.com -u maximilianfeix -s workflow` — without it no `.github/workflows/*` can be pushed (CI, Pages workflow).
- Allow merging: the auto-mode classifier blocks `gh pr merge` ("Merge Without Review"). Add a permission rule, e.g. `Bash(gh pr merge:*)`, or merge PRs by hand. Open: #1 → #2 (stacked).
- Upload `assets/brand/social-preview.png` as the repo's social preview (Settings → General; no API for it).
- npm: `npm login` + ok to publish `repoville` (name still free on 2026-10-15). Domain `repoville.dev` not registered.

## Done
- 2026-10-15 22:45 (tick 1): PR #9 baked AO (0fps, AO-aware greedy merge, diagonal flip) on upward faces, auto-on for cities ≤ 400k blocks² (`?ao=1/0` override); region merge after load. Measured (headless, load avg 5.5): React AO on 36–37 fps vs 42–43 off without shadows → AO auto-off for big cities; ripgrep with AO 60 fps. Region merge: no measurable change in headless (GPU-bound), kept for real CPUs. Nether ground → blackstone.
- 2026-10-15 22:00: GitHub Pages live at https://maximilianfeix.github.io/repoville/ (gh-pages branch via `scripts/build-site.ts` + `scripts/deploy-pages.sh`), demos React / Linux / ripgrep / fzf / repoville, real social preview. README rewritten with real renders and measured numbers. Brand system `docs/brand/DESIGN.md`, `VOICE.md`, assets in `assets/brand/`. Labels, issue templates, issues #3–#8.
- 2026-10-15 21:55: PR #2 (stacked on #1): downtown mirroring, street-edge footprints, pocket parks + ponds, street hierarchy, district roof grammar, static shadow map, ACES, downtown camera.
- 2026-10-15: Days 1–5 of the original plan (scan, gitlog, layout+LOD, voxel/schem/litematic, viewer) — see DECISIONS.md.
- 2026-10-15: PR #1 visual overhaul part 1 (building families, lit diorama viewer, HUD, metric view).

## Backlog (P0 first)

### P0 — city looks art-directed
- [ ] Apply research findings (composition: downtown clustering / parks / plaza greens / value hierarchy) — research notes in `docs/engineering/visual-research.md`.
- [x] Static shadow map. [x] Baked per-vertex AO (perf-research #4, size-gated), packed attributes (#2), region merge (#5).
- [ ] Mobile portrait hero framing (landing hero crops the city on 390 px); hero camera presets that frame the city well at 16:9, 2:1 and mobile portrait.
- [ ] Visual audit doc `docs/engineering/visual-audit.md` with before/after.

### P0 — brand
- [x] `assets/brand/`: mark, mono, favicon, wordmarks, social preview. [ ] PNG avatar 512.
- [x] `docs/brand/DESIGN.md` and `docs/brand/VOICE.md`.
- [ ] Use the new mark in the viewer favicon (HUD already uses it).
- [ ] Landmark crowns (visual-research #6), water edges (#4), suburb rows (#12), class massing (#1).

### P0 — landing page + README
- [x] `site/` landing page (hero = real city render, demo link, mapping, formats, CLI, Minecraft, metrics honesty, GitHub CTA), deployed to GitHub Pages via a `gh-pages` branch (no workflow scope needed).
- [x] Demo cities on Pages: React, this repo, one Rust + one Go repo (themes), at `/r/<owner>/<repo>/`.
- [x] README: centered logo, tagline, real screenshot + GIF, quick start (only verified commands), mapping table, formats, privacy, limits, FAQ, contributing, disclaimer.

### P1 — product completeness
- [ ] World zip export (superflat level.dat + Anvil regions) verified on Paper.
- [ ] Live mode over RCON (`repoville live`) using structure .nbt tiles + /place template, e2e on Paper.
- [ ] Re-run WorldEdit e2e with the new geometry; check signs, stairs facing, leaves persistence.
- [ ] `repoville tour`, `--open`, `--gallery` (city.png + meta.json), `badge` polish.
- [ ] `skill/SKILL.md` (Claude Code / Codex skill).
- [ ] CI: test matrix (ubuntu/macos/windows), litemapy job, viewer check, Paper e2e job (needs workflow scope).
- [x] Issue templates, labels, good-first-issues (#3–#7). [ ] CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
- [ ] Launch drafts in `launch/` (Show HN, X thread, Reddit, Shorts script) — drafts only.

### P2 — engineering
- [ ] Security pass (prompt §10): URL validation, symlinks, cache isolation, bounded output, timeouts.
- [ ] Packed vertex attributes / worker meshing; layout stability test between nearby commits.
- [ ] npm package dry run (`npm pack`), cold `npx` test.
