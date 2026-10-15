import { gunzipSync } from 'node:zlib';
import nbtlib from 'prismarine-nbt';
import { describe, expect, it } from 'vitest';
import { VoxelGrid } from '../src/build/voxel-grid.js';
import { structureTiles, TILE } from '../src/write/structure-nbt.js';

describe('structure tiles', () => {
  it('splits the grid into ≤48³ templates, skips air and empty tiles', async () => {
    const g = new VoxelGrid(100, 60, 50);
    g.setState(0, 0, 0, 'minecraft:stone');
    g.setState(99, 55, 49, 'minecraft:oak_slab[type=bottom,waterlogged=false]');
    g.setState(10, 1, 10, 'minecraft:oak_sign[rotation=0,waterlogged=false]');
    g.blockEntities.push({ x: 10, y: 1, z: 10, id: 'minecraft:sign', kind: 'sign', lines: ['src'] });
    const tiles = structureTiles(g, 4671);
    expect(tiles.map((t) => `${t.tx},${t.ty},${t.tz}`).sort()).toEqual(['0,0,0', '2,1,1']);
    const t0 = nbtlib.simplify((await nbtlib.parse(gunzipSync(tiles.find((t) => t.tx === 0)!.data))).parsed);
    expect(t0.size).toEqual([TILE, TILE, TILE]);
    expect(t0.blocks).toHaveLength(2);
    expect(t0.palette.map((p: { Name: string }) => p.Name)).toEqual(['minecraft:stone', 'minecraft:oak_sign']);
    expect(t0.blocks.find((b: { nbt?: unknown }) => b.nbt).nbt.front_text.messages[0]).toBe('src');
    const t1 = nbtlib.simplify((await nbtlib.parse(gunzipSync(tiles.find((t) => t.tx === 2)!.data))).parsed);
    expect(t1.size).toEqual([4, 12, 2]);
  });
});
