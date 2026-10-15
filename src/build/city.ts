import type { CityLayout, Rect } from '../layout/treemap.js';
import { files, type CityTree } from '../model/city.js';
import { buildShell, chooseStyle, type Style } from './building.js';
import { addFire, addMoss, addRuins, churnThresholds, fireLevel, isMossy, ruinShare, type ChurnThresholds } from './decorators.js';
import { BLOCKS, biomeFor, PALETTES, VARIANTS, type Biome, type Palette } from './palette.js';
import { fnv1a, mulberry32, rngFor } from './rng.js';
import { VoxelGrid } from './voxel-grid.js';

export interface BuildingFact {
  path: string;
  name: string;
  kind: 'tower' | 'house';
  style: Style;
  biome: Biome;
  lang: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  height: number;
  /** Highest block of the building including roof and decorations. */
  topY: number;
  loc: number;
  churn: number;
  todos: number;
  lastTouched: number | null;
  fire: 0 | 1 | 2;
  ruinShare: number;
  mossy: boolean;
  merged?: number;
}

export interface DistrictFact {
  path: string;
  name: string;
  depth: number;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface BuiltCity {
  grid: VoxelGrid;
  buildings: BuildingFact[];
  districts: DistrictFact[];
  thresholds: ChurnThresholds;
}

export interface BuildOptions {
  seed?: number;
  palettes?: Record<Biome, Palette>;
  /** Draw fire, moss and ruins (default true). Facts are reported either way. */
  overlays?: boolean;
}

/** Room above the tallest wall for roofs, crowns and antennas. */
const ROOF_HEADROOM = 40;

export function buildCity(city: CityTree, layout: CityLayout, opts: BuildOptions = {}): BuiltCity {
  const seed = opts.seed ?? 0;
  const overlays = opts.overlays ?? true;
  const palettes = opts.palettes ?? PALETTES;
  const maxH = layout.buildings.reduce((m, b) => Math.max(m, b.height), 0);
  const grid = new VoxelGrid(layout.width, maxH + ROOF_HEADROOM, layout.length);
  const thresholds = churnThresholds(files(city.root));
  const occupied = new Uint8Array(layout.width * layout.length); // footprints and street furniture
  const occ = (x: number, z: number) => occupied[z * layout.width + x] === 1;
  const mark = (r: Rect) => {
    for (let z = r.z0; z < r.z1; z++) for (let x = r.x0; x < r.x1; x++) occupied[z * layout.width + x] = 1;
  };

  // --- Ground: districts paint their road surface, children paint over it.
  // Street hierarchy: avenue (depth 0), street (1), lane (2), path (3+).
  const roadTop = grid.id(BLOCKS.roadTop);
  const roadMid = grid.id(BLOCKS.roadMid);
  const roadLane = grid.id(BLOCKS.roadLane);
  const roadDeep = grid.id(BLOCKS.roadDeep);
  const roadFor = (depth: number) => [roadTop, roadMid, roadLane][depth] ?? roadDeep;
  const plaza = grid.id(BLOCKS.plaza);
  const districts = [...layout.districts].sort((a, b) => a.depth - b.depth || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const d of districts) grid.fill(d.rect.x0, 0, d.rect.z0, d.rect.x1, 1, d.rect.z1, roadFor(d.depth));
  for (const d of districts) if (d.plaza) grid.fill(d.plaza.x0, 0, d.plaza.z0, d.plaza.x1, 1, d.plaza.z1, plaza);

  const paletteOf = (f: { isDoc: boolean; lang: Parameters<typeof biomeFor>[0] }) => palettes[f.isDoc ? 'library' : biomeFor(f.lang)];
  for (const b of layout.buildings) {
    const ground = grid.id(b.kind === 'house' ? BLOCKS.grass : paletteOf(b.file).ground);
    grid.fill(b.lot.x0, 0, b.lot.z0, b.lot.x1, 1, b.lot.z1, ground);
    mark(b.footprint);
  }

  // --- Sidewalks: road cells touching anything that is not road.
  const sidewalk = grid.id(BLOCKS.sidewalk);
  const isRoad = (id: number) => id === roadTop || id === roadMid || id === roadLane || id === roadDeep;
  const toSidewalk: number[] = [];
  for (let z = 0; z < layout.length; z++) {
    for (let x = 0; x < layout.width; x++) {
      if (!isRoad(grid.get(x, 0, z))) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= layout.width || nz >= layout.length) continue;
        const n = grid.get(nx, 0, nz);
        if (!isRoad(n)) {
          toSidewalk.push(x, z);
          break;
        }
      }
    }
  }
  for (let i = 0; i < toSidewalk.length; i += 2) grid.set(toSidewalk[i]!, 0, toSidewalk[i + 1]!, sidewalk);

  // --- Street lamps on sidewalks, on a fixed lattice so spacing stays even.
  const fence = grid.id(BLOCKS.fence);
  const lantern = grid.id(BLOCKS.lantern);
  for (let i = 0; i < toSidewalk.length; i += 2) {
    const x = toSidewalk[i]!, z = toSidewalk[i + 1]!;
    if ((x % 9 === 0 || z % 9 === 0) && (x + z) % 9 === 0 && !occ(x, z)) {
      grid.set(x, 1, z, fence);
      grid.set(x, 2, z, fence);
      grid.set(x, 3, z, lantern);
      occupied[z * layout.width + x] = 1;
    }
  }

  // --- Plazas: name sign, lamp and planters.
  const sign = grid.id(BLOCKS.sign);
  const bush = grid.id(BLOCKS.bush);
  for (const d of layout.districts) {
    if (!d.plaza) continue;
    const x = d.plaza.x0 + 1;
    const z = d.plaza.z0 + 1;
    grid.set(x, 1, z, sign);
    occupied[z * layout.width + x] = 1;
    const name = d.name.length > 15 ? d.name.slice(0, 14) + '…' : d.name;
    const parent = d.path.includes('/') ? d.path.slice(0, d.path.lastIndexOf('/')) : '';
    grid.blockEntities.push({ x, y: 1, z, id: 'minecraft:sign', kind: 'sign', lines: [name, parent ? `in ${parent}`.slice(0, 15) : '', '', ''] });
    if (x + 2 < d.plaza.x1) {
      grid.set(x + 2, 1, z, fence);
      grid.set(x + 2, 2, z, lantern);
    }
    for (let px = d.plaza.x0 + 5; px < d.plaza.x1 - 1; px += 6) grid.set(px, 1, z, bush);
  }

  // --- Buildings.
  const buildings: BuildingFact[] = [];
  for (const b of layout.buildings) {
    const f = b.file;
    const biome: Biome = f.isDoc ? 'library' : biomeFor(f.lang);
    const pal = neighbourhoodPalette(palettes[biome], biome, f.path, palettes === PALETTES);
    const roofSeed = fnv1a(f.path.split('/').slice(0, -1).join('/'));
    const style = chooseStyle({ kind: b.kind, height: b.height, isTest: f.isTest, isDoc: f.isDoc, lang: f.lang, merged: f.merged });
    const rng = rngFor(f.path, seed);
    const shell = buildShell(grid, b, pal, style, rng, roofSeed);
    const fire = fireLevel(f.churn, thresholds);
    const mossy = isMossy(f, city.headTime);
    const share = ruinShare(f);
    if (overlays) {
      if (mossy) addMoss(grid, shell, pal, rng);
      addRuins(grid, shell, share, rng);
      addFire(grid, b, shell, fire, rng);
    }
    buildings.push({
      path: f.path, name: f.name, kind: b.kind, style, biome, lang: f.lang,
      x0: b.footprint.x0, z0: b.footprint.z0, x1: b.footprint.x1, z1: b.footprint.z1,
      height: b.height, topY: shell.topY + 1, loc: f.loc, churn: f.churn, todos: f.todos, lastTouched: f.lastTouched,
      fire, ruinShare: share, mossy, ...(f.merged ? { merged: f.merged } : {}),
    });
  }

  // --- Pocket parks: the space behind street-aligned buildings gets trees,
  // and a pond when there is room. Placement is seeded per lot.
  const water = grid.id(BLOCKS.water);
  const grassId = grid.id(BLOCKS.grass);
  for (const b of layout.buildings) {
    if (b.kind === 'house') continue;
    const pal = paletteOf(b.file);
    const rng = mulberry32(fnv1a(`park:${b.file.path}`) ^ seed);
    const { lot, footprint: fp } = b;
    // Largest free strip of the lot on each side of the footprint.
    const strips: Rect[] = [
      { x0: lot.x0, z0: lot.z0, x1: lot.x1, z1: fp.z0 },
      { x0: lot.x0, z0: fp.z1, x1: lot.x1, z1: lot.z1 },
      { x0: lot.x0, z0: lot.z0, x1: fp.x0, z1: lot.z1 },
      { x0: fp.x1, z0: lot.z0, x1: lot.x1, z1: lot.z1 },
    ].filter((r) => r.x1 - r.x0 >= 3 && r.z1 - r.z0 >= 3);
    for (const r of strips) {
      const w = r.x1 - r.x0;
      const d = r.z1 - r.z0;
      if (w >= 7 && d >= 7 && grid.get(r.x0 + 3, 0, r.z0 + 3) === grassId && rng() < 0.5) {
        const pond = { x0: r.x0 + 2, z0: r.z0 + 2, x1: r.x1 - 2, z1: r.z1 - 2 };
        for (let z = pond.z0; z < pond.z1; z++) for (let x = pond.x0; x < pond.x1; x++) {
          if (!occ(x, z) && grid.get(x, 1, z) === 0) grid.set(x, 0, z, water);
        }
        mark(pond);
      }
      for (let z = r.z0 + 1; z < r.z1 - 1; z += 3) for (let x = r.x0 + 1; x < r.x1 - 1; x += 3) {
        if (rng() > 0.7) continue;
        if (grid.get(x, 0, z) !== grassId || !canPlant(grid, occ, x, z)) continue;
        plantTree(grid, pal, x, z, 3 + Math.floor(rng() * 3));
        occupied[z * layout.width + x] = 1;
      }
    }
  }
  // A few bushes next to building entrances (sparse on purpose: clutter hides the city).
  const grass = grid.id(BLOCKS.grass);
  for (const b of layout.buildings) {
    if (b.kind === 'house') continue;
    const fp = b.footprint;
    const z = fp.z1;
    for (const x of [fp.x0, fp.x1 - 1]) {
      if (z < b.lot.z1 && !occ(x, z) && grid.get(x, 0, z) === grass && grid.get(x, 1, z) === 0) grid.set(x, 1, z, bush);
    }
  }

  const districtFacts = layout.districts.map((d) => ({ path: d.path, name: d.name, depth: d.depth, ...d.rect }));
  return { grid, buildings, districts: districtFacts, thresholds };
}

