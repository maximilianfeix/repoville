import type { VoxelGrid } from './voxel-grid.js';

/**
 * Applies the block-state rules the game re-derives on block updates, so a
 * WorldEdit paste or a live build keeps exactly the states we wrote:
 * stair shapes (inner/outer corners) and leaf `distance` to the nearest log.
 * A world file loads without updates, but should match the game too.
 */
export function settle(grid: VoxelGrid): void {
  settleStairs(grid);
  settleLeaves(grid);
  settleGrass(grid);
}

// Blocks grass survives under (light passes); anything else, water included, turns it to dirt on a random tick.
const LETS_LIGHT = /^minecraft:(air|[a-z_]*glass[a-z_]*|[a-z_]+_leaves|[a-z_]+_slab\[type=top|[a-z_]+_stairs\[facing=[a-z]+,half=top|[a-z_]+_fence|[a-z_]+_fence_gate|iron_bars|[a-z_]*lantern|[a-z_]+_sign|[a-z_]*torch|poppy|dandelion|[a-z_]+_tulip|short_grass|tall_grass|fern|campfire|soul_campfire|lightning_rod|vine|cobweb|[a-z_]+_carpet|scaffolding|snow|[a-z_]+_button|lever|chain|end_rod|flower_pot|[a-z_]+_trapdoor|[a-z_]+_door|ladder|bell)([[,]|$)/;

/** Grass under an opaque block or water becomes dirt in game; write dirt so every export matches. */
function settleGrass(grid: VoxelGrid): void {
  const grass = new Set<number>();
  grid.palette.forEach((st, i) => { if (st.startsWith('minecraft:grass_block')) grass.add(i); });
  if (!grass.size) return;
  const dark = new Map<number, boolean>();
  const blocks = (id: number) => {
    if (!dark.has(id)) dark.set(id, id !== 0 && !LETS_LIGHT.test(grid.palette[id]!));
    return dark.get(id)!;
  };
  const dirt: Array<[number, number, number]> = [];
  grid.each((id) => grass.has(id), (x, y, z) => { if (blocks(grid.get(x, y + 1, z))) dirt.push([x, y, z]); });
  for (const [x, y, z] of dirt) grid.setState(x, y, z, 'minecraft:dirt');
}

type Dir = 'north' | 'south' | 'east' | 'west';
const STEP: Record<Dir, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
const CCW: Record<Dir, Dir> = { north: 'west', west: 'south', south: 'east', east: 'north' };
const OPP: Record<Dir, Dir> = { north: 'south', south: 'north', east: 'west', west: 'east' };
const axis = (d: Dir) => (d === 'north' || d === 'south' ? 'z' : 'x');

const STAIRS = /^(minecraft:[a-z_]+_stairs)\[facing=(north|south|east|west),half=(top|bottom),shape=[a-z_]+,waterlogged=(true|false)\]$/;

interface Stair { name: string; facing: Dir; half: string; wl: string }

/** Vanilla StairBlock.getStairsShape, evaluated for every stair in the grid. */
function settleStairs(grid: VoxelGrid): void {
  const parsed = new Map<number, Stair | null>();
  const info = (id: number): Stair | null => {
    if (!parsed.has(id)) {
      const m = STAIRS.exec(grid.palette[id]!);
      parsed.set(id, m ? { name: m[1]!, facing: m[2] as Dir, half: m[3]!, wl: m[4]! } : null);
    }
    return parsed.get(id)!;
  };
  const cells: Array<[number, number, number, number]> = [];
  grid.each((id) => info(id) !== null, (x, y, z, id) => cells.push([x, y, z, id]));
  const at = (x: number, y: number, z: number) => {
    const id = grid.get(x, y, z);
    return id ? info(id) : null;
  };
  // Shapes depend only on neighbours' facing/half, which this pass never changes, so order is irrelevant.
  const updates: Array<[number, number, number, string]> = [];
  for (const [x, y, z, id] of cells) {
    const s = info(id)!;
    const near = (d: Dir) => at(x + STEP[d][0], y, z + STEP[d][1]);
    const canTake = (d: Dir) => {
      const b = near(d);
      return !b || b.facing !== s.facing || b.half !== s.half;
    };
    let shape = 'straight';
    const front = near(s.facing);
    if (front && front.half === s.half && axis(front.facing) !== axis(s.facing) && canTake(OPP[front.facing])) {
      shape = front.facing === CCW[s.facing] ? 'outer_left' : 'outer_right';
    } else {
      const back = near(OPP[s.facing]);
      if (back && back.half === s.half && axis(back.facing) !== axis(s.facing) && canTake(back.facing)) {
        shape = back.facing === CCW[s.facing] ? 'inner_left' : 'inner_right';
      }
    }
    const state = `${s.name}[facing=${s.facing},half=${s.half},shape=${shape},waterlogged=${s.wl}]`;
    if (state !== grid.palette[id]) updates.push([x, y, z, state]);
  }
  for (const [x, y, z, st] of updates) grid.setState(x, y, z, st);
}

const LEAVES = /^(minecraft:[a-z_]+_leaves)\[distance=\d,persistent=(true|false),waterlogged=(true|false)\]$/;
const LOG = /^minecraft:(stripped_)?[a-z_]+_(log|wood|stem|hyphae)(\[|$)/;
const N: Array<[number, number, number]> = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

/** Leaf distance: 1 next to a log, +1 per leaf step, 7 when no log is within 6 steps. */
function settleLeaves(grid: VoxelGrid): void {
  const leafIds = new Set<number>();
  const logIds = new Set<number>();
  grid.palette.forEach((s, i) => {
    if (LEAVES.test(s)) leafIds.add(i);
    else if (LOG.test(s)) logIds.add(i);
  });
  if (!leafIds.size) return;
  const W = grid.width, L = grid.length;
  const key = (x: number, y: number, z: number) => (y * L + z) * W + x;
  const dist = new Map<number, number>();
  const cells: Array<[number, number, number, number]> = [];
  grid.each((id) => leafIds.has(id), (x, y, z, id) => {
    cells.push([x, y, z, id]);
    dist.set(key(x, y, z), 7);
  });
  let frontier: Array<[number, number, number]> = [];
  for (const [x, y, z] of cells) {
    if (N.some(([dx, dy, dz]) => logIds.has(grid.get(x + dx, y + dy, z + dz)))) {
      dist.set(key(x, y, z), 1);
      frontier.push([x, y, z]);
    }
  }
  for (let d = 2; d <= 6 && frontier.length; d++) {
    const next: Array<[number, number, number]> = [];
    for (const [x, y, z] of frontier) {
      for (const [dx, dy, dz] of N) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (!grid.inside(nx, ny, nz)) continue;
        const k = key(nx, ny, nz);
        const cur = dist.get(k);
        if (cur !== undefined && cur > d) {
          dist.set(k, d);
          next.push([nx, ny, nz]);
        }
      }
    }
    frontier = next;
  }
  for (const [x, y, z, id] of cells) {
    const m = LEAVES.exec(grid.palette[id]!)!;
    const state = `${m[1]}[distance=${dist.get(key(x, y, z))},persistent=${m[2]},waterlogged=${m[3]}]`;
    if (state !== grid.palette[id]) grid.setState(x, y, z, state);
  }
}
