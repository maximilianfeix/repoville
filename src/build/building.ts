import type { BuildingLayout, Rect } from '../layout/treemap.js';
import { BLOCKS, stairs, type Facing, type Palette } from './palette.js';
import type { VoxelGrid } from './voxel-grid.js';

export type Face = Facing;

export interface WallCell {
  x: number;
  y: number;
  z: number;
  /** Outward-facing side, used to hang vines. */
  face: Face;
}

export interface Shell {
  /** Plain wall blocks (no corners, windows or trim); targets for moss and ruins. */
  walls: WallCell[];
  /** Wall height (the LOC height); roofs sit above it. */
  height: number;
  /** Highest y the building occupies. */
  topY: number;
}

/**
 * Building families. Each is a visual metaphor picked from file facts:
 * size class (from the LOC height), tests, docs, tooling and LOD-merged folders.
 */
export type Style = 'house' | 'townhouse' | 'midrise' | 'tower' | 'library' | 'lighthouse' | 'testlab' | 'workshop' | 'landmark';

export interface StyleInput {
  kind: 'tower' | 'house';
  height: number;
  isTest: boolean;
  isDoc: boolean;
  lang: string;
  merged?: number;
}

export function chooseStyle(b: StyleInput): Style {
  if (b.kind === 'house') return 'house';
  if (b.merged) return 'landmark';
  if (b.isTest) return b.height <= 16 ? 'lighthouse' : 'testlab';
  if (b.isDoc) return 'library';
  if ((b.lang === 'shell' || b.lang === 'config') && b.height <= 14) return 'workshop';
  if (b.height <= 14) return 'townhouse';
  if (b.height <= 48) return 'midrise';
  return 'tower';
}

const slab = (material: string) => `minecraft:${material}_slab[type=bottom,waterlogged=false]`;

function inset(r: Rect, n: number): Rect {
  return { x0: r.x0 + n, z0: r.z0 + n, x1: r.x1 - n, z1: r.z1 - n };
}
const width = (r: Rect) => r.x1 - r.x0;
const depth = (r: Rect) => r.z1 - r.z0;

class Mason {
  readonly walls: WallCell[] = [];
  top = 0;
  constructor(readonly g: VoxelGrid, readonly pal: Palette, readonly rng: () => number) {}

  put(x: number, y: number, z: number, state: string | number): void {
    this.g.set(x, y, z, typeof state === 'number' ? state : this.g.id(state));
    if (y > this.top) this.top = y;
  }

  fill(r: Rect, y0: number, y1: number, state: string): void {
    const id = this.g.id(state);
    for (let y = y0; y < y1; y++) for (let z = r.z0; z < r.z1; z++) for (let x = r.x0; x < r.x1; x++) this.put(x, y, z, id);
  }

  /**
   * Perimeter walls from y0 to y1 (exclusive). `window(along, len, y)` decides
   * glass; corners get the trim block.
   */
  shell(r: Rect, y0: number, y1: number, wall: string, opts: { trim?: string; glass?: string; window?: (along: number, len: number, y: number) => boolean; band?: (y: number) => string | null } = {}): void {
    const wallId = this.g.id(wall);
    const trimId = this.g.id(opts.trim ?? this.pal.trim);
    const glassId = this.g.id(opts.glass ?? this.pal.glass);
    const w = width(r);
    const d = depth(r);
    for (let y = y0; y < y1; y++) {
      const band = opts.band?.(y) ?? null;
      const bandId = band ? this.g.id(band) : 0;
      for (let z = r.z0; z < r.z1; z++) {
        for (let x = r.x0; x < r.x1; x++) {
          const ex = x === r.x0 || x === r.x1 - 1;
          const ez = z === r.z0 || z === r.z1 - 1;
          if (!ex && !ez) continue;
          if (ex && ez) {
            this.put(x, y, z, trimId);
            continue;
          }
          if (bandId) {
            this.put(x, y, z, bandId);
            continue;
          }
          const face: Face = z === r.z0 ? 'north' : z === r.z1 - 1 ? 'south' : x === r.x0 ? 'west' : 'east';
          const along = face === 'north' || face === 'south' ? x - r.x0 : z - r.z0;
          const len = face === 'north' || face === 'south' ? w : d;
          if (opts.window?.(along, len, y)) this.put(x, y, z, glassId);
          else {
            this.put(x, y, z, wallId);
            this.walls.push({ x, y, z, face });
          }
        }
      }
    }
  }

