import type { CityLayout } from '../layout/treemap.js';
import { files, type CityTree } from '../model/city.js';
import { buildShell, type Style } from './building.js';
import { addFire, addMoss, addRuins, churnThresholds, fireLevel, isMossy, ruinShare, type ChurnThresholds } from './decorators.js';
import { BLOCKS, biomeFor, PALETTES, type Biome, type Palette } from './palette.js';
import { rngFor } from './rng.js';
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
}

const LANTERN_SPACING = 10;

function styleOf(f: { isTest: boolean; isDoc: boolean }, kind: 'tower' | 'house'): Style {
  if (kind === 'house') return 'house';
  if (f.isTest) return 'lighthouse';
  if (f.isDoc) return 'library';
  return 'tower';
}

export function buildCity(city: CityTree, layout: CityLayout, opts: BuildOptions = {}): BuiltCity {
  const seed = opts.seed ?? 0;
  const palettes = opts.palettes ?? PALETTES;
  const maxH = layout.buildings.reduce((m, b) => Math.max(m, b.height), 0);
  const grid = new VoxelGrid(layout.width, maxH + 4, layout.length);
  const thresholds = churnThresholds(files(city.root));

  // Ground: every district paints its rect with its road surface, children paint over it.
  const roadTop = grid.id(BLOCKS.roadTop);
  const roadDeep = grid.id(BLOCKS.roadDeep);
  const plaza = grid.id(BLOCKS.plaza);
  const districts = [...layout.districts].sort((a, b) => a.depth - b.depth || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const d of districts) {
    const id = d.depth === 0 ? roadTop : roadDeep;
    grid.fill(d.rect.x0, 0, d.rect.z0, d.rect.x1, 1, d.rect.z1, id);
  }
  for (const d of districts) {
    if (d.plaza) grid.fill(d.plaza.x0, 0, d.plaza.z0, d.plaza.x1, 1, d.plaza.z1, plaza);
  }

  // Lots: the building's biome ground (houses sit on grass).
  for (const b of layout.buildings) {
    const pal = palettes[b.file.isDoc ? 'library' : biomeFor(b.file.lang)];
    const ground = grid.id(b.kind === 'house' ? BLOCKS.grass : pal.ground);
    grid.fill(b.lot.x0, 0, b.lot.z0, b.lot.x1, 1, b.lot.z1, ground);
  }

  // Lanterns on the top-level road grid.
  const fence = grid.id(BLOCKS.fence);
  const lantern = grid.id(BLOCKS.lantern);
  for (let z = LANTERN_SPACING / 2; z < layout.length; z += LANTERN_SPACING) {
    for (let x = LANTERN_SPACING / 2; x < layout.width; x += LANTERN_SPACING) {
      if (grid.get(x, 0, z) !== roadTop) continue;
      grid.set(x, 1, z, fence);
      grid.set(x, 2, z, lantern);
    }
  }

  // Name signs on plazas, flanked by lanterns.
  const sign = grid.id(BLOCKS.sign);
  for (const d of layout.districts) {
    if (!d.plaza) continue;
    const x = d.plaza.x0 + 1;
    const z = d.plaza.z0 + 1;
    grid.set(x, 1, z, sign);
    const name = d.name.length > 15 ? d.name.slice(0, 14) + '…' : d.name;
    const parent = d.path.includes('/') ? d.path.slice(0, d.path.lastIndexOf('/')) : '';
    grid.blockEntities.push({ x, y: 1, z, id: 'minecraft:sign', kind: 'sign', lines: [name, parent ? `in ${parent}`.slice(0, 15) : '', '', ''] });
    for (const lx of [x + 2]) {
      if (lx < d.plaza.x1) {
        grid.set(lx, 1, z, fence);
        grid.set(lx, 2, z, lantern);
      }
    }
  }

  const buildings: BuildingFact[] = [];
  for (const b of layout.buildings) {
    const f = b.file;
    const biome: Biome = f.isDoc ? 'library' : biomeFor(f.lang);
    const pal = palettes[biome];
    const style = styleOf(f, b.kind);
    const rng = rngFor(f.path, seed);
    const shell = buildShell(grid, b, pal, style);
    const fire = fireLevel(f.churn, thresholds);
    const mossy = isMossy(f, city.headTime);
    const share = ruinShare(f);
    if (mossy) addMoss(grid, shell, pal, rng);
    addRuins(grid, shell, share, rng);
    addFire(grid, b, shell, fire, rng);
    buildings.push({
      path: f.path, name: f.name, kind: b.kind, style, biome, lang: f.lang,
      x0: b.footprint.x0, z0: b.footprint.z0, x1: b.footprint.x1, z1: b.footprint.z1,
      height: b.height, loc: f.loc, churn: f.churn, todos: f.todos, lastTouched: f.lastTouched,
      fire, ruinShare: share, mossy, ...(f.merged ? { merged: f.merged } : {}),
    });
  }

  const districtFacts = layout.districts.map((d) => ({ path: d.path, name: d.name, depth: d.depth, ...d.rect }));
  return { grid, buildings, districts: districtFacts, thresholds };
}
