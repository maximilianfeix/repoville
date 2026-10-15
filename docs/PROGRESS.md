# Progress

Updated by each autopilot iteration. Newest notes at the top of each section.

## Needs Maxi
- `gh auth refresh -h github.com -u maximilianfeix -s workflow` — without it no `.github/workflows/*` can be pushed (CI, Pages workflow).
- Allow merging: the auto-mode classifier blocks `gh pr merge` ("Merge Without Review"). Add a permission rule, e.g. `Bash(gh pr merge:*)`, or merge PRs by hand. Open: #1.
- npm: `npm login` + ok to publish `repoville` (name still free on 2026-10-15). Domain `repoville.dev` not registered.

## Done
- 2026-10-15: Days 1–5 of the original plan (scan, gitlog, layout+LOD, voxel/schem/litematic, viewer) — see DECISIONS.md.
- 2026-10-15: PR #1 visual overhaul part 1 (building families, lit diorama viewer, HUD, metric view).

## Backlog (P0 first)

### P0 — city looks art-directed
- [ ] Apply research findings (composition: downtown clustering / parks / plaza greens / value hierarchy) — research notes in `docs/engineering/visual-research.md`.
- [ ] Static shadow map (render once) + baked AO so shadows stay on at 60 fps.
- [ ] Hero camera presets that frame the city well at 16:9, 2:1 and mobile portrait.
- [ ] Visual audit doc `docs/engineering/visual-audit.md` with before/after.

### P0 — brand
- [ ] `assets/brand/`: mark, mono, favicon, wordmarks (fix the "v" that reads as "u"), PNG avatar 512, social preview 1280×640 from a real render.
- [ ] `docs/brand/DESIGN.md` (palette, type, logo rules, spacing) and `docs/brand/VOICE.md`.
- [ ] Use the new mark in the viewer favicon and HUD.

### P0 — landing page + README
- [ ] `site/` landing page (hero = real city render, demo link, mapping, formats, CLI, Minecraft, metrics honesty, GitHub CTA), deployed to GitHub Pages via a `gh-pages` branch (no workflow scope needed).
- [ ] Demo cities on Pages: React, this repo, one Rust + one Go repo (themes), at `/r/<owner>/<repo>/`.
- [ ] README: centered logo, tagline, real screenshot + GIF, quick start (only verified commands), mapping table, formats, privacy, limits, FAQ, contributing, disclaimer.

### P1 — product completeness
- [ ] World zip export (superflat level.dat + Anvil regions) verified on Paper.
- [ ] Live mode over RCON (`repoville live`) using structure .nbt tiles + /place template, e2e on Paper.
- [ ] Re-run WorldEdit e2e with the new geometry; check signs, stairs facing, leaves persistence.
- [ ] `repoville tour`, `--open`, `--gallery` (city.png + meta.json), `badge` polish.
- [ ] `skill/SKILL.md` (Claude Code / Codex skill).
- [ ] CI: test matrix (ubuntu/macos/windows), litemapy job, viewer check, Paper e2e job (needs workflow scope).
- [ ] Issue templates, labels, 5 good-first-issues, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT.
- [ ] Launch drafts in `launch/` (Show HN, X thread, Reddit, Shorts script) — drafts only.

### P2 — engineering
- [ ] Security pass (prompt §10): URL validation, symlinks, cache isolation, bounded output, timeouts.
- [ ] Packed vertex attributes / worker meshing; layout stability test between nearby commits.
- [ ] npm package dry run (`npm pack`), cold `npx` test.
