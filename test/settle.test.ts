import { describe, expect, it } from 'vitest';
import { settle } from '../src/build/settle.js';
import { VoxelGrid } from '../src/build/voxel-grid.js';

const stair = (facing: string, shape = 'straight') => `minecraft:oak_stairs[facing=${facing},half=bottom,shape=${shape},waterlogged=false]`;
const leaf = (d: number) => `minecraft:oak_leaves[distance=${d},persistent=true,waterlogged=false]`;

describe('settle', () => {
  it('gives hip-roof corners the shapes the game derives', () => {
    // A ring of stairs facing outward-in, like the eaves of a hip roof (north row faces south, etc.).
    const g = new VoxelGrid(5, 2, 5);
    for (let x = 0; x < 5; x++) {
      g.setState(x, 0, 0, stair('south'));
      g.setState(x, 0, 4, stair('north'));
    }
    for (let z = 1; z < 4; z++) {
      g.setState(0, 0, z, stair('east'));
      g.setState(4, 0, z, stair('west'));
    }
    settle(g);
    expect(g.state(2, 0, 0)).toBe(stair('south'));
    expect(g.state(0, 0, 0)).toBe(stair('south', 'outer_left'));
    expect(g.state(4, 0, 0)).toBe(stair('south', 'outer_right'));
    expect(g.state(0, 0, 2)).toBe(stair('east'));
  });

  it('turns a stair into an inner corner when the one behind it is perpendicular', () => {
    const g = new VoxelGrid(3, 1, 3);
    g.setState(1, 0, 1, stair('north'));
    g.setState(1, 0, 2, stair('east')); // behind (south of) a north-facing stair
    settle(g);
    expect(g.state(1, 0, 1)).toBe(stair('north', 'inner_right'));
  });

  it('sets leaf distance from the nearest log, 7 when there is none', () => {
    const g = new VoxelGrid(12, 1, 1);
    g.setState(0, 0, 0, 'minecraft:oak_log[axis=y]');
    for (let x = 1; x < 12; x++) g.setState(x, 0, 0, leaf(1));
    settle(g);
    expect([1, 2, 6, 7, 11].map((x) => g.state(x, 0, 0))).toEqual([leaf(1), leaf(2), leaf(6), leaf(7), leaf(7)]);
  });
});

describe('settle grass', () => {
  it('turns grass under solid blocks and water into dirt, keeps it under glass and top slabs', () => {
    const g = new VoxelGrid(4, 2, 1);
    for (let x = 0; x < 4; x++) g.setState(x, 0, 0, 'minecraft:grass_block[snowy=false]');
    g.setState(0, 1, 0, 'minecraft:oak_planks');
    g.setState(1, 1, 0, 'minecraft:water[level=0]');
    g.setState(2, 1, 0, 'minecraft:glass');
    g.setState(3, 1, 0, 'minecraft:oak_slab[type=top,waterlogged=false]');
    const h = new VoxelGrid(1, 2, 1);
    h.setState(0, 0, 0, 'minecraft:grass_block[snowy=false]');
    h.setState(0, 1, 0, 'minecraft:oak_slab[type=bottom,waterlogged=false]');
    settle(g);
    settle(h);
    expect([0, 1, 2, 3].map((x) => g.state(x, 0, 0))).toEqual(['minecraft:dirt', 'minecraft:dirt', 'minecraft:grass_block[snowy=false]', 'minecraft:grass_block[snowy=false]']);
    expect(h.state(0, 0, 0)).toBe('minecraft:dirt');
  });
});
