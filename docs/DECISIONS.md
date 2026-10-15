# Decisions

Running log of choices made while building Repoville. Newest at the bottom of each section.

## 2026-10-15 — Day 0 (scaffold)

- **Toolchain pins** (checked with `npm view` on 2026-10-15): typescript 6.0.3 (7.0.2 is one day old), tsup 8.5.1 (9.0.0 is one day old), vitest 4.1.12 (5.x line is days old), commander 15.0.0, tinyexec 1.3.1, tinyglobby 0.2.17, ignore 7.0.12, d3-hierarchy 3.1.2, fflate 0.8.3, three 0.186.1. Preference: a version at least two weeks old.
- **Everything is bundled** into `dist/cli.js` (`noExternal`), so `npx repoville` does not install a dependency tree. Runtime deps stay in `dependencies` only for transparency; they are not needed at runtime.
- **Own NBT writer instead of prismarine-nbt at runtime.** The spec already asks for hand-written ByteArray/LongArray framing streamed into gzip. A ~100-line writer covering the tags we emit avoids bundling protodef. prismarine-nbt stays as a test dependency to decode our output independently.
- **Dev machine is macOS**, not Windows as the brief assumed. Windows correctness is covered by the CI matrix (windows-latest) instead of local runs.
- **No domain yet.** `repoville.dev` is not registered; badges and gallery links point to `https://maximilianfeix.github.io/repoville/` until it is.
