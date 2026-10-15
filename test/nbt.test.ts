import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import nbtlib from 'prismarine-nbt';
import { describe, expect, it } from 'vitest';
import { VoxelGrid } from '../src/build/voxel-grid.js';
import { encodeToBuffer, modifiedUtf8, nbt } from '../src/write/nbt.js';
import { writeSchem } from '../src/write/schem.js';

async function decode(buf: Buffer) {
  return (await nbtlib.parse(buf)).parsed;
}

describe('nbt encoder', () => {
  it('round-trips through prismarine-nbt', async () => {
    const buf = encodeToBuffer('root', nbt.compound({
      b: nbt.byte(-3), s: nbt.short(40000), i: nbt.int(-7), l: nbt.long(1n << 40n), f: nbt.float(1.5), d: nbt.double(-2.25),
      str: nbt.string('Grüße ☃'), list: nbt.list('int', [nbt.int(1), nbt.int(2)]), empty: nbt.list('compound', []),
      ia: nbt.intArray([1, -1, 3]), la: nbt.longArray([5n, -5n]), ba: nbt.byteArray(Uint8Array.from([1, 255])),
    }));
    const p = await decode(buf);
    expect(p.name).toBe('root');
    const v = nbtlib.simplify(p);
    expect(v.b).toBe(-3);
    expect(v.s).toBe(40000 - 65536);
    expect(v.str).toBe('Grüße ☃');
    expect(v.list).toEqual([1, 2]);
    expect(v.empty).toEqual([]);
    expect(v.ia).toEqual([1, -1, 3]);
    expect(v.ba).toEqual([1, -1]);
  });

  it('encodes NUL and astral characters as modified UTF-8', () => {
    expect([...modifiedUtf8('\0')]).toEqual([0xc0, 0x80]);
    expect(modifiedUtf8('😀').length).toBe(6);
  });

  it('streams large arrays with their declared length', () => {
    const buf = encodeToBuffer('', nbt.compound({
      big: { type: 'stream', of: 'byteArray', length: 5, chunks: () => [Uint8Array.from([1, 2]), Uint8Array.from([3, 4, 5])] },
    }));
    expect(buf.readInt32BE(1 + 2 + 1 + 2 + 3)).toBe(5);
  });
});

describe('writeSchem', () => {
  it('writes a Sponge v3 schematic that decodes to the same blocks', async () => {
    const g = new VoxelGrid(300, 20, 5);
    const stone = g.id('minecraft:stone');
    const slab = g.id('minecraft:oak_slab[type=bottom,waterlogged=false]');
    // Push palette ids past 127 to exercise two-byte varints.
    for (let i = 0; i < 140; i++) g.id(`minecraft:test_${i}`);
    const high = g.id('minecraft:glowstone');
    g.set(0, 0, 0, stone);
    g.set(299, 3, 4, slab);
    g.set(257, 2, 1, high);
    g.blockEntities.push({ x: 1, y: 1, z: 1, id: 'minecraft:sign', kind: 'sign', lines: ['src', 'auth'] });
    const dir = mkdtempSync(join(tmpdir(), 'rv-'));
    const file = join(dir, 'a.schem');
    await writeSchem(file, g, { name: 'test', author: 'repoville', date: 1700000000000, dataVersion: 4671 });
    const root = nbtlib.simplify(await decode(gunzipSync(readFileSync(file))));
    const s = root.Schematic;
    expect(s.Version).toBe(3);
    expect(s.DataVersion).toBe(4671);
    expect([s.Width, s.Height, s.Length]).toEqual([300, 16, 5]);
    expect(s.Blocks.Palette['minecraft:glowstone']).toBe(high);
    // Decode varints.
    const data: number[] = s.Blocks.Data.map((b: number) => b & 0xff);
    const ids: number[] = [];
    for (let i = 0; i < data.length; ) {
      let v = 0, shift = 0, b;
      do { b = data[i++]!; v |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80);
      ids.push(v);
    }
    expect(ids.length).toBe(300 * 16 * 5);
    const at = (x: number, y: number, z: number) => ids[x + z * 300 + y * 300 * 5];
    expect(at(0, 0, 0)).toBe(stone);
    expect(at(299, 3, 4)).toBe(slab);
    expect(at(257, 2, 1)).toBe(high);
    expect(ids.filter((v) => v !== 0).length).toBe(3);
    expect(s.Blocks.BlockEntities[0].Id).toBe('minecraft:sign');
    expect(s.Blocks.BlockEntities[0].Data.front_text.messages[0]).toBe('src');
  });
});
