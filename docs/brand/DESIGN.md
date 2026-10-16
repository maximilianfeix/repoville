# Design system

Since October 2026 repoville follows the same direction as the author's other projects (spillage, hexvero, proxy-scraper): editorial paper, one accent, a large tight headline that states a concrete promise, and real output as the only imagery. The brief that led here is in [MASTER-PROMPT.md](MASTER-PROMPT.md).

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| bg | `#F6F3EC` | `#101410` | page and city backdrop (`viewer/stage.ts`) |
| surface | `#FFFDF8` | `#1B211B` | panels, command boxes |
| text | `#20231F` | `#F2F1E9` | body and headings |
| muted | `#596057` | `#B6BDAF` | secondary text |
| rule | `#D7D9CF` | `#394339` | 1 px separators |
| accent | `#356449` | `#9CC8A5` | actions, links, selection, focus |

City colours (fire, moss, cracks, language themes) are data and stay separate from interface colour. The viewer grades block colours (`viewer/grade.ts`) so a frame holds about three material families; fire and selection are the exceptions.

## Type

- **Bricolage Grotesque 800** for the wordmark and display headings: `clamp(48px, 8.6vw, 118px)`, line-height .92, tracking −.05em.
- **System sans** for body and controls, 17 px / 1.55, 52–64 ch measure.
- **JetBrains Mono** for paths, commands and measured values.

## Layout

1120 px wrapper, 24 px gutters (20 px on phones), spacing 8/16/24/40/64/96/112. Asymmetric two-column sections, hairline rules instead of boxes, pill shape only for the primary action.

## Mark

Three bars of different heights (`assets/brand/favicon.svg`): muted, text and accent. Drawn as rectangles, no font needed.

## Never

Gradients, glass, glow, pixel fonts, emoji, stock icons, rainbow districts, identical card grids, scroll reveals, fake terminals, numbers without a source.
