import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy';
import type { CityTree, DirNode, FileNode } from '../model/city.js';
import { byCodeUnit } from '../scan/walk.js';
import { PLAZA_DEPTH, PLAZA_MAX_DEPTH, roadWidth } from './roads.js';
import { snap } from './quantize.js';

/** Half-open block rectangle: x in [x0, x1), z in [z0, z1). */
export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

export interface BuildingLayout {
  kind: 'tower' | 'house';
  file: FileNode;
  lot: Rect;
  footprint: Rect;
  height: number;
}

export interface DistrictLayout {
  path: string;
  name: string;
  depth: number;
  rect: Rect;
  plaza: Rect | null;
}

export interface CityLayout {
  width: number;
  length: number;
  districts: DistrictLayout[];
  buildings: BuildingLayout[];
}

export const MAX_SIDE = 1024;
const MAX_BUILDING_SIDE = 48;
const HOUSE = 3;

export function buildingHeight(loc: number): number {
  return Math.min(250, 4 + Math.round(4 * Math.sqrt(loc / 10)));
}

/** Desired square footprint side for a file; below 2 the file lives in a suburb. */
export function buildingSide(loc: number): number {
  return Math.min(MAX_BUILDING_SIDE, Math.round(Math.sqrt(loc) / 2));
}

/**
 * Folder towers made by LOD stand for many files. Applying the per-file
 * formula to their summed LOC puts almost all of them at the 250 cap, so their
 * volume tracks LOC instead: a wider footprint and height = LOC / (side² · 4).
 */
export function landmarkSide(loc: number): number {
  return Math.max(6, Math.min(MAX_BUILDING_SIDE, Math.round(Math.sqrt(loc) / 10)));
}
export function landmarkHeight(loc: number, side: number): number {
  return Math.max(8, Math.min(250, Math.round(loc / (side * side * 4))));
}

function sideFor(f: FileNode): number {
  return f.merged ? landmarkSide(f.loc) : buildingSide(f.loc);
}
function heightFor(f: FileNode, side: number): number {
  return f.merged ? landmarkHeight(f.loc, side) : buildingHeight(f.loc);
}

type LNode =
  | { kind: 'dir'; key: string; dir: DirNode; depth: number; children: LNode[] }
  | { kind: 'file'; key: string; file: FileNode; side: number; weight: number }
  | { kind: 'suburb'; key: string; files: FileNode[]; weight: number };

function suburbWeight(n: number): number {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return (cols * (HOUSE + 1) + 1) * (rows * (HOUSE + 1) + 1);
}

function build(dir: DirNode, depth: number, demoted: Set<string>, boost: Map<string, number>): LNode {
  const children: LNode[] = [];
  const small: FileNode[] = [];
  for (const c of dir.children) {
    if (c.kind === 'dir') {
      children.push(build(c, depth + 1, demoted, boost));
      continue;
    }
    const side = sideFor(c);
    if (side < 2 || demoted.has(c.path)) small.push(c);
    else {
      const s = Math.max(3, side);
      children.push({ kind: 'file', key: c.path, file: c, side: s, weight: (s + 2) ** 2 * (boost.get(c.path) ?? 1) });
    }
  }
  if (small.length) {
    const key = `${dir.path}/\0suburb`;
    children.push({ kind: 'suburb', key, files: small, weight: suburbWeight(small.length) * (boost.get(key) ?? 1) });
  }
  return { kind: 'dir', key: dir.path, dir, depth, children };
}

function plazaFor(n: LNode): number {
  return n.kind === 'dir' && n.depth >= 1 && n.depth <= PLAZA_MAX_DEPTH && n.children.length >= 3 ? PLAZA_DEPTH : 0;
}

