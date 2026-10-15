import { describe, expect, it } from 'vitest';
import { gunzipSync, inflateSync } from 'node:zlib';
import nbtlib from 'prismarine-nbt';
import { VoxelGrid } from '../src/build/voxel-grid.js';
import { buildWorldFiles, packSection } from '../src/write/world.js';

describe('world export', () => {
  it('packs section indices without spanning longs', () => {
    const idx = new Uint16Array(4096);
    idx[0] = 1; idx[1] = 2; idx[15] = 3; idx[16] = 5;
    const longs = packSection(idx, 4); // 16 entries per long
    expect(longs.length).toBe(256);
    expect(Number(longs[0]! & 0xfn)).toBe(1);
    expect(Number((longs[0]! >> 4n) & 0xfn)).toBe(2);
    expect(Number(BigInt.asUintN(64, longs[0]!) >> 60n)).toBe(3);
    expect(Number(longs[1]! & 0xfn)).toBe(5);
    expect(packSection(idx, 5).length).toBe(Math.ceil(4096 / 12));
  });

  it('writes level.dat and region chunks that decode with the city blocks', async () => {
    const g = new VoxelGrid(20, 8, 18);
    g.setState(3, 0, 4, 'minecraft:stone_bricks');
    g.setState(17, 5, 17, 'minecraft:oak_slab[type=bottom,waterlogged=false]');
    const files = buildWorldFiles(g, { name: 'test', dataVersion: 4671, mcVersion: '1.21.11', date: 1_700_000_000_000 });
    expect(Object.keys(files).sort()).toEqual(['test/level.dat', 'test/region/r.0.0.mca']);
    const level = nbtlib.simplify((await nbtlib.parse(gunzipSync(files['test/level.dat']!))).parsed);
    expect(level.Data.DataVersion).toBe(4671);
    expect(level.Data.WorldGenSettings.dimensions['minecraft:overworld'].generator.type).toBe('minecraft:flat');
    const mca = Buffer.from(files['test/region/r.0.0.mca']!);
    // Chunk (1,1) holds block (17, y, 17).
    const loc = mca.readUInt32BE((1 + 1 * 32) * 4);
    const offset = (loc >>> 8) * 4096;
    const len = mca.readUInt32BE(offset);
    const chunk = nbtlib.simplify((await nbtlib.parse(inflateSync(mca.subarray(offset + 5, offset + 4 + len)))).parsed);
    expect([chunk.xPos, chunk.zPos, chunk.Status]).toEqual([1, 1, 'minecraft:full']);
    const names = chunk.sections.flatMap((s: { block_states: { palette: Array<{ Name: string }> } }) => s.block_states.palette.map((p) => p.Name));
    expect(names).toContain('minecraft:oak_slab');
    expect(names).toContain('minecraft:bedrock');
  });

  it('is deterministic', () => {
    const g = new VoxelGrid(10, 4, 10);
    g.setState(1, 1, 1, 'minecraft:stone');
    const meta = { name: 'd', dataVersion: 4671, mcVersion: '1.21.11', date: 0 };
    const a = buildWorldFiles(g, meta);
    const b = buildWorldFiles(g, meta);
    for (const k of Object.keys(a)) expect(Buffer.compare(Buffer.from(a[k]!), Buffer.from(b[k]!))).toBe(0);
  });
});
