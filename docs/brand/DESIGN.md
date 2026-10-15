# Repoville design system

## Idea
A cartographer's instrument for a city made of code. The city is always the hero; interface chrome is quiet, precise and dark so the warm voxel colours carry the page.

## Palette

| Token | Hex | Use |
|---|---|---|
| Deepslate | `#23262E` | panels, dark surfaces (page background is the deeper `#191B20`) |
| Moss | `#4E8C3A` | primary actions, active states, "ok" status (hover `#6FB352`) |
| Redstone | `#D9382B` | ruins / TODO, destructive or alert states |
| Lava | `#FF7A1A` | churn / fire, selection outline |
| Diamond | `#3FD0C9` | links, focus rings, hover outline |
| Sandstone | `#E8D9A8` | secondary text accents, eyebrows, file stats |
| Bone | `#F6F1E4` | text on dark |

Rules: one accent per component. Lava and Redstone are reserved for the metrics they stand for; never use them decoratively. Text on Deepslate uses Bone (≥ 12:1) or Bone at 66 % (≥ 7:1).

## Type

| Role | Face | Notes |
|---|---|---|
| Wordmark, eyebrows, panel titles | Silkscreen 400 | sparingly, never for running text, ≥ 12 px |
| Headlines | Inter 800, letter-spacing −0.03em | |
| UI and body | Inter 400/500/600 | 13 px UI, 17 px web body |
| Paths, numbers, CLI | JetBrains Mono 400/600 | all file paths and metrics |

All three are on Google Fonts under the SIL Open Font License. The wordmark is drawn as vector paths, so it does not depend on Silkscreen being loaded.

## Logo

`assets/brand/`:

| File | Use |
|---|---|
| `mark.svg` | avatar, favicon ≥ 32 px, HUD |
| `favicon.svg` | 16 px |
| `mark-mono.svg` | single colour (`currentColor`), embossing, print |
| `wordmark-on-dark.svg` / `wordmark-on-light.svg` | README header (`<picture>` with prefers-color-scheme), site |
| `social-preview.png` | GitHub social preview, 1280×640, built from a real render |

The mark: three voxel towers on a sandstone street block; a Diamond git branch runs along the street; one Lava pixel crowns the tallest tower. It is not a grass block and uses no Minecraft textures.

Clear space: half the mark's height on every side. Minimum size: 16 px (mark), 180 px wide (wordmark). Do not recolour the towers, rotate the mark, add outlines or effects, or place it on busy imagery without a Deepslate plate.

## Components (viewer)
- Panels: Deepslate at 90 %, 1 px Bone/12 % border, 6 px radius, no blur-heavy glass.
- Dock: bottom centre, 36 px targets, icon + label (labels hidden < 720 px).
- Building card: left border in Lava, facts in a two-column mono grid.
- Focus: 2 px Diamond outline, 2 px offset. Reduced motion disables camera easing.

## Imagery
Only real renders. Golden-hour key light from the left-back, cool sky fill, dark background. Hero framing: 3/4 view aimed at the LOC-weighted downtown.