function runTreemap(root: LNode, side: number): HierarchyRectangularNode<LNode> {
  const h = hierarchy<LNode>(root, (n) => (n.kind === 'dir' ? n.children : undefined))
    .sum((n) => (n.kind === 'dir' ? 0 : n.weight))
    .sort((a, b) => b.value! - a.value! || byCodeUnit(a.data.key, b.data.key));
  return treemap<LNode>()
    .tile(treemapSquarify.ratio(1.618))
    .size([side, side])
    .paddingInner((n) => roadWidth(n.depth))
    .paddingOuter((n) => (n.depth === 0 ? roadWidth(0) : 0))
    .paddingTop((n) => (n.depth === 0 ? roadWidth(0) : plazaFor(n.data)))(h);
}

type Laid = HierarchyRectangularNode<LNode>;

function mirror(node: Laid, axis: 'x' | 'y', a: number, b: number): void {
  node.each((n) => {
    if (axis === 'x') [n.x0, n.x1] = [a + b - n.x1, a + b - n.x0];
    else [n.y0, n.y1] = [a + b - n.y1, a + b - n.y0];
  });
}

/**
 * Squarify always packs the largest children into the x0/y0 corner. Mirror
 * each district (top-down) so its heavy side faces its parent's centre: the
 * big files of the whole repo then gather in one downtown. Only placement
 * changes; every lot keeps its size, and the plaza strip stays where it is.
 */
function gatherDowntown(root: Laid): void {
  root.eachBefore((node) => {
    if (!node.parent || !node.children?.length) return;
    const parent = node.parent;
    const px = (parent.x0 + parent.x1) / 2;
    const py = (parent.y0 + parent.y1) / 2;
    const plaza = plazaFor(node.data);
    const cx = (node.x0 + node.x1) / 2;
    const cy = (node.y0 + plaza + node.y1) / 2;
    let wx = 0, wy = 0, w = 0;
    for (const c of node.children) {
      const v = c.value ?? 0;
      wx += ((c.x0 + c.x1) / 2) * v;
      wy += ((c.y0 + c.y1) / 2) * v;
      w += v;
    }
    if (w <= 0) return;
    wx /= w;
    wy /= w;
    for (const c of node.children) {
      if ((wx - cx) * (px - cx) < 0) mirror(c, 'x', node.x0, node.x1);
      if ((wy - cy) * (py - cy) < 0) mirror(c, 'y', node.y0 + plaza, node.y1);
    }
  });
}

function placeSuburb(files: FileNode[], r: Rect, roomyOnly: boolean): BuildingLayout[] | null {
  const w = r.x1 - r.x0;
  const h = r.z1 - r.z0;
  // Roomy 3x3 houses first, then denser grids once the city is at its size cap. Never drop a file.
  const grids = roomyOnly ? ([[4, 3, 1]] as const) : ([[4, 3, 1], [3, 2, 1], [2, 1, 1], [1, 1, 0]] as const);
  for (const [cell, house, margin] of grids) {
    const cols = Math.floor((w - margin) / cell);
    if (cols < 1) continue;
    const rows = Math.ceil(files.length / cols);
    if (margin + rows * cell > h) continue;
    return files.map((file, i) => {
      const x0 = r.x0 + margin + (i % cols) * cell;
      const z0 = r.z0 + margin + Math.floor(i / cols) * cell;
      return {
        kind: 'house' as const,
        file,
        lot: { x0, z0, x1: x0 + cell, z1: z0 + cell },
        footprint: { x0, z0, x1: x0 + house, z1: z0 + house },
        height: Math.min(6, buildingHeight(file.loc)),
      };
    });
  }
  return null;
}

/**
 * Footprint inside its lot, keeping a one-block alley. Buildings line up with
 * the nearest edge of their district (the street), so spare space collects
 * behind them as one courtyard instead of a thin ring.
 */
