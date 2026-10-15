import { describe, expect, it } from 'vitest';
import { decodePayload, encodePayload, fillChunk, type ViewerMeta } from '../viewer/format.js';
import { greedyMesh } from '../viewer/mesher.js';

function meta(width: number, length: number, height: number): ViewerMeta {
  return {
    name: 't', head: null, headTime: 0, since: '1y', generator: 'test', site: '', badge: '', width, length, height,
    stats: { files: 0, loc: 0, commits: 0, buildings: 0, todos: 0, languages: [] },
    highlights: { hottestDistricts: [], mostRuined: [], oldestCorner: null },
    colors: [0, 0xff0000, 0x00ff00], kinds: [0, 1, 1], states: ['air', 'a', 'b'], buildings: [], districts: [], textured: false,
  };
}

describe('viewer payload', () => {
  it('round-trips column runs and fills chunks with a border', () => {
    // 2x1 city: column 0 = [1,1,2], column 1 = [0,0,2]
    const runs = Uint16Array.from([2, 1, 2, 2, 1, /* col1 */ 2, 0, 2, 2, 1]);
    const p = decodePayload(encodePayload(meta(2, 1, 3), runs));
    expect(Array.from(p.columnOffsets)).toEqual([0, 5]);
    const out = new Uint16Array(4 * 3 * 3);
    fillChunk(p, 0, 0, 2, 1, out);
    const at = (x: number, y: number, z: number) => out[(y * 3 + (z + 1)) * 4 + (x + 1)];
    expect([at(0, 0, 0), at(0, 1, 0), at(0, 2, 0)]).toEqual([1, 1, 2]);
    expect([at(1, 0, 0), at(1, 1, 0), at(1, 2, 0)]).toEqual([0, 0, 2]);
    expect(at(-1, 0, 0)).toBe(0);
  });
});

describe('greedyMesh', () => {
  it('meshes a single cube as six quads', () => {
    const vox = new Uint16Array(3 * 1 * 3);
    vox[(0 * 3 + 1) * 3 + 1] = 1;
    const m = greedyMesh(vox, 1, 1, 1, [0, 0xffffff], [0, 1], [0, 0, 0]);
    expect(m.quads).toBe(6);
    expect(m.indices.length).toBe(36);
  });

  it('merges a flat 4x4 slab of one id into one quad per side', () => {
    const sx = 4, sy = 1, sz = 4;
    const vox = new Uint16Array((sx + 2) * sy * (sz + 2));
    for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) vox[(z + 1) * (sx + 2) + (x + 1)] = 1;
    const m = greedyMesh(vox, sx, sy, sz, [0, 0xffffff], [0, 1], [0, 0, 0]);
    expect(m.quads).toBe(6);
  });

  it('does not emit faces hidden by neighbours across the chunk border', () => {
    const sx = 1, sy = 1, sz = 1;
    const vox = new Uint16Array(3 * 3);
    vox[1 * 3 + 1] = 1; // the cell
    vox[1 * 3 + 2] = 1; // +x neighbour in the border
    const m = greedyMesh(vox, sx, sy, sz, [0, 0xffffff], [0, 1], [0, 0, 0]);
    expect(m.quads).toBe(5);
  });
});

describe('ambient occlusion', () => {
  it('darkens floor corners next to a block and leaves open floor bright', () => {
    const sx = 3, sy = 2, sz = 3;
    const bx = sx + 2, bz = sz + 2;
    const vox = new Uint16Array(bx * bz * sy);
    const at = (x: number, y: number, z: number) => (y * bz + (z + 1)) * bx + (x + 1);
    for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) vox[at(x, 0, z)] = 1;
    vox[at(1, 1, 1)] = 2;
    const m = greedyMesh(vox, sx, sy, sz, [0, 0xffffff, 0xffffff], [0, 1, 1], [0, 0, 0]);
    // Collect brightness of upward-facing vertices at y = 1 (the floor top).
    const floor: number[] = [];
    for (let i = 0; i < m.positions.length / 3; i++) {
      if (m.normals[i * 3 + 1] === 1 && m.positions[i * 3 + 1] === 1) floor.push(m.colors[i * 3]!);
    }
    expect(Math.min(...floor)).toBeLessThan(Math.max(...floor) * 0.9);
  });
});

import { mcTextureName } from '../viewer/mctextures.js';
import { familyOf } from '../viewer/textures.js';

describe('texture mapping', () => {
  it('maps block states to original texture file names', () => {
    expect(mcTextureName('minecraft:spruce_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]', 'side')).toBe('spruce_planks');
    expect(mcTextureName('minecraft:oak_log[axis=y]', 'top')).toBe('oak_log_top');
    expect(mcTextureName('minecraft:quartz_pillar[axis=y]', 'side')).toBe('quartz_pillar_side');
    expect(mcTextureName('minecraft:grass_block[snowy=false]', 'top')).toBe('grass_block_top');
    expect(mcTextureName('minecraft:deepslate_tile_slab[type=bottom,waterlogged=false]', 'top')).toBe('deepslate_tiles');
  });
  it('assigns procedural detail families', () => {
    expect(familyOf('minecraft:bricks')).toBe('bricks');
    expect(familyOf('minecraft:stone_bricks')).toBe('stoneBricks');
    expect(familyOf('minecraft:oak_planks')).toBe('planks');
    expect(familyOf('minecraft:light_blue_stained_glass')).toBe('glass');
    expect(familyOf('minecraft:oak_leaves[distance=1,persistent=true,waterlogged=false]')).toBe('leaves');
  });
});
