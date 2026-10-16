Act as the product designer and front-end lead for Repoville. Redesign its landing page, README, viewer chrome, render presentation, and launch assets in one working day. Deliver working changes, reproducible assets, and browser verification.

Make Repoville feel like a carefully made developer tool whose output happens to be a voxel city. Follow the author’s established direction: editorial paper, large expressive typography, restrained colour, concrete copy, and real output as evidence.

**1. Establish scope and evidence**

Work in `~/code/repoville`. Read repository instructions before editing. Inspect `site/index.html`, `scripts/build-site.ts`, `README.md`, `src/write/html.ts`, and the relevant render, colour, and palette modules. Edit source files; regenerate `site-dist` through the build script.

Keep the landing page static HTML/CSS with small vanilla JavaScript. Retain three.js in the standalone viewer. Preserve CLI behaviour, exports, existing demo URLs, query parameters, and file deep links.

Use the supplied measurements of spillage, proxy-scraper, and hexvero as visual authority. Match their confidence and specificity without copying their content. Use [spillage’s README](https://github.com/maximilianfeix/spillage#readme) as the reference for navigable documentation, concrete commands, and factual explanations.

Generate every product image from Repoville. Capture real CLI output. Record repository SHA, generation options, seed, and camera state alongside assets. Never invent counts, performance claims, popularity, or testimonials. Mark unresolved assertions `[CONFIRM]` in the handoff; verify or omit them before publication.

**2. Define the visual system**

Use an architectural model on a worktable as the governing image: quiet surroundings, readable buildings, deliberate framing.

Set these CSS tokens:

- Light: background `#F6F3EC`, surface `#FFFD F8` corrected to `#FFFDF8`, text `#20231F`, secondary text `#596057`, rule `#D7D9CF`, accent `#356449`.
- Dark: background `#101410`, surface `#1B211B`, text `#F2F1E9`, secondary text `#B6BDAF`, rule `#394339`, accent `#9CC8A5`.

Use the accent for primary actions, links, selected states, and focus. Keep semantic city colours separate from interface branding. Measure contrast in the actual combinations; adjust tokens where necessary.

Use Bricolage Grotesque 800 for the wordmark and display headings, a system sans-serif stack for body text, and JetBrains Mono for paths, commands, and measured values. Remove Silkscreen. Self-host licensed font subsets for the site; retain readable offline fallbacks in the viewer.

Set the hero at `clamp(44px, 8.4vw, 112px)`, line-height `.94`, tracking `-.045em`, maximum width approximately `12ch`. Use 17px body text with 1.55 line-height and a 64ch reading measure.

Use a 1120px wrapper, 24px desktop gutters, 20px mobile gutters, and a spacing scale of 8/16/24/40/64/96px. Prefer asymmetric compositions and open space. Use rules to separate information, not surround every paragraph. Reserve pill shapes for primary actions; use modest corners on functional panels.

Default to system colour preference. Provide a labelled theme toggle with a persisted override.

**3. Build one signature moment: inspect a file, see its building**

Replace the autoplay hero video with a “file → building” inspection strip using pre-rendered screenshots and actual metadata.

Choose three individually represented files from one pinned React demo: a small file, a larger file, and a file with recent activity. Verify that none represents an aggregated folder.

On desktop, place selectable file paths and measured facts in a narrow left column beside a large city crop. Selecting a file replaces the image with a real capture focused on its building, updates the facts, and updates an “Open this building” deep link. Show non-blank lines, commits within the configured window, and TODO markers only when available.

Use native buttons with a clear selected state. Keep the first example visible without JavaScript; keep every destination accessible as a normal link. Stack controls above the image on mobile.

Allow a short opacity transition, disabled under reduced motion. Do not autoplay, simulate growth, fabricate code, or load three.js on the landing page. This inspection strip is the page’s single expressive interaction.

**4. Rebuild the landing page in this order**

**Navigation.** Put “repoville” left; “Demos”, “How it works”, and “GitHub” right. Make the GitHub action read “Star on GitHub” without a hard-coded count. Avoid a hamburger for this small navigation.

**Hero.** Use:

“See your repo  
as a city.”

Lede: “Folders become districts. Files become buildings. **Git history leaves its marks.** Open the result in your browser.”

Provide one primary action, “Explore React”, and a quiet “Run it on your repo” anchor. Place the inspection strip directly below. Caption it with the repository and shortened source SHA.

**Run it locally.** Use “Your repo. One command.” Show a copyable command:

```sh
npx --package=https://github.com/maximilianfeix/repoville/releases/latest/download/repoville.tgz repoville . --open
```

Add: “Requires Node.js 22+ and git. Runs from the GitHub release; the npm package is not published yet.” Verify that release status before shipping. Explain that `.` can be replaced with `owner/repo` or a git URL. Keep the command selectable and horizontally scrollable without widening the page.

**Read the city.** Use “The buildings are data.” Present a compact mapping table: folders → districts; file size → building height; churn → roof fire; TODO markers → cracks; a year without commits → moss.

Add: “Fire means activity. Moss means time since the last change. Neither is a code review.”

Explain that height uses a compressed scale and large repositories may group files into buildings. Keep exact rules in linked documentation.

**Try another repository.** Give React one substantial image, then present Linux, ripgrep, Flask, fzf, and Repoville as compact linked rows with consistent thumbnails. Derive any counts from the captured dataset. Label files and buildings separately. Remove biome jokes and repetitive “Explore” buttons.

**Keep the result.** Use “One HTML file. Or actual blocks.” Explain the browser viewer, then list `.schem`, `.litematic`, and world exports. Link export instructions. Include the Paper verification claim only with a checked version and evidence.

**Local analysis.** Use “The analysis runs on your machine.” Distinguish local processing from downloads needed for installation, remote repositories, or optional textures. Verify what generated files contain. Explain that sharing an HTML export shares its embedded repository metadata.

**Footer.** End with “Try it on a repo you know.” Link the command and GitHub. Include author, licence, and the exact disclaimer:

“NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.”

Remove the standalone texture slider, night showcase, repeated CTA banners, and redundant feature grids.

**5. Restructure the README**

Create light and dark SVG banners selected with `<picture>`. Use the new wordmark and promise; keep SVGs self-contained and legible without installed fonts.

Follow with one restrained badge row: release, licence, and CI only if a real workflow exists. Use one brand colour. Add a short navigation line: Demo · Quick start · How it works · Exports · Options · FAQ.

Show one linked real city screenshot instead of an autoplay GIF. Follow with four factual bullets covering browser output, local analysis, repository signals, and exports.

Place quick start immediately afterward, then a short authentic CLI transcript with provenance. Continue with the mapping table, compact demo list, options, GitHub Action, exports, limitations, FAQ, and contributing links. Preserve useful technical detail through linked documentation. Explain aggregation, metric limitations, and network exceptions plainly.

**6. Restyle the viewer HUD**

Use opaque paper panels in day mode and opaque ink panels at night, with matching initial chrome and an independent persisted theme override. Avoid blur and glass effects.

Keep repository identity top-left. Consolidate statistics top-right into a readable summary. Keep Search, Tour, and Fit visible in the bottom dock; group Fly, View, Guide, and Photo behind labelled secondary controls without removing functionality.

Use body typography for controls and mono for paths and values. Give selected buildings a clear outline plus a textual details panel. Preserve search, keyboard navigation, minimap, export/photo behaviour, and existing deep links.

At 390px, use a compact bottom toolbar and dismissible sheet. Respect safe areas. Restore focus when closing drawers; support Escape; keep keyboard focus visible. Keep the disclaimer accessible without overlaying essential controls.

**7. Make the city look composed**

Tune the existing renderer rather than rebuilding city generation.

Establish pale stone walls, darker roofs, a quiet ground plane, and subdued planting as the dominant value structure. Reduce texture contrast and saturated biome variation. Aim for three dominant material families per frame, with fire and selection as small exceptions.

Keep metric encodings accurate. Do not hide active roofs or alter counts to improve a screenshot. Preserve language information in labels and inspection details when reducing colour distinctions.

Choose a repeatable three-quarter camera with moderate perspective, a visible district boundary, and breathing room around the skyline. Use one directional key light, gentle ambient fill, soft shadows, and restrained distance fog. Keep streets readable. Avoid bloom, dramatic sunsets, crushed shadows, and decorative particles.

Use existing render/material hooks; avoid new post-processing dependencies. Apply the presentation to shipped viewers as well as marketing captures. Preserve valid Minecraft block mappings and export behaviour. Bundle no Mojang assets; keep runtime textures explicitly optional.

**8. Produce launch assets**

Generate a 1200×630 social preview, a 1600×900 X image, and a 1600×1200 Reddit image using browser-rendered layouts and real city captures.

Use “See your repo as a city.” on the preview. Use the inspection strip’s real path and building pairing for X. Give Reddit a larger city view and a compact factual legend. Include repository identity and snapshot provenance in captions.

Check small-thumbnail legibility and cropping. Write alt text. Reuse the site’s typography and palette; add no fake windows, promotional statistics, or decorative voxel illustrations. Prepare assets without publishing posts.

**9. Execute and verify within one day**

1. **Audit and freeze evidence — 45 minutes.** Record source paths, pinned demo data, existing checks, and unresolved claims. Acceptance: every planned claim has evidence or `[CONFIRM]`.
2. **Tune renderer and capture assets — 90 minutes.** Acceptance: consistent cameras, restrained materials, accurate signals, reproducible captures.
3. **Implement landing page — 120 minutes.** Acceptance: complete section order, working inspection strip, copy control, themes, and no-JavaScript fallback.
4. **Restyle HUD — 75 minutes.** Acceptance: existing interactions and deep links work at desktop and 390px.
5. **Update README and launch assets — 60 minutes.** Acceptance: working links, theme-aware banners, real evidence, correct metadata.
6. **Verify and correct — 90 minutes.** Run build, typecheck, and relevant existing tests. Capture desktop and 390px in both themes; fix findings in one batch and confirm.

Reject gradients, glass panels, pixel branding, rainbow districts, emoji features, stock icons, identical card grids, arbitrary numbered sections, coloured headline fragments, scroll reveals, fake terminal activity, unsupported superlatives, and invented social proof.

Verify WCAG AA text contrast, 3:1 control boundaries where required, keyboard operation, visible focus, 44px primary touch targets, 200% zoom, reduced motion, meaningful alt text, and zero page-level horizontal overflow. Load the standalone viewer offline with optional network features disabled.

Deliver changed files, generated assets, screenshots, checks run, and remaining `[CONFIRM]` items. Do not claim completion while essential interactions or evidence remain unresolved.
