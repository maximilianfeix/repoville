import type { BuildingLayout } from '../layout/treemap.js';
import type { FileNode } from '../model/city.js';
import type { Shell, WallCell } from './building.js';
import { BLOCKS, vine, type Palette } from './palette.js';
import type { VoxelGrid } from './voxel-grid.js';

export interface ChurnThresholds {
  p90: number;
  p98: number;
}

export const HOT_MIN_COMMITS = 3;
export const BLAZING_MIN_COMMITS = 10;
export const MOSS_AFTER_DAYS = 365;
export const MOSS_SHARE = 0.3;
export const RUIN_CAP = 0.6;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return Infinity;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}

export function churnThresholds(files: Iterable<FileNode>): ChurnThresholds {
  const values = [...files].map((f) => f.churn).filter((c) => c > 0).sort((a, b) => a - b);
  return { p90: percentile(values, 0.9), p98: percentile(values, 0.98) };
}

/** 0 = no fire, 1 = campfires (>= p90), 2 = soul fire (>= p98). */
export function fireLevel(churn: number, t: ChurnThresholds): 0 | 1 | 2 {
  if (churn >= t.p98 && churn >= BLAZING_MIN_COMMITS) return 2;
  if (churn >= t.p90 && churn >= HOT_MIN_COMMITS) return 1;
  return 0;
}

export function isMossy(file: FileNode, headTime: number): boolean {
  if (file.lastTouched === null) return true;
  return headTime - file.lastTouched > MOSS_AFTER_DAYS * 86400;
}

/** TODO density as a share of lines; the same share of wall blocks turns to ruins. */
export function ruinShare(file: FileNode): number {
  if (file.todos <= 0 || file.loc <= 0) return 0;
  return Math.min(RUIN_CAP, file.todos / file.loc);
}

export function addFire(grid: VoxelGrid, b: BuildingLayout, shell: Shell, level: 0 | 1 | 2, rng: () => number): void {
  if (level === 0) return;
  const { x0, z0, x1, z1 } = b.footprint;
  const area = (x1 - x0) * (z1 - z0);
  const campfire = grid.id(BLOCKS.campfire);
  const count = Math.max(1, Math.min(6, Math.round(area / 20)));
  for (let i = 0; i < count; i++) {
    const x = x0 + Math.floor(rng() * (x1 - x0));
    const z = z0 + Math.floor(rng() * (z1 - z0));
    grid.set(x, shell.roofY, z, campfire);
  }
  if (level === 2) {
    const cx = x0 + Math.floor((x1 - x0) / 2);
    const cz = z0 + Math.floor((z1 - z0) / 2);
    const sand = grid.id(BLOCKS.soulSand);
    const fire = grid.id(BLOCKS.soulFire);
    for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]] as const) {
      const x = cx + dx;
      const z = cz + dz;
      if (x < x0 || z < z0) continue;
      grid.set(x, shell.roofY, z, sand);
      grid.set(x, shell.roofY + 1, z, fire);
    }
  }
}

export function addMoss(grid: VoxelGrid, shell: Shell, pal: Palette, rng: () => number): number {
  const mossy = grid.id(pal.mossyWall);
  let n = 0;
  for (const c of shell.walls) {
    if (rng() < MOSS_SHARE) {
      grid.set(c.x, c.y, c.z, mossy);
      n++;
    }
  }
  // Vines on 30% of outward faces, hanging down from the top of the wall.
  const tops = shell.walls.filter((c) => c.y === shell.height);
  for (const c of tops) {
    if (rng() >= MOSS_SHARE) continue;
    const [vx, vz] = outside(c);
    const len = 2 + Math.floor(rng() * Math.max(1, shell.height / 2));
    const state = grid.id(vine(attachSide(c.face)));
    for (let y = c.y; y > Math.max(0, c.y - len); y--) {
      if (grid.get(vx, y, vz) !== 0) break;
      grid.set(vx, y, vz, state);
    }
  }
  return n;
}

export function addRuins(grid: VoxelGrid, shell: Shell, share: number, rng: () => number): number {
  if (share <= 0) return 0;
  const cracked = grid.id(BLOCKS.cracked);
  const web = grid.id(BLOCKS.cobweb);
  let n = 0;
  for (const c of shell.walls) {
    if (rng() < share) {
      grid.set(c.x, c.y, c.z, rng() < 0.75 ? cracked : web);
      n++;
    }
  }
  return n;
}

function outside(c: WallCell): [number, number] {
  switch (c.face) {
    case 'north': return [c.x, c.z - 1];
    case 'south': return [c.x, c.z + 1];
    case 'west': return [c.x - 1, c.z];
    case 'east': return [c.x + 1, c.z];
  }
}

/** A vine outside a north wall hangs on the block to its south, and so on. */
function attachSide(face: WallCell['face']): 'north' | 'south' | 'east' | 'west' {
  return ({ north: 'south', south: 'north', west: 'east', east: 'west' } as const)[face];
}
