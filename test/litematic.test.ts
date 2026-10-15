import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VoxelGrid } from '../src/build/voxel-grid.js';
import { BitPacker, bitsFor, longCount, writeLitematic } from '../src/write/litematic.js';

const vectors: Array<{ nbits: number; values: number[]; longs: string[] }> = JSON.parse(
  readFileSync(join(import.meta.dirname, 'golden', 'litematica-bitarray.json'), 'utf8'),
);

function unpackLongs(chunks: Uint8Array[]): bigint[] {
  const all = Buffer.concat(chunks);
  const out: bigint[] = [];
  for (let i = 0; i < all.length; i += 8) out.push(all.readBigInt64BE(i));
  return out;
}

describe('BitPacker', () => {
  it.each(vectors.map((v) => [v.nbits, v] as const))('matches litemapy for %i bits', (_n, v) => {
    const p = new BitPacker(v.nbits, 16);
    for (const x of v.values) p.put(x);
    const longs = unpackLongs(p.finish());
    expect(longs.length).toBe(longCount(v.values.length, v.nbits));
    expect(longs.map(String)).toEqual(v.longs);
  });

  it('uses at least two bits per entry', () => {
    expect(bitsFor(1)).toBe(2);
    expect(bitsFor(4)).toBe(2);
    expect(bitsFor(5)).toBe(3);
    expect(bitsFor(300)).toBe(9);
  });
});

const PY = join(import.meta.dirname, '..', '.cache', 'py', 'bin', 'python');
const haveLitemapy = existsSync(PY) || Boolean(process.env.LITEMAPY_PYTHON);

describe.skipIf(!haveLitemapy)('litemapy round-trip', () => {
  it('reads back our litematic block for block', async () => {
    const g = new VoxelGrid(37, 20, 23);
    const states = ['minecraft:stone', 'minecraft:oak_slab[type=bottom,waterlogged=false]', 'minecraft:glass', 'minecraft:oak_log[axis=y]', 'minecraft:campfire[facing=north,lit=true,signal_fire=false,waterlogged=false]'];
    let k = 0;
    for (let y = 0; y < 20; y++) for (let z = 0; z < 23; z++) for (let x = 0; x < 37; x++) if ((x * 7 + y * 3 + z * 5) % 4 === 0) g.setState(x, y, z, states[k++ % states.length]!);
    const dir = mkdtempSync(join(tmpdir(), 'rv-lm-'));
    const file = join(dir, 'a.litematic');
    await writeLitematic(file, g, { name: 'test', author: 'repoville', date: 1700000000000, dataVersion: 4671 });
    const script = `
import sys, json
from litemapy import Schematic
s = Schematic.load(sys.argv[1])
r = list(s.regions.values())[0]
out = []
for x in range(r.width):
  for y in range(r.height):
    for z in range(r.length):
      b = r[x, y, z]
      if b.id != 'minecraft:air':
        props = ','.join(f'{k}={v}' for k, v in sorted(b.properties()))
        out.append([x, y, z, b.id + (f'[{props}]' if props else '')])
print(json.dumps({'v': s.lm_version, 'mc': s.mc_version, 'size': [r.width, r.height, r.length], 'blocks': out}))
`;
    const res = JSON.parse(execFileSync(process.env.LITEMAPY_PYTHON ?? PY, ['-c', script, file]).toString());
    expect(res.v).toBe(6);
    expect(res.mc).toBe(4671);
    expect(res.size).toEqual([37, 20, 23]);
    const expected: Array<[number, number, number, string]> = [];
    for (let x = 0; x < 37; x++) for (let y = 0; y < 20; y++) for (let z = 0; z < 23; z++) {
      const id = g.get(x, y, z);
      if (id) expected.push([x, y, z, g.palette[id]!]);
    }
    expect(res.blocks).toEqual(expected);
  });
});
