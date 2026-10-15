import { describe, expect, it } from 'vitest';
import { analyze } from '../src/analyze.js';
import { buildCity } from '../src/build/city.js';
import { churnThresholds, fireLevel, ruinShare } from '../src/build/decorators.js';
import { layoutCity } from '../src/layout/treemap.js';
import type { FileNode } from '../src/model/city.js';
import { fixture } from './helpers.js';

const f = (churn: number, extra: Partial<FileNode> = {}): FileNode => ({
  kind: 'file', name: 'a', path: 'a', lang: 'typescript', loc: 100, todos: 0, churn, lastTouched: 0, isTest: false, isDoc: false, ...extra,
});

describe('decorator rules', () => {
  it('derives churn thresholds from files with churn', () => {
    const files = Array.from({ length: 100 }, (_, i) => f(i + 1));
    expect(churnThresholds(files)).toEqual({ p90: 90, p98: 98 });
    const t = churnThresholds(files);
    expect(fireLevel(99, t)).toBe(2);
    expect(fireLevel(95, t)).toBe(1);
    expect(fireLevel(10, t)).toBe(0);
  });

  it('needs a minimum number of commits before anything burns', () => {
    const t = churnThresholds([f(1), f(1), f(2)]);
    expect(fireLevel(2, t)).toBe(0);
  });

  it('turns TODO density into the same share of ruined wall, capped', () => {
    expect(ruinShare(f(0, { loc: 200, todos: 4 }))).toBeCloseTo(0.02);
    expect(ruinShare(f(0, { loc: 2, todos: 9 }))).toBe(0.6);
    expect(ruinShare(f(0, { loc: 0, todos: 0 }))).toBe(0);
  });
});

describe('buildCity on the town fixture', async () => {
  const city = await analyze(fixture('town'), { sinceDays: 365 });
  const layout = layoutCity(city);
  const built = buildCity(city, layout, { seed: 1 });
  const fact = (p: string) => built.buildings.find((b) => b.path === p)!;

  it('raises a building per file with the LOC height rule', () => {
    expect(built.buildings).toHaveLength(city.stats.files);
    const idx = fact('src/index.ts');
    expect(idx.height).toBe(4 + Math.round(4 * Math.sqrt(121 / 10)));
    const g = built.grid;
    // A mid-rise: trim corners up to the LOC height, a roof deck above, then a parapet.
    expect(idx.style).toBe('midrise');
    expect(g.state(idx.x0, idx.height, idx.z0)).toBe('minecraft:stripped_oak_log[axis=y]');
    expect(g.state(idx.x0, idx.height + 1, idx.z0)).toBe('minecraft:oak_planks');
    expect(g.state(idx.x0, idx.height + 2, idx.z0)).toBe('minecraft:stripped_oak_log[axis=y]');
    expect(g.state(idx.x0, idx.height + 3, idx.z0)).toBe('minecraft:air');
  });

  it('sets the hottest file on fire and leaves cold files alone', () => {
    expect(fact('src/hot.ts').fire).toBe(2);
    expect(fact('src/index.ts').fire).toBe(0);
    const g = built.grid;
    const hot = fact('src/hot.ts');
    let soul = 0;
    for (let x = hot.x0; x < hot.x1; x++) for (let z = hot.z0; z < hot.z1; z++) if (g.state(x, hot.height + 2, z) === 'minecraft:soul_fire') soul++;
    expect(soul).toBeGreaterThan(0);
  });

  it('marks old files mossy, recent ones not', () => {
    expect(fact('src/util/old.py').mossy).toBe(true);
    expect(fact('src/hot.ts').mossy).toBe(false);
    expect(fact('src/util/old.py').biome).toBe('jungle');
  });

  it('uses lighthouses for tests and libraries for docs', () => {
    expect(fact('test/index.test.ts').style).toBe('lighthouse');
    expect(fact('docs/guide.md').style).toBe('library');
  });

  it('ruins walls proportional to TODO density', () => {
    expect(fact('src/ruins.ts').ruinShare).toBeCloseTo(4 / 34);
  });

  it('is deterministic for a given seed', () => {
    const again = buildCity(city, layoutCity(city), { seed: 1 });
    expect(again.grid.palette).toEqual(built.grid.palette);
    expect(Array.from(again.grid.counts())).toEqual(Array.from(built.grid.counts()));
  });
});
