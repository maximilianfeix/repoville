# Viewer rendering research (2026-10-15)

Summary of a read-only research pass over `viewer/main.ts` and `viewer/mesher.ts`. Gains are estimates until measured.

| # | Change | Expected effect | Status |
|---|---|---|---|
| 1 | Static shadow map: `sun.shadow.autoUpdate = false`, `needsUpdate = true` after mesh batches | shadows near no-shadow fps (scene is static) | done in ap/brand-and-shadows |
| 2 | Packed attributes (Uint16 chunk-local positions, Uint8 normalized colours, flatShading instead of normals, Uint16 indices) | ~3× less vertex memory | open |
| 3 | Windows via shader pattern instead of glass voxels in flush walls | 30–50% fewer quads on window-heavy repos | open |
| 4 | Real per-vertex AO (0fps method), AO-aware greedy merge, diagonal flip | large visual gain, +5–15% quads | open |
| 5 | Merge chunks into regions or BatchedMesh | ~2048 → ~32 draws | open |
| 6 | 2× downsampled LOD for distant regions | 40–60% fewer rendered quads | open |
| 7 | AgX/ACES tone mapping, lower warmer sun, warm fog, grade in palette | golden-hour look, no post pass | partly done |
| 8 | Mesh in a Web Worker (inline blob), transfer buffers | no main-thread stalls while loading | open |

Sources: 0fps.net "Meshing in a Minecraft game" and "Ambient occlusion for Minecraft-like worlds"; three.js forum threads on caching shadow maps (per-light `LightShadow.autoUpdate` after r164); noa-engine terrain mesher.
