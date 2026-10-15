import type { VoxelGrid } from '../../src/build/voxel-grid.js';
import type { Expect } from './server.js';

/** Deterministic sample of non-air blocks plus every block of the listed states, translated to world coords. */
export function sampleBlocks(grid: VoxelGrid, origin: [number, number, number], count: number, mustInclude: string[] = []): Expect[] {
  const out: Expect[] = [];
  const want = new Set(mustInclude);
  let seen = 0;
  const top = grid.topY();
  const total: Array<[number, number, number, string]> = [];
  for (let y = 0; y < top; y++) for (let z = 0; z < grid.length; z++) for (let x = 0; x < grid.width; x++) {
    const id = grid.get(x, y, z);
    if (!id) continue;
    const s = grid.palette[id]!;
    total.push([x, y, z, s]);
    if (want.has(s)) {
      want.delete(s);
      out.push({ x: x + origin[0], y: y + origin[1], z: z + origin[2], block: s });
    }
    seen++;
  }
  const stride = Math.max(1, Math.floor(total.length / count));
  for (let i = 0; i < total.length; i += stride) {
    const [x, y, z, s] = total[i]!;
    out.push({ x: x + origin[0], y: y + origin[1], z: z + origin[2], block: s });
  }
  if (want.size) throw new Error(`grid has none of: ${[...want].join(', ')}`);
  void seen;
  return out;
}