/** Neighbourhood = first two folder levels of the file's path. */
function neighbourhoodPalette(pal: Palette, biome: Biome, path: string, defaults: boolean): Palette {
  const variants = VARIANTS[biome];
  // User palette overrides win over variants.
  if (!defaults || variants.length < 2) return pal;
  const dirs = path.split('/').slice(0, -1).slice(0, 2).join('/');
  const v = variants[fnv1a(dirs) % variants.length]!;
  return { ...pal, ...v };
}

function canPlant(grid: VoxelGrid, occ: (x: number, z: number) => boolean, x: number, z: number): boolean {
  if (x < 1 || z < 1 || x >= grid.width - 1 || z >= grid.length - 1) return false;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    if (occ(x + dx, z + dz)) return false;
    for (let y = 1; y <= 6; y++) if (grid.get(x + dx, y, z + dz) !== 0) return false;
  }
  return true;
}

function plantTree(grid: VoxelGrid, pal: Palette, x: number, z: number, h: number): void {
  const logId = grid.id(pal.treeLog);
  const leaf = grid.id(pal.treeLeaves);
  for (let y = 1; y <= h; y++) grid.set(x, y, z, logId);
  for (let dy = 0; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const y = h - 1 + dy;
    if (dx === 0 && dz === 0 && y <= h) continue;
    if (dy === 1 && dx !== 0 && dz !== 0) continue;
    if (grid.get(x + dx, y, z + dz) === 0) grid.set(x + dx, y, z + dz, leaf);
  }
  grid.set(x, h + 1, z, leaf);
}