function towerFootprint(lot: Rect, side: number, district: Rect | null, height = 0): Rect | null {
  const w = lot.x1 - lot.x0;
  const h = lot.z1 - lot.z0;
  if (w < 4 || h < 4) return null;
  // Massing: height is the metric, so keep it, but stop small files from
  // becoming posts. Widen up to height/1.8 when the lot has room.
  const want = Math.max(side, Math.ceil(height / 1.8));
  const fw = Math.min(want, w - 2);
  const fh = Math.min(want, h - 2);
  let x0 = lot.x0 + Math.floor((w - fw) / 2);
  let z0 = lot.z0 + Math.floor((h - fh) / 2);
  if (district) {
    x0 = lot.x0 - district.x0 <= district.x1 - lot.x1 ? lot.x0 + 1 : lot.x1 - 1 - fw;
    z0 = lot.z0 - district.z0 <= district.z1 - lot.z1 ? lot.z0 + 1 : lot.z1 - 1 - fh;
  }
  return { x0, z0, x1: x0 + fw, z1: z0 + fh };
}

const MAX_ATTEMPTS = 60;

export function layoutCity(city: CityTree): CityLayout {
  const demoted = new Set<string>();
  const boost = new Map<string, number>();
  const sumWeights = (n: LNode): number => (n.kind === 'dir' ? n.children.reduce((s, c) => s + sumWeights(c), 0) : n.weight);
  let side = Math.min(MAX_SIDE, Math.ceil(Math.sqrt(sumWeights(build(city.root, 0, demoted, boost))) * 1.3) + 2 * roadWidth(0));

  for (let attempt = 0; ; attempt++) {
    const last = attempt === MAX_ATTEMPTS;
    const laid = runTreemap(build(city.root, 0, demoted, boost), side);
    gatherDowntown(laid);
    const districts: DistrictLayout[] = [];
    const buildings: BuildingLayout[] = [];
    const failed: Array<Extract<LNode, { kind: 'file' | 'suburb' }>> = [];
    let squeezed = 0;
    let leaves = 0;

    for (const node of laid.descendants()) {
      const rect = snap(node);
      const d = node.data;
      if (d.kind === 'dir') {
        const plaza = plazaFor(d);
        districts.push({
          path: d.dir.path,
          name: d.dir.name,
          depth: d.depth,
          rect,
          plaza: plaza ? { x0: rect.x0, z0: rect.z0, x1: rect.x1, z1: Math.min(rect.z1, rect.z0 + plaza) } : null,
        });
      } else if (d.kind === 'file') {
        leaves++;
        const fp = towerFootprint(rect, d.side, node.parent ? snap(node.parent) : null, d.file.merged ? 0 : buildingHeight(d.file.loc));
        if (!fp) {
          failed.push(d);
          continue;
        }
        if ((rect.x1 - rect.x0) * (rect.z1 - rect.z0) < ((d.side + 2) ** 2) * 0.8) squeezed++;
        buildings.push({ kind: 'tower', file: d.file, lot: rect, footprint: fp, height: heightFor(d.file, d.side) });
      } else {
        const houses = placeSuburb(d.files, rect, side < MAX_SIDE && attempt < MAX_ATTEMPTS / 2);
        if (houses) buildings.push(...houses);
        else failed.push(d);
      }
    }

    const crowded = leaves > 0 && squeezed / leaves > 0.1 && side < MAX_SIDE;
    if ((failed.length || crowded) && !last) {
      // Slivers come from extreme weight ratios inside one folder: give the
      // starved lot more weight instead of growing the whole city.
      for (const f of failed) {
        if (f.kind === 'file' && side >= MAX_SIDE) demoted.add(f.file.path);
        else boost.set(f.key, (boost.get(f.key) ?? 1) * 1.6);
      }
      if (crowded) side = Math.min(MAX_SIDE, Math.ceil(side * 1.1));
      else if (failed.length) side = Math.min(MAX_SIDE, Math.ceil(side * 1.05));
      continue;
    }
    if (failed.length) throw new Error(`layout does not fit in ${MAX_SIDE}x${MAX_SIDE}; lower --max-buildings`);

    buildings.sort((a, b) => byCodeUnit(a.file.path, b.file.path));
    districts.sort((a, b) => byCodeUnit(a.path, b.path));
    return { width: side, length: side, districts, buildings };
  }
}