  /** Interior floors every `every` levels so the building can be walked in Minecraft. */
  floors(r: Rect, y0: number, y1: number, every: number): void {
    if (width(r) < 3 || depth(r) < 3) return;
    const id = this.g.id(this.pal.floor);
    const inner = inset(r, 1);
    for (let y = y0; y < y1; y += every) for (let z = inner.z0; z < inner.z1; z++) for (let x = inner.x0; x < inner.x1; x++) this.put(x, y, z, id);
  }

  door(r: Rect): void {
    if (width(r) < 3) return;
    const x = r.x0 + Math.floor(width(r) / 2);
    this.g.set(x, 1, r.z1 - 1, 0);
    this.g.set(x, 2, r.z1 - 1, 0);
    this.walls.splice(0, this.walls.length, ...this.walls.filter((c) => !(c.x === x && c.z === r.z1 - 1 && c.y <= 2)));
  }

  /** Gable roof with the ridge along the longer side, optionally overhanging by one block. */
  gable(r: Rect, y: number, material: string, block: string, overhang: number, gableWall: string): number {
    const alongX = width(r) >= depth(r);
    const o = inset(r, -overhang);
    const span = alongX ? depth(o) : width(o);
    const ridgeId = this.g.id(block);
    const wallId = this.g.id(gableWall);
    let k = 0;
    for (; ; k++) {
      const a = k;
      const b = span - 1 - k;
      const yy = y + k;
      if (a > b) break;
      if (a === b) {
        if (alongX) for (let x = o.x0; x < o.x1; x++) this.put(x, yy, o.z0 + a, slab(material));
        else for (let z = o.z0; z < o.z1; z++) this.put(o.x0 + a, yy, z, slab(material));
        break;
      }
      if (alongX) {
        for (let x = o.x0; x < o.x1; x++) {
          this.put(x, yy, o.z0 + a, stairs(material, 'south'));
          this.put(x, yy, o.z0 + b, stairs(material, 'north'));
        }
        // Gable end walls fill the triangle under the slopes.
        for (let z = Math.max(r.z0, o.z0 + a + 1); z < Math.min(r.z1, o.z0 + b); z++) {
          this.put(r.x0, yy, z, wallId);
          this.put(r.x1 - 1, yy, z, wallId);
        }
      } else {
        for (let z = o.z0; z < o.z1; z++) {
          this.put(o.x0 + a, yy, z, stairs(material, 'east'));
          this.put(o.x0 + b, yy, z, stairs(material, 'west'));
        }
        for (let x = Math.max(r.x0, o.x0 + a + 1); x < Math.min(r.x1, o.x0 + b); x++) {
          this.put(x, yy, r.z0, wallId);
          this.put(x, yy, r.z1 - 1, wallId);
        }
      }
      if (b - a === 1) {
        // Two-wide top: close it with a ridge row.
        if (alongX) for (let x = o.x0; x < o.x1; x++) this.put(x, yy + 1, o.z0 + a, ridgeId), this.put(x, yy + 1, o.z0 + b, slab(material));
        else for (let z = o.z0; z < o.z1; z++) this.put(o.x0 + a, yy + 1, z, ridgeId), this.put(o.x0 + b, yy + 1, z, slab(material));
        return yy + 1;
      }
    }
    return y + k;
  }

  /** Hip roof: rings of stairs shrinking toward the centre. */
  hip(r: Rect, y: number, material: string, overhang: number): number {
    let o = inset(r, -overhang);
    let yy = y;
    while (width(o) > 2 && depth(o) > 2) {
      for (let x = o.x0; x < o.x1; x++) {
        this.put(x, yy, o.z0, stairs(material, 'south'));
        this.put(x, yy, o.z1 - 1, stairs(material, 'north'));
      }
      for (let z = o.z0 + 1; z < o.z1 - 1; z++) {
        this.put(o.x0, yy, z, stairs(material, 'east'));
        this.put(o.x1 - 1, yy, z, stairs(material, 'west'));
      }
      o = inset(o, 1);
      yy++;
    }
    if (width(o) > 0 && depth(o) > 0) this.fill(o, yy, yy + 1, slab(material));
    return yy;
  }

