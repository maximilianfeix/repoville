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

/** Highest solid y in a column at or below `fromY`, or -1. */
function surface(grid: VoxelGrid, x: number, z: number, fromY: number): number {
  for (let y = Math.min(fromY, grid.height - 1); y >= 0; y--) if (grid.get(x, y, z) !== 0) return y;
  return -1;
}

/** Campfires (and soul fire for the hottest) on the roof surface, wherever the roof shape puts it. */
export function addFire(grid: VoxelGrid, b: BuildingLayout, shell: Shell, level: 0 | 1 | 2, rng: () => number): void {
  if (level === 0) return;
  const { x0, z0, x1, z1 } = b.footprint;
  const area = (x1 - x0) * (z1 - z0);
  const campfire = grid.id(BLOCKS.campfire);
  const count = Math.max(1, Math.min(6, Math.round(area / 20)));
  for (let i = 0; i < count; i++) {
    const x = x0 + Math.floor(rng() * (x1 - x0));
    const z = z0 + Math.floor(rng() * (z1 - z0));
    const top = surface(grid, x, z, shell.topY);
    if (top >= 0 && top + 1 < grid.height) grid.set(x, top + 1, z, campfire);
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
      const top = surface(grid, x, z, shell.topY + 1);
      if (top < 0 || top + 1 >= grid.height) continue;
      grid.set(x, top, z, sand);
      grid.set(x, top + 1, z, fire);
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
  // Vines on 30% of outward faces, hanging down from the top wall block of each column.
  const topOf = new Map<string, WallCell>();
  for (const c of shell.walls) {
    const k = `${c.x},${c.z},${c.face}`;
    const prev = topOf.get(k);
    if (!prev || c.y > prev.y) topOf.set(k, c);
  }
  const tops = [...topOf.values()];
  for (const c of tops) {
    if (rng() >= MOSS_SHARE) continue;
    const [vx, vz] = outside(c);
    const len = 2 + Math.floor(rng() * Math.max(1, c.y / 2));
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

/** Widest carriageway (in blocks across) that still counts as a street rather than a junction. */
const STREET_MAX_WIDTH = 4;

/**
 * Zebra crossings where a narrow street opens into a junction. Works on the
 * ground layer only: `carriageway` marks drivable road cells (any street
 * class), `paintable` the ones that may receive stripes. Stripes run along
 * the street and alternate across it, two blocks deep at each junction mouth.
 */
export function addCrosswalks(
  grid: VoxelGrid,
  carriageway: (x: number, z: number) => boolean,
  paintable: (x: number, z: number) => boolean,
  stripe: number,
): number {
  const W = grid.width, L = grid.length;
  const spanX = new Uint16Array(W * L);
  const spanZ = new Uint16Array(W * L);
  for (let z = 0; z < L; z++) {
    for (let x = 0; x < W;) {
      if (!carriageway(x, z)) { x++; continue; }
      let e = x;
      while (e < W && carriageway(e, z)) e++;
      for (let i = x; i < e; i++) spanX[z * W + i] = Math.min(e - x, 0xffff);
      x = e;
    }
  }
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < L;) {
      if (!carriageway(x, z)) { z++; continue; }
      let e = z;
      while (e < L && carriageway(x, e)) e++;
      for (let i = z; i < e; i++) spanZ[i * W + x] = Math.min(e - z, 0xffff);
      z = e;
    }
  }
  const sx = (x: number, z: number) => (x < 0 || z < 0 || x >= W || z >= L ? 0 : spanX[z * W + x]!);
  const sz = (x: number, z: number) => (x < 0 || z < 0 || x >= W || z >= L ? 0 : spanZ[z * W + x]!);
  const paint: number[] = [];
  // Each axis in turn: `u` runs along the street, `v` across it.
  for (const alongXAxis of [true, false]) {
    const at = (u: number, v: number): [number, number] => (alongXAxis ? [u, v] : [v, u]);
    const lenU = (u: number, v: number) => (alongXAxis ? sx(u, v) : sz(v, u));
    const lenV = (u: number, v: number) => (alongXAxis ? sz(u, v) : sx(v, u));
    const road = (u: number, v: number) => carriageway(...at(u, v));
    const street = (u: number, v: number, w: number) => lenV(u, v) === w && lenU(u, v) >= 8;
    const U = alongXAxis ? W : L, V = alongXAxis ? L : W;
    for (let v = 0; v < V; v++) {
      for (let u = 0; u < U; u++) {
        // Start at the kerb: the first carriageway cell of a cross-section.
        if (!road(u, v) || road(u, v - 1)) continue;
        const w = lenV(u, v);
        if (w < 2 || w > STREET_MAX_WIDTH) continue;
        const section = (ok: (k: number) => boolean) => {
          for (let k = 0; k < w; k++) if (!ok(k)) return false;
          return true;
        };
        const isStreet = (cu: number) => section((k) => street(cu, v + k, w));
        if (!isStreet(u) || !section((k) => paintable(...at(u, v + k)))) continue;
        // A junction mouth: within two rows the street stops being straight, and
        // within three blocks past that some cross-span opens well beyond the
        // street's width (corner bevels and dead ends do not count).
        const opens = (cu: number) => !section((k) => lenV(cu, v + k) < w + 4);
        const mouth = [1, -1].some((d) => {
          for (let j = 1; j <= 2; j++) if (!isStreet(u + j * d)) return opens(u + j * d) || opens(u + (j + 1) * d) || opens(u + (j + 2) * d);
          return false;
        });
        if (!mouth) continue;
        for (let k = 0; k < w; k += 2) paint.push(...at(u, v + k));
      }
    }
  }
  // Paint after scanning so every test above saw the unpainted road.
  for (let i = 0; i < paint.length; i += 2) grid.set(paint[i]!, 0, paint[i + 1]!, stripe);
  return paint.length / 2;
}
