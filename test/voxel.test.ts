import { describe, expect, it } from 'vitest';
import { VoxelGrid } from '../src/build/voxel-grid.js';
import { fnv1a, mulberry32 } from '../src/build/rng.js';

describe('VoxelGrid', () => {
  it('stores blocks across tile and section boundaries', () => {
    const g = new VoxelGrid(600, 40, 300);
    const stone = g.id('minecraft:stone');
    g.set(0, 0, 0, stone);
    g.set(255, 15, 255, stone);
    g.set(256, 16, 256, stone);
    g.set(599, 39, 299, stone);
    expect(g.get(0, 0, 0)).toBe(stone);
    expect(g.get(256, 16, 256)).toBe(stone);
    expect(g.get(599, 39, 299)).toBe(stone);
    expect(g.get(1, 0, 0)).toBe(0);
    expect(g.get(600, 0, 0)).toBe(0);
    const row = new Uint16Array(600);
    g.row(39, 299, row);
    expect(row[599]).toBe(stone);
    expect(row.reduce((a, b) => a + b, 0)).toBe(stone);
    expect(g.counts()[stone]).toBe(4);
  });

  it('keeps air id 0 and dedupes states', () => {
    const g = new VoxelGrid(2, 2, 2);
    expect(g.id('minecraft:air')).toBe(0);
    expect(g.id('minecraft:dirt')).toBe(g.id('minecraft:dirt'));
    expect(g.palette).toEqual(['minecraft:air', 'minecraft:dirt']);
  });
});

describe('rng', () => {
  it('is deterministic and matches known FNV-1a values', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
