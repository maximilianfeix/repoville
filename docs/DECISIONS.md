# Decisions

Running log of choices made while building Repoville. Newest at the bottom of each section.

## 2026-10-15 — Day 0 (scaffold)

- **Toolchain pins** (checked with `npm view` on 2026-10-15): typescript 6.0.3 (7.0.2 is one day old), tsup 8.5.1 (9.0.0 is one day old), vitest 4.1.12 (5.x line is days old), commander 15.0.0, tinyexec 1.3.1, tinyglobby 0.2.17, ignore 7.0.12, d3-hierarchy 3.1.2, fflate 0.8.3, three 0.186.1. Preference: a version at least two weeks old.
- **Everything is bundled** into `dist/cli.js` (`noExternal`), so `npx repoville` does not install a dependency tree. All packages are devDependencies, so the published package has zero runtime dependencies and a cold `npx` downloads one tarball.
- **Own NBT writer instead of prismarine-nbt at runtime.** The spec already asks for hand-written ByteArray/LongArray framing streamed into gzip. A ~100-line writer covering the tags we emit avoids bundling protodef. prismarine-nbt stays as a test dependency to decode our output independently.
- **Dev machine is macOS**, not Windows as the brief assumed. Windows correctness is covered by the CI matrix (windows-latest) instead of local runs.
- **No domain yet.** `repoville.dev` is not registered; badges and gallery links point to `https://maximilianfeix.github.io/repoville/` until it is.

## 2026-10-15 — Days 1–3

- **File listing uses `git ls-files -z -t --cached --others --exclude-standard`** inside a work tree (exact .gitignore semantics incl. nested files); tinyglobby + ignore (root .gitignore) only outside git. Untracked files count as brand new, not as mossy.
- **One `git log` call**, `-z --name-only --no-renames --format=%x1e%H %ct`, bounded by `--since` = HEAD time − max(window, 3 years). Ages and the churn window are relative to the **HEAD commit time**, never the wall clock (determinism). Files untouched for 3+ years have `lastTouched: null` and are mossy.
- **Remote clones are `--filter=blob:none --shallow-since=<now − history window − 30d>`**, falling back to a full blobless clone. Linux: 731 MB `.git`, 263 s cold clone+analysis; a full blobless clone would be several GB.
- **Folder churn counts distinct commits** (not the sum of file changes). Merged LOD towers use the folder's distinct count. The first version summed file changes and printed "1601 commits" for a folder; that was wrong.
- **Spawned `git` directly via `node:child_process`** (shell: false) instead of tinyexec: the log needs a streamed stdout, and one helper is less than a dependency.
- **Building footprint side** = `round(√LOC / 2.5)`, min 3, max 48; files whose side would be < 2 (≈ under 14 LOC) live in a per-folder **suburb** of 3×3 houses (height ≤ 6). Footprints are centered in their lot with ≥ 1-block alley.
- **Layout fitting**: squarify can starve tiny siblings into sub-block slivers; growing the city makes it worse. Starved lots get their weight boosted (×1.6 per retry), the city grows 5–10 % on failure/crowding, capped at 1024. At the cap, towers that still do not fit move to the suburb. 5×4000 fast-check runs pass.
- **Plazas** (3-block strip with name sign + lantern) for folders at depth 1–3 with ≥ 3 children.
- **Fire thresholds** are percentiles over files with churn > 0, inclusive (≥), plus floors (campfire ≥ 3 commits, soul fire ≥ 10) so small repos with ties do not set everything on fire.
- **Ruins share = TODO markers / LOC** (literal reading of "that %"), capped at 60 %.
- **WorldEdit 7.3.19** in the Paper e2e: 7.4.x is compiled for Java 25 (class file 69), Paper 1.21.11 runs on Java 21. Console paste works via `//world world`, `//pos1`, `/schem load`, `//paste -a`; checks need `forceload` because no player keeps chunks loaded.
- **RCON**: the common "empty type-0 marker packet" trick to detect the end of a fragmented reply makes Paper drop the connection. We use Minecraft's 4096-byte fragment rule instead.
- **Sign text**: DataVersion ≥ 4325 (1.21.5) writes plain string components, older targets JSON strings. Verified on Paper 1.21.11: `["src", "", "", ""]`.
- **Config files are untrusted for remote repos** (security review): a cloned repo's `repoville.config.json` is ignored; `out`, `open` and `gallery` are CLI-only everywhere; palette overrides must be plain `minecraft:name[prop=value]` states and may not be command/structure/jigsaw blocks, portals, spawners or TNT (matters for live mode on a real server).