  /** Flat roof with a parapet ring; returns the y above the roof deck. */
  flatRoof(r: Rect, y: number, deck: string, parapet: string): number {
    this.fill(r, y, y + 1, deck);
    if (width(r) >= 3 && depth(r) >= 3) {
      const id = this.g.id(parapet);
      for (let z = r.z0; z < r.z1; z++) for (let x = r.x0; x < r.x1; x++) {
        if (x === r.x0 || x === r.x1 - 1 || z === r.z0 || z === r.z1 - 1) this.put(x, y + 1, z, id);
      }
    }
    return y + 1;
  }

  /**
   * Roof furniture on a flat deck, so a skyline of flat roofs reads as many
   * buildings instead of one material: gravel, green or pale decks, HVAC
   * units, a stair housing and, on wider roofs, a timber water tank.
   */
  roofscape(r: Rect, deckTop: number): void {
    const inner = inset(r, 1);
    if (width(inner) < 3 || depth(inner) < 3) return;
    const rng = this.rng;
    const area = width(inner) * depth(inner);
    const roll = rng();
    const green = this.pal.biome !== 'nether' && this.pal.biome !== 'end';
    const deck = roll < 0.3 ? 'minecraft:gravel' : roll < 0.48 && green ? 'minecraft:moss_block' : roll < 0.66 ? BLOCKS.roofBox : null;
    if (deck) this.fill(inner, deckTop - 1, deckTop, deck);
    const free = (x: number, z: number, w: number, d: number) => {
      for (let zz = z; zz < z + d; zz++) for (let xx = x; xx < x + w; xx++) if (this.g.get(xx, deckTop, zz) !== 0) return false;
      return true;
    };
    const spot = (w: number, d: number): [number, number] | null => {
      if (width(inner) < w || depth(inner) < d) return null;
      for (let tries = 0; tries < 6; tries++) {
        const x = inner.x0 + Math.floor(rng() * (width(inner) - w + 1));
        const z = inner.z0 + Math.floor(rng() * (depth(inner) - d + 1));
        if (free(x, z, w, d)) return [x, z];
      }
      return null;
    };
    // Stair housing in the trim material.
    const sh = spot(2, 3);
    if (sh) this.fill({ x0: sh[0], z0: sh[1], x1: sh[0] + 2, z1: sh[1] + 3 }, deckTop, deckTop + 2, this.pal.trim);
    // Water tank on legs, only where the roof is wide enough to carry it.
    const tanks = width(inner) >= 6 && depth(inner) >= 6 && rng() < 0.55 ? (area >= 200 ? 2 : 1) : 0;
    for (let k = 0; k < tanks; k++) {
      const t = spot(2, 2);
      if (t) {
        const tank = { x0: t[0], z0: t[1], x1: t[0] + 2, z1: t[1] + 2 };
        this.fill(tank, deckTop, deckTop + 1, BLOCKS.ironBars);
        this.fill(tank, deckTop + 1, deckTop + 3, 'minecraft:spruce_planks');
        this.fill(tank, deckTop + 3, deckTop + 4, slab('spruce'));
      }
    }
    // HVAC units, more on larger decks (about one per 30 cells, at most 12).
    const units = Math.min(12, 1 + Math.floor((area / 30) * (0.6 + rng() * 0.8)));
    for (let i = 0; i < units; i++) {
      const along = rng() < 0.5;
      const u = along ? spot(2, 1) : spot(1, 2);
      if (!u) break;
      this.fill({ x0: u[0], z0: u[1], x1: u[0] + (along ? 2 : 1), z1: u[1] + (along ? 1 : 2) }, deckTop, deckTop + 1, 'minecraft:light_gray_concrete');
    }
  }
}

/** Windows on every other column, `rows` decides which levels are glass. */
const grid = (rows: (y: number) => boolean) => (along: number, len: number, y: number) =>
  along > 0 && along < len - 1 && along % 2 === 1 && rows(y);

/**
 * `roofSeed` is a hash of the building's folder: buildings in one district
 * share their roof type (large shapes stay predictable, details vary).
 */
