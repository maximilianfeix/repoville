import type { BuildingLayout } from '../layout/treemap.js';
import { BLOCKS, type Palette } from './palette.js';
import type { VoxelGrid } from './voxel-grid.js';

export type Face = 'north' | 'south' | 'east' | 'west';

export interface WallCell {
  x: number;
  y: number;
  z: number;
  /** Outward-facing side, used to hang vines. */
  face: Face;
}

export interface Shell {
  walls: WallCell[];
  /** Top of the walls; the roof sits at height + 1. */
  height: number;
  roofY: number;
  hollow: boolean;
}

export type Style = 'tower' | 'lighthouse' | 'library' | 'house';

/** Ground is y = 0; buildings start at y = 1. */
export function buildShell(grid: VoxelGrid, b: BuildingLayout, pal: Palette, style: Style): Shell {
  const { x0, z0, x1, z1 } = b.footprint;
  const w = x1 - x0;
  const d = z1 - z0;
  const H = b.height;
  const hollow = w >= 3 && d >= 3;
  const wall = grid.id(pal.wall);
  const corner = grid.id(pal.corner);
  const glass = grid.id(pal.glass);
  const floor = grid.id(pal.floor);
  const stripeA = grid.id(BLOCKS.lighthouseA);
  const stripeB = grid.id(BLOCKS.lighthouseB);
  const walls: WallCell[] = [];

  for (let y = 1; y <= H; y++) {
    const band = style !== 'house' && y % 4 === 0 && y < H;
    // Lighthouses: white with a red band every 8 levels (tests are common; full stripes were too loud).
    const wallId = style === 'lighthouse' ? (y % 8 === 6 || y % 8 === 7 ? stripeB : stripeA) : wall;
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const ex = x === x0 || x === x1 - 1;
        const ez = z === z0 || z === z1 - 1;
        if (hollow && !ex && !ez) {
          if (y > 1 && (y - 1) % 4 === 0) grid.set(x, y, z, floor);
          continue;
        }
        const isCorner = ex && ez;
        if (isCorner && hollow && style !== 'lighthouse') {
          grid.set(x, y, z, corner);
          continue;
        }
        if (band && hollow && !isCorner) {
          grid.set(x, y, z, glass);
          continue;
        }
        grid.set(x, y, z, wallId);
        if (!isCorner || !hollow) {
          const face: Face = z === z0 ? 'north' : z === z1 - 1 ? 'south' : x === x0 ? 'west' : 'east';
          walls.push({ x, y, z, face });
        }
      }
    }
  }

  // Floor of the ground storey.
  if (hollow) for (let z = z0 + 1; z < z1 - 1; z++) for (let x = x0 + 1; x < x1 - 1; x++) grid.set(x, 0, z, floor);

  // Entrance: a 1x2 opening in the middle of the south wall.
  if (hollow && H >= 3) {
    const ex = x0 + Math.floor(w / 2);
    grid.set(ex, 1, z1 - 1, 0);
    grid.set(ex, 2, z1 - 1, 0);
  }

  const roofY = H + 1;
  const roof = grid.id(pal.roof);
  for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) grid.set(x, roofY, z, roof);

  if (style === 'lighthouse') {
    const bars = grid.id(BLOCKS.ironBars);
    for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {
      const edge = x === x0 || x === x1 - 1 || z === z0 || z === z1 - 1;
      if (edge && hollow) grid.set(x, roofY + 1, z, bars);
    }
    grid.set(x0 + Math.floor(w / 2), roofY + 1, z0 + Math.floor(d / 2), grid.id(BLOCKS.lighthouseLamp));
  }
  if (style === 'library' && hollow) {
    grid.set(x0 + Math.floor(w / 2), 1, z0 + Math.floor(d / 2), grid.id(pal.accent));
  }

  // Interior walls hit by the entrance should not count as wall cells for decoration.
  const filtered = walls.filter((c) => grid.get(c.x, c.y, c.z) !== 0);
  return { walls: filtered, height: H, roofY, hollow };
}
