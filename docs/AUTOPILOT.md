# Repoville autopilot

Standing instructions for unattended work sessions on Repoville (owner: Maxi / maximilianfeix).
Every iteration starts by reading this file and `docs/PROGRESS.md`.

## Goal

Make Repoville a project people want to try after one screenshot: a beautiful, data-faithful
voxel city, a premium viewer and landing page, strong branding, a README that converts,
and exports that really work in Minecraft. Deadline for this run: **2026-10-16 15:00 local**.

## Loop (one iteration ≈ one focused task, 20–60 min)

1. `cd ~/code/repoville && git fetch -q && git status` — never discard uncommitted work you did not make.
2. Read `docs/PROGRESS.md`; pick the highest-priority open task (P0 before P1). If a task is blocked, note why and pick the next.
3. Create/continue a branch `ap/<short-name>` from the newest base (main if PRs got merged, else the last open autopilot branch — stack branches).
4. Implement test-first where it makes sense. Keep determinism (seeded RNG, no wall clock), keep metrics honest.
5. Verify for real: `npx tsc --noEmit`, `npx vitest run`, `npx tsup`, render a real city and **look at the screenshot**
   (`npx tsx test/e2e/viewer-check.ts <html> <png> --width 1440 --height 900 --settle 3000`). For visual work do
   render → critique the 5 biggest problems → fix → re-render.
6. Commit in small logical steps (conventional commits) as `Maxi <223365242+maximilianfeix@users.noreply.github.com>`.
   **No AI attribution** anywhere (no Co-Authored-By, no "Generated with").
7. Push the branch; open a PR (or update the open one) with real before/after screenshots in `docs/media/`, test results,
   measurements and limitations. Try `gh pr merge --merge` when green; if the classifier blocks it, leave the PR open and stack the next branch on it.
8. Update `docs/PROGRESS.md` (done / next / blocked, with numbers) and `docs/DECISIONS.md` for non-obvious choices.
9. File GitHub issues for new findings (labels: bug, enhancement, good first issue, gallery, repo-request, v2-villagers).

## Hard rules

- Never post to social media, never publish to npm, never change secrets or repo settings beyond what PROGRESS lists as approved.
- No faked screenshots, numbers, stars or badges. Claims only after testing. Unverified marketing claims get `[CONFIRM]`.
- No Mojang assets; "Minecraft" never in the product name; keep the disclaimer.
- Do not delete history or other people's work. Ask nothing interactively — if blocked, write it into PROGRESS under "Needs Maxi".
- Repo-supplied config is untrusted; never execute code from analyzed repos.

## Quality bar for "done"

Viewer: 60 fps on React without shadows, file < 5 MB, works from file:// and Pages, usable at 390 px.
City: recognisable architecture, coherent districts, readable from the default camera, deterministic.
Exports: litemapy round-trip, WorldEdit paste on Paper verified, world zip loads on Paper.
