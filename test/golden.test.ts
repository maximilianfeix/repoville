import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DEFAULTS } from '../src/config.js';
import { render } from '../src/render.js';
import { fixture } from './helpers.js';

const GOLDEN = join(import.meta.dirname, 'golden', 'town.json');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function snapshot() {
  const out = mkdtempSync(join(tmpdir(), 'rv-golden-'));
  const res = await render({ dir: fixture('town'), name: 'town', remote: false }, { ...DEFAULTS, out, formats: ['schem', 'litematic'], seed: 0 });
  const file = (f: string) => res.outputs.find((o) => o.format === f)!.file;
  const g = res.built.grid;
  const counts = g.counts();
  return {
    schemNbtSha256: sha(gunzipSync(readFileSync(file('schem')))),
    litematicNbtSha256: sha(gunzipSync(readFileSync(file('litematic')))),
    summary: {
      dimensions: [g.width, g.topY(), g.length],
      buildings: res.built.buildings.length,
      palette: g.palette,
      blockCounts: Object.fromEntries(g.palette.map((s, i) => [s, counts[i]!]).filter(([, n]) => (n as number) > 0)),
      fire: res.built.buildings.filter((b) => b.fire).map((b) => `${b.path}:${b.fire}`),
      mossy: res.built.buildings.filter((b) => b.mossy).map((b) => b.path),
    },
  };
}

describe('golden snapshots (town fixture)', () => {
  it('produces byte-identical decoded NBT and the recorded summary', async () => {
    const snap = await snapshot();
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(snap, null, 2) + '\n');
    const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
    expect(snap.summary).toEqual(golden.summary);
    expect(snap.schemNbtSha256).toBe(golden.schemNbtSha256);
    expect(snap.litematicNbtSha256).toBe(golden.litematicNbtSha256);
  });

  it('is stable across two runs in one process', async () => {
    const a = await snapshot();
    const b = await snapshot();
    expect(a).toEqual(b);
  });
});