export function buildShell(g: VoxelGrid, b: BuildingLayout, pal: Palette, style: Style, rng: () => number, roofSeed = 0, crown = false): Shell {
  const m = new Mason(g, pal, rng);
  const fp = b.footprint;
  const H = b.height;
  const roofMat = pal.roof;

  switch (style) {
    case 'house': {
      const h = Math.max(2, Math.min(4, H - 2));
      if (width(fp) < 3 || depth(fp) < 3) {
        m.fill(fp, 1, 1 + h, pal.wall);
        m.fill(fp, 1 + h, 2 + h, slab(roofMat));
        break;
      }
      m.shell(fp, 1, 1 + h, pal.wall, { window: (a, len, y) => y === 2 && a === Math.floor(len / 2) });
      m.door(fp);
      m.gable(fp, 1 + h, roofMat, pal.roofBlock, 0, pal.wall);
      if (rng() < 0.35) m.fill({ x0: fp.x1 - 1, z0: fp.z0, x1: fp.x1, z1: fp.z0 + 1 }, 1 + h, 3 + h, BLOCKS.chimney);
      break;
    }
    case 'townhouse': {
      m.shell(fp, 1, H + 1, pal.wall, { window: grid((y) => y % 3 === 2) });
      m.floors(fp, 4, H + 1, 3);
      m.door(fp);
      const slender = H > 1.6 * Math.min(width(fp), depth(fp));
      const square = Math.abs(width(fp) - depth(fp)) <= 1;
      if (slender) m.flatRoof(fp, H + 1, pal.roofBlock, pal.trim);
      else if (square && roofSeed % 5 < 3) m.hip(fp, H + 1, roofMat, 1);
      else m.gable(fp, H + 1, roofMat, pal.roofBlock, 1, pal.wall);
      if (rng() < 0.3 && width(fp) >= 4) m.fill({ x0: fp.x0 + 1, z0: fp.z0 + 1, x1: fp.x0 + 2, z1: fp.z0 + 2 }, H + 1, H + 3 + Math.floor(Math.min(width(fp), depth(fp)) / 2), BLOCKS.chimney);
      break;
    }
    case 'workshop': {
      m.shell(fp, 1, H + 1, pal.wall, { window: grid((y) => y % 4 === 2) });
      m.door(fp);
      // Sawtooth roof: alternating solid teeth and glass strips.
      for (let z = fp.z0; z < fp.z1; z++) {
        const tooth = (z - fp.z0) % 3 !== 2;
        for (let x = fp.x0; x < fp.x1; x++) {
          m.put(x, H + 1, z, tooth ? pal.roofBlock : pal.glass);
          if ((z - fp.z0) % 3 === 0) m.put(x, H + 2, z, stairs(roofMat, 'north'));
        }
      }
      break;
    }
    case 'library': {
      m.shell(fp, 1, H + 1, pal.wall, {
        trim: pal.trim,
        window: (a, len, y) => a > 0 && a < len - 1 && a % 3 === 1 && y % 4 !== 1 && y < H,
      });
      // Columns on the front.
      for (let x = fp.x0; x < fp.x1; x += 2) for (let y = 1; y <= H; y++) m.put(x, y, fp.z1 - 1, pal.trim);
      m.floors(fp, 5, H + 1, 4);
      m.door(fp);
      if (width(fp) >= 3 && depth(fp) >= 3) m.put(fp.x0 + Math.floor(width(fp) / 2), 1, fp.z0 + Math.floor(depth(fp) / 2), pal.accent);
      m.fill(fp, H + 1, H + 2, pal.trim);
      m.gable(fp, H + 2, roofMat, pal.roofBlock, 0, pal.trim);
      break;
    }
    case 'lighthouse': {
      const s = Math.min(5, width(fp), depth(fp));
      const cx = fp.x0 + Math.floor((width(fp) - s) / 2);
      const cz = fp.z0 + Math.floor((depth(fp) - s) / 2);
      const t: Rect = { x0: cx, z0: cz, x1: cx + s, z1: cz + s };
      m.shell(t, 1, H + 1, BLOCKS.lighthouseA, {
        trim: BLOCKS.lighthouseA,
        band: (y) => (y % 8 === 6 || y % 8 === 7 ? BLOCKS.lighthouseB : null),
        window: (a, len, y) => a === Math.floor(len / 2) && y % 6 === 3,
      });
      m.door(t);
      const gallery = inset(t, -1);
      m.fill(gallery, H + 1, H + 2, BLOCKS.roofBox);
      const bars = g.id(BLOCKS.ironBars);
      for (let z = gallery.z0; z < gallery.z1; z++) for (let x = gallery.x0; x < gallery.x1; x++) {
        if (x === gallery.x0 || x === gallery.x1 - 1 || z === gallery.z0 || z === gallery.z1 - 1) m.put(x, H + 2, z, bars);
      }
      const lamp = s >= 3 ? inset(t, 1) : t;
      m.shell(t, H + 2, H + 4, BLOCKS.lighthouseA, { trim: BLOCKS.lighthouseB, window: () => true, glass: 'minecraft:glass' });
      m.fill(lamp, H + 2, H + 4, BLOCKS.lighthouseLamp);
      m.hip(t, H + 4, 'red_nether_brick', 0);
      break;
    }
    case 'testlab': {
      // Large test files: a calm white lab block with a red beacon on the roof.
      const lab: Palette = { ...pal, wall: 'minecraft:calcite', towerWall: 'minecraft:white_concrete', trim: 'minecraft:light_gray_concrete', floor: 'minecraft:smooth_stone' };
      const lm = new Mason(g, lab, rng);
      lm.shell(fp, 1, H + 1, lab.towerWall, { window: grid((y) => y % 3 === 1), band: (y) => (y % 9 === 0 ? lab.trim : null) });
      lm.floors(fp, 4, H + 1, 3);
      lm.door(fp);
      const deck = lm.flatRoof(fp, H + 1, lab.floor, lab.trim);
      lm.put(fp.x0 + Math.floor(width(fp) / 2), deck, fp.z0 + Math.floor(depth(fp) / 2), BLOCKS.lighthouseB);
      lm.put(fp.x0 + Math.floor(width(fp) / 2), deck + 1, fp.z0 + Math.floor(depth(fp) / 2), 'minecraft:redstone_lamp[lit=true]');
      m.walls.push(...lm.walls);
      m.top = Math.max(m.top, lm.top);
      break;
    }
    case 'midrise': {
      m.shell(fp, 1, 3, pal.wall, { window: (a, len) => a > 0 && a < len - 1 && a % 3 !== 0 });
      // Ribbon windows: one continuous glass row per floor, set one block back so the
      // spandrels between them cast a shadow line (different read from the towers' piers).
      m.shell(fp, 3, H + 1, pal.towerWall, {
        window: (a, len, y) => a > 0 && a < len - 1 && y % 3 === 1 && y < H - 1,
        band: (y) => (y === H ? pal.trim : null),
      });
      m.floors(fp, 3, H + 1, 3);
      if (width(fp) >= 4 && depth(fp) >= 4) {
        const glassId = g.id(pal.glass);
        for (let y = 4; y < H - 1; y += 3) for (let z = fp.z0; z < fp.z1; z++) for (let x = fp.x0; x < fp.x1; x++) {
          if (g.get(x, y, z) !== glassId) continue;
          const ix = x === fp.x0 ? 1 : x === fp.x1 - 1 ? -1 : 0;
          const iz = z === fp.z0 ? 1 : z === fp.z1 - 1 ? -1 : 0;
          if (!ix === !iz) continue; // corners and interior cells stay
          g.set(x, y, z, 0);
          g.set(x + ix, y, z + iz, glassId);
        }
      }
      m.door(fp);
      const deckTop = m.flatRoof(fp, H + 1, pal.floor, pal.trim);
      m.roofscape(fp, deckTop);
      break;
    }
    case 'tower':
    case 'landmark': {
      const podiumTop = Math.min(H, Math.max(4, Math.round(H / 8)));
      m.shell(fp, 1, podiumTop + 1, pal.wall, { window: (a, len, y) => a > 0 && a < len - 1 && y <= 2 });
      m.door(fp);
      let shaft = width(fp) >= 7 && depth(fp) >= 7 ? inset(fp, 1) : fp;
      if (shaft !== fp) m.flatRoof(fp, podiumTop + 1, pal.trim, pal.trim);
      const setback = Math.round(H * 0.68);
      const canStep = width(shaft) >= 9 && depth(shaft) >= 9 && H > 60;
      const piers = shaft !== fp;
      // Wide towers: glass strips between piers that stand in the free ring one block proud of the shaft.
      // Shaft column a sits behind footprint column a + 1, and piers take every third footprint column.
      const windows = piers
        ? (a: number, len: number, y: number) => a > 0 && a < len - 1 && (a + 1) % 3 !== 0 && y % 8 !== 0
        : grid((y) => y % 4 === 2);
      const floorLine = (y: number) => (y % (piers ? 8 : 4) === 0 ? pal.trim : null);
      const lower = canStep ? setback : H;
      m.shell(shaft, podiumTop + 1, lower + 1, pal.towerWall, { window: windows, band: floorLine });
      if (piers && lower - podiumTop > 6) {
        const trimId = g.id(pal.trim);
        for (let z = fp.z0; z < fp.z1; z++) for (let x = fp.x0; x < fp.x1; x++) {
          const edgeX = x === fp.x0 || x === fp.x1 - 1;
          const edgeZ = z === fp.z0 || z === fp.z1 - 1;
          if (!edgeX && !edgeZ) continue;
          const along = edgeZ ? x - fp.x0 : z - fp.z0;
          const isPier = (edgeX && edgeZ) || along % 3 === 0;
          // Piers run up to a 2-block cornice ring at the top of the lower shaft.
          for (let y = podiumTop + 2; y <= lower; y++) if (isPier || y >= lower - 1) m.put(x, y, z, trimId);
        }
      }
      m.floors(shaft, podiumTop + 4, lower + 1, 4);
      let crown = shaft;
      if (canStep) {
        m.fill(shaft, lower + 1, lower + 2, pal.trim);
        crown = inset(shaft, 1);
        m.shell(crown, lower + 2, H + 1, pal.towerWall, { window: windows, band: floorLine });
      }
      if (style === 'landmark') {
        // Glass crown with a light at the top.
        m.shell(crown, H + 1, H + 4, pal.towerWall, { window: () => true, glass: 'minecraft:light_blue_stained_glass' });
        m.fill(crown, H + 4, H + 5, pal.trim);
        let pyr = inset(crown, 1);
        let y = H + 5;
        while (width(pyr) > 0 && depth(pyr) > 0) {
          m.shell(pyr, y, y + 1, 'minecraft:light_blue_stained_glass', { trim: 'minecraft:light_blue_stained_glass' });
          if (width(pyr) <= 2 || depth(pyr) <= 2) {
            m.fill(pyr, y, y + 1, BLOCKS.beacon);
            break;
          }
          pyr = inset(pyr, 1);
          y++;
        }
      } else {
        const deckTop = m.flatRoof(crown, H + 1, pal.floor, pal.trim);
        if (H >= 80) {
          const ax = crown.x0 + Math.floor(width(crown) / 2);
          const az = crown.z0 + Math.floor(depth(crown) / 2);
          for (let y = deckTop; y < deckTop + 4; y++) m.put(ax, y, az, BLOCKS.ironBars);
          m.put(ax, deckTop + 4, az, BLOCKS.antenna);
          m.roofscape(crown, deckTop);
        } else {
          m.roofscape(crown, deckTop);
        }
      }
      break;
    }
  }
  // Landmark crown: stepped tiers in the trim material, capped with gold.
  // Marks the largest file of its folder; sits above the LOC height.
  if (crown && (style === 'midrise' || style === 'tower' || style === 'testlab') && width(fp) >= 5 && depth(fp) >= 5) {
    let tier = inset(fp, 1);
    let y = H + 2;
    // Clear roof furniture inside the crown footprint.
    for (let yy = y; yy <= m.top; yy++) for (let z = tier.z0; z < tier.z1; z++) for (let x = tier.x0; x < tier.x1; x++) g.set(x, yy, z, 0);
    // At most three tiers, so the crown never reads as extra height.
    for (let t = 0; t < 3 && width(tier) >= 3 && depth(tier) >= 3; t++) {
      m.shell(tier, y, y + 2, pal.towerWall, { window: (a, len, yy) => yy === y + 1 && a > 0 && a < len - 1 && a % 2 === 1 });
      m.fill(tier, y + 2, y + 3, pal.roofBlock);
      tier = inset(tier, 1);
      y += 3;
    }
    m.roofscape(inset(tier, -1), y);
    const cx = fp.x0 + Math.floor(width(fp) / 2);
    const cz = fp.z0 + Math.floor(depth(fp) / 2);
    m.put(cx, y, cz, 'minecraft:gold_block');
    for (let k = 1; k <= 3; k++) m.put(cx, y + k, cz, BLOCKS.ironBars);
    m.put(cx, y + 4, cz, BLOCKS.antenna);
  }

  // Later steps (doors, columns, roofs) may have replaced some wall cells.
  const plain = new Set([g.id(pal.wall), g.id(pal.towerWall), g.id(BLOCKS.lighthouseA), g.id('minecraft:white_concrete')]);
  plain.delete(g.id(pal.trim));
  const walls = m.walls.filter((c) => plain.has(g.get(c.x, c.y, c.z)));
  return { walls, height: H, topY: m.top };
}
