# Progress

Updated by each autopilot iteration. Newest notes at the top of each section.

## Needs Maxi
- Post launch/x-post.md on X (image docs/media/hero-react.jpg), or allow browser posting for this session.
- Upload site-dist/media/social.png (new paper design) as the repo social preview.
- X launch: which account should post the thread (`launch/x-thread.md`)? Chrome is logged into @44errrr; nothing was posted.
- `gh auth refresh -h github.com -u maximilianfeix -s workflow` — without it no `.github/workflows/*` can be pushed (CI, Pages workflow).
- Upload `assets/brand/social-preview.png` as the repo's social preview (Settings → General; no API for it).
- npm: `npm login` + ok to publish `repoville` (name still free on 2026-10-15). Domain `repoville.dev` not registered.

## Done
- 2026-10-16 18:00: redesign after "sieht hässlich aus": Codex wrote docs/brand/MASTER-PROMPT.md from spillage/hexvero/proxy-scraper; calmer render (#107), paper/ink HUD (#108), site + README + brand (#109), v0.14.0 released (#110), site deployed, repo description updated. X post prepared (launch/x-post.md, #111) but posting from the browser was blocked by the auto-mode classifier; no stray likes/posts on @44errrr (checked).
- 2026-10-16 15:15: mini-map with camera marker and click-to-fly (#105, closes #3). Not released yet. Only v2 issue #8 remains open.
- 2026-10-16 14:30: docs/BUILDINGS.md with real renders of all nine families (#100, closes #6); home view now backs off until tall building tops are in frame (small repos with one tall file were cut off). Search Home/End/Escape (#102, closes #7). Released v0.13.0 (#103), site redeployed. Open good-first-issues left: #3 mini-map, #8 agents-as-villagers (v2).
- 2026-10-16 14:00: issue #4 done (#96): Swift/Lua copper town, C#/PHP reef; gravel roof decks replaced by tuff (they fell in game); WorldEdit e2e takes a repo path. Paper: themed repo 118/118, town 158/158 ×3. Released v0.12.0 (#98), site redeployed (theme text).
- 2026-10-16 12:30: closed stale #5 (--open exists). Linux demo read as a black mass: the sun was behind the home view (every visible face backlit). Three-quarter sun + lighter caves palette (#92). Released v0.11.0 (#94) with re-rendered hero video, demos, README media; site deployed.
- 2026-10-16 11:00: reviewed the other demos; Flask tests/test_apps was a dirt-path wasteland (suburb space kept the deep road surface). Suburb greens with lawns and trees (#87), Paper e2e 159/159. Height-aware home framing (fzf tower was cropped, #89). Released v0.10.0 (#90), site redeployed.
- 2026-10-16 10:30: landing hero video was still the 02:58 recording (pre-v2 textures); re-recorded from the real viewer (#85), site redeployed. Landing page checked at 1440 and 390 px (no overflow). Repo metadata already complete (20 topics).
- 2026-10-16 09:45: terraces for folders of small towers (#81, research #12 done after a planning agent); golden unchanged by keeping d3 insertion order. Released as v0.9.0 (#83) with re-rendered demos, README media, flyover; site deployed.
- 2026-10-16 08:30: tried recessed punched windows on test labs; rejected after before/after renders (single inset cells lose the glass colour, read as white notches). Kept the shared `Mason.recessGlass` refactor (#77). Test-lab districts then varied via whites, accent stripes and roofscapes (#79); not released yet.
- 2026-10-16 07:30: midrise ribbon windows (recessed), bar/fence connections in settle, e2e now checks every distinct block state (#73): Paper WorldEdit/world/live 159/159 each. Released in v0.8.0 (#75) with re-rendered demos, README media and flyover; site deployed.
- 2026-10-16 07:00: facade research (viewer meshes stairs/slabs as cubes → depth only from whole-block offsets); wide towers get piers, glass strips and a cornice (#71). Next: ribbon windows on midrises, recessed punched windows on testlabs (research #3).
- 2026-10-16 07:00: Paper e2e re-run after v0.7.0 found real mismatches (WorldEdit/live 2 failures: stair corner shapes, leaf distance; grass under floors). Settle pass with vanilla rules (#68), v0.7.1 released (#69). Paper 1.21.11: WorldEdit 66/66, world 64/64, live 64/64. X not posted: browser is logged into @44errrr, not a confirmed Repoville/Maxi account.
- 2026-10-16 06:25: street detail via worktree agent (#65: crosswalks, sidewalk wear, plaza benches), v0.7.0 released (#66; demos, README media, flyover re-rendered; site deployed; v0 tag moved). Launch drafts committed for 0.7.0 (drafts only).
- 2026-10-16 06:10: on main since v0.6.0: roofscapes (#58), animated pixel-snapped water (#59), day vignette + matching Photo export (#60), label collision culling (#61), portrait framing fix (fit was clamped by maxDistance; fog/far now scale) + on-screen edge labels (#62), warmer night windows (#63). Launch drafts refreshed in launch/ (uncommitted until the next release). Street-level detail pass running in a worktree.
- 2026-10-16 06:10: pixel textures v2 (#54), README media + flyover re-rendered (#55), v0.6.0 released (#56, release tarball verified: 0.6.0 with pixel layers), site redeployed. Awesome-list PRs opened (author disclosed): dictcp/awesome-git#215, bs-community/awesome-minecraft#81, AxiomeCG/awesome-threejs#62, toolleeo/awesome-cli-apps-in-a-csv#515.
- 2026-10-16 05:00: Diff view (#50) and v0.5.0 (#51); action has diff/timelapse inputs (verified locally against the release). Deadline extended to 20:00.
- 2026-10-16 04:20: v0.4.0. Since 02:15: avatar + visual audit + touch fix (#46), portrait mobile hero (#47), history time-lapse (#48, closes #34; demo on the site).
- 2026-10-16 02:15: v0.3.0 released (npx verified). Since 01:00: source links + URL view state + legend numbers (#41, closes #29/#31/#32), search inside merged towers (#42, closes #30), accessibility (#43, closes #33), demos re-rendered and site deployed.
- 2026-10-16 01:00: Codex inventory + triage (#36, issues #28–#35), hardening (#37), GitHub Action `maximilianfeix/repoville@v0` (#38/#39, tag v0; tested locally, not yet on hosted runners), photo button (#27), v0.2.0 released and Paper e2e re-verified on the new geometry.
- 2026-10-16 00:20 (tick 3): class massing (#25): footprints widen up to height/1.8 when the lot has room, so small files are houses with roofs instead of posts; height unchanged. Night mode (#24), v0.1.0 released with npx-from-release (#22/#23).
- 2026-10-16 00:00: merged #1–#20 (user granted merging). Since tick 2: independent code review (approve; fixes #11), procedural pixel textures + optional runtime Minecraft textures (#12), world zip verified on Paper (#13), live mode over RCON verified on Paper (#16), gallery PNG / --open / tour / agent skill (#17), community files + CI draft + launch drafts (#18), canals (#19), design pass after an independent design critique: new stepped-tower logo, site rewrite with hero video + texture slider + swatches, viewer label/contrast/ramp fixes, README flyover GIF (#20). Site redeployed.
- 2026-10-15 23:30 (tick 2): PR #10 landmark crowns (largest file of each folder with ≥ 3 buildings; ≤ 3 tiers + spire so it never reads as height), card tag "largest in its folder", focus framing from the building's bounding sphere (tall towers were cropped before).
- 2026-10-15 22:45 (tick 1): PR #9 baked AO (0fps, AO-aware greedy merge, diagonal flip) on upward faces, auto-on for cities ≤ 400k blocks² (`?ao=1/0` override); region merge after load. Measured (headless, load avg 5.5): React AO on 36–37 fps vs 42–43 off without shadows → AO auto-off for big cities; ripgrep with AO 60 fps. Region merge: no measurable change in headless (GPU-bound), kept for real CPUs. Nether ground → blackstone.
- 2026-10-15 22:00: GitHub Pages live at https://maximilianfeix.github.io/repoville/ (gh-pages branch via `scripts/build-site.ts` + `scripts/deploy-pages.sh`), demos React / Linux / ripgrep / fzf / repoville, real social preview. README rewritten with real renders and measured numbers. Brand system `docs/brand/DESIGN.md`, `VOICE.md`, assets in `assets/brand/`. Labels, issue templates, issues #3–#8.
- 2026-10-15 21:55: PR #2 (stacked on #1): downtown mirroring, street-edge footprints, pocket parks + ponds, street hierarchy, district roof grammar, static shadow map, ACES, downtown camera.
- 2026-10-15: Days 1–5 of the original plan (scan, gitlog, layout+LOD, voxel/schem/litematic, viewer) — see DECISIONS.md.
- 2026-10-15: PR #1 visual overhaul part 1 (building families, lit diorama viewer, HUD, metric view).

## Backlog (P0 first)

### P0 — city looks art-directed
- [ ] Apply research findings (composition: downtown clustering / parks / plaza greens / value hierarchy) — research notes in `docs/engineering/visual-research.md`.
- [x] Static shadow map, baked AO (size-gated), region merge. [ ] Packed attributes, worker meshing, shader windows.
- [ ] Mobile portrait hero framing (landing hero crops the city on 390 px); hero camera presets that frame the city well at 16:9, 2:1 and mobile portrait.
- [ ] Visual audit doc `docs/engineering/visual-audit.md` with before/after.

### P0 — brand
- [x] `assets/brand/`: mark, mono, favicon, wordmarks, social preview. [ ] PNG avatar 512.
- [x] `docs/brand/DESIGN.md` and `docs/brand/VOICE.md`.
- [x] New stepped-tower mark in viewer HUD and favicon (#20).
- [x] Landmark crowns (visual-research #6). [ ] water edges (#4), suburb rows (#12), class massing (#1).

### P0 — landing page + README
- [x] `site/` landing page (hero = real city render, demo link, mapping, formats, CLI, Minecraft, metrics honesty, GitHub CTA), deployed to GitHub Pages via a `gh-pages` branch (no workflow scope needed).
- [x] Demo cities on Pages: React, this repo, one Rust + one Go repo (themes), at `/r/<owner>/<repo>/`.
- [x] README: centered logo, tagline, real screenshot + GIF, quick start (only verified commands), mapping table, formats, privacy, limits, FAQ, contributing, disclaimer.

### P0 — promotion (approved 2026-10-16; rules first, no spam)
- [ ] dev.to article (with AI-assistance disclosure as dev.to requires).
- [ ] X launch thread (video first, link in reply).
- [x] Awesome-list PRs where the tool fits (git #215, Minecraft #81, three.js #62, CLI apps #515). [ ] Later, with stars: awesome-dataviz (50+), awesome-voxel.
- [ ] Reddit: only subreddits that allow self-promotion of open-source tools; respect flair/weekday rules.
- [ ] Show HN text stays a draft for Maxi (HN asks for human-written comments).

### P0 — visual quality
- [x] Texture v2: hue-shifted colour ramps per palette colour (#54, v0.6.0).
- [x] Roofscapes (#58), water ripples (#59), night windows (#63). [x] Street-level detail (#65). [x] v0.7.0 + re-render site/README (#66).

### P0 — next
- [x] Hardening from the Codex inventory (#37) (docs/engineering/codex-inventory.md §2): symlinks, URL/cache identity, ref cache, RCON deadlines, template names, force-load cleanup, LOD budget, roof validation, chunk retention + doc accuracy fixes.
- [x] GitHub Action (#28 → #38). [ ] First real run on a hosted runner (needs a workflow file → workflow scope).
- [x] Open in source (#29), merged search (#30), legend numbers (#31), view state (#32), a11y (#33).
- [x] Churn-view image framed on react-reconciler.
- [ ] Shader-based facade windows to cut quads (perf-research #3); packed attributes (#2).
- [x] Class massing (#1). [x] Suburb rows / terraces (#81).
- [ ] npm pack dry run + cold `npx` test from a tarball.
- [x] Re-run all Paper e2e after the geometry changes (#68, v0.7.1). [ ] CI once workflow scope exists.

### P1 — product completeness
- [x] World zip export verified on Paper (#13).
- [x] Live mode over RCON, e2e on Paper (#16).
- [ ] Re-run WorldEdit e2e with the new geometry; check signs, stairs facing, leaves persistence.
- [x] `repoville tour`, `--open`, `--gallery` (#17).
- [x] `skill/SKILL.md` (#17).
- [ ] CI: test matrix (ubuntu/macos/windows), litemapy job, viewer check, Paper e2e job (needs workflow scope).
- [x] Issue templates, labels, good-first-issues (#3–#7). [x] CONTRIBUTING, SECURITY, CODE_OF_CONDUCT (#18).
- [x] Launch drafts in `launch/` (#18).

### P2 — engineering
- [ ] Security pass (prompt §10): URL validation, symlinks, cache isolation, bounded output, timeouts.
- [ ] Packed vertex attributes / worker meshing; layout stability test between nearby commits.
- [ ] npm package dry run (`npm pack`), cold `npx` test.
